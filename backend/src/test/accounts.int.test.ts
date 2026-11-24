// Cadastro de contas e gestão de motoristas (PUTF-29, 30, 31, 32)
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '../lib/password.js';
import { createCarrier, createDriver, createShipment, createShipper } from './fixtures.js';
import { createTestContext, resetDatabase } from './setup-db.js';

const { db, app } = createTestContext();

beforeAll(() => db.migrate.latest());
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

let cnpjSequence = 0;
/** CNPJ com dígitos verificadores válidos, diferente a cada chamada. */
function validCnpj(): string {
  const base = `${String(++cnpjSequence).padStart(8, '0')}0001`;
  const digit = (value: string) => {
    const weights =
      value.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rest = weights.reduce((sum, w, i) => sum + Number(value[i]) * w, 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base);
  return `${base}${first}${digit(base + first)}`;
}

const SAO_PAULO = {
  address: 'Rua da Consolação, 100 - São Paulo/SP',
  lat: -23.5505,
  lng: -46.6333,
};

const companySignup = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ana Silva',
  email: `ana${++cnpjSequence}@empresa.com`,
  password: 'senha-forte',
  legalName: 'Empresa Ana LTDA',
  document: validCnpj(),
  phone: '(11) 98765-4321',
  ...overrides,
});

describe('cadastro de empresa (PUTF-29)', () => {
  it('should create the user and the company, storing only the password hash', async () => {
    const response = await request(app)
      .post('/signup/empresa')
      .send(companySignup({ email: 'Ana@Empresa.COM', document: '11.222.333/0001-81' }));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      type: 'EMPRESA',
      document: '11222333000181',
      phone: '11987654321',
      address: null,
      user: { name: 'Ana Silva', email: 'ana@empresa.com', role: 'EMPRESA' },
    });
    expect(response.body).not.toHaveProperty('user.password');

    const user = await db('users').where({ id: response.body.user.id }).first('password_hash');
    expect(user.password_hash).not.toContain('senha-forte');
    expect(await verifyPassword('senha-forte', user.password_hash)).toBe(true);
  });

  it('should return 409 for an e-mail already used, ignoring case', async () => {
    await request(app)
      .post('/signup/empresa')
      .send(companySignup({ email: 'dup@empresa.com' }));

    const response = await request(app)
      .post('/signup/empresa')
      .send(companySignup({ email: 'DUP@empresa.com' }));
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('E-mail já cadastrado');
  });

  it('should return 409 for a CNPJ already used and roll back the user', async () => {
    const document = validCnpj();
    await request(app).post('/signup/empresa').send(companySignup({ document }));

    const response = await request(app)
      .post('/signup/empresa')
      .send(companySignup({ document, email: 'outra@empresa.com' }));
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('CNPJ já cadastrado');
    expect(await db('users').where({ email: 'outra@empresa.com' })).toHaveLength(0);
  });

  it('should reject an invalid CNPJ', async () => {
    const response = await request(app)
      .post('/signup/empresa')
      .send(companySignup({ document: '11222333000182' }));
    expect(response.status).toBe(400);
  });
});

describe('cadastro de transportadora (PUTF-30)', () => {
  it('should reject the signup without a base address', async () => {
    const response = await request(app).post('/signup/transportadora').send(companySignup());
    expect(response.status).toBe(400);
  });

  it('should save the base address used by the shipment search', async () => {
    const signup = await request(app)
      .post('/signup/transportadora')
      .send(companySignup({ address: SAO_PAULO }));
    expect(signup.status).toBe(201);
    expect(signup.body).toMatchObject({ type: 'TRANSPORTADORA', address: SAO_PAULO });
    const carrierId = signup.body.id as string;

    // Frota + uma carga perto da base: a busca por raio precisa encontrar
    await request(app)
      .post(`/carriers/${carrierId}/vehicles`)
      .send({ plate: 'ABC1D23', type: 'TRUCK_TOCO', capacityKg: 6000, capacityM3: 30 });
    const shipmentId = await createShipment(db, await createShipper(db));

    const available = await request(app).get(`/carriers/${carrierId}/available-shipments`);
    expect(available.body.items.map((s: { id: string }) => s.id)).toEqual([shipmentId]);
  });

  it('should not let a carrier remove its base address', async () => {
    const signup = await request(app)
      .post('/signup/transportadora')
      .send(companySignup({ address: SAO_PAULO }));

    const response = await request(app)
      .patch(`/companies/${signup.body.id}`)
      .send({ address: null });
    expect(response.status).toBe(400);
  });

  it('should update the profile', async () => {
    const signup = await request(app).post('/signup/empresa').send(companySignup());

    const response = await request(app)
      .patch(`/companies/${signup.body.id}`)
      .send({ legalName: 'Novo Nome LTDA', phone: null, address: SAO_PAULO });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      legalName: 'Novo Nome LTDA',
      phone: null,
      address: SAO_PAULO,
    });
  });
});

describe('cadastro de motorista autônomo (PUTF-32)', () => {
  const driverSignup = (overrides: Record<string, unknown> = {}) => ({
    name: 'Elisa Autônoma',
    email: 'elisa@dev.local',
    password: 'senha-forte',
    cnhNumber: '12345678901',
    cnhCategory: 'C',
    baseAddress: SAO_PAULO,
    ...overrides,
  });

  it('should create an autonomous driver with the base address', async () => {
    const response = await request(app).post('/signup/motorista').send(driverSignup());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      carrierId: null,
      name: 'Elisa Autônoma',
      cnhNumber: '12345678901',
      status: 'DISPONIVEL',
      baseAddress: SAO_PAULO,
      invitePending: false,
    });
  });

  it('should return 409 for a CNH already used', async () => {
    await request(app).post('/signup/motorista').send(driverSignup());

    const response = await request(app)
      .post('/signup/motorista')
      .send(driverSignup({ email: 'outro@dev.local' }));
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('CNH já cadastrada');
  });

  it('should update the autonomous profile, but not a carrier driver through this route', async () => {
    const signup = await request(app).post('/signup/motorista').send(driverSignup());
    const campinas = { address: 'Centro - Campinas/SP', lat: -22.9056, lng: -47.0608 };

    const updated = await request(app)
      .patch(`/drivers/${signup.body.id}`)
      .send({ name: 'Elisa S.', baseAddress: campinas });
    expect(updated.body).toMatchObject({ name: 'Elisa S.', baseAddress: campinas });

    const carrierDriver = await createDriver(db, { carrierId: await createCarrier(db) });
    expect(
      (await request(app).patch(`/drivers/${carrierDriver}`).send({ name: 'X Y' })).status,
    ).toBe(404);
  });
});

describe('motoristas da frota (PUTF-31)', () => {
  const newDriver = (overrides: Record<string, unknown> = {}) => ({
    name: 'Diego Motorista',
    email: 'diego@frota.com',
    cnhNumber: '98765432100',
    cnhCategory: 'E',
    phone: '11912345678',
    ...overrides,
  });

  it('should create the driver user without password, pending the invite', async () => {
    const carrierId = await createCarrier(db);

    const response = await request(app).post(`/carriers/${carrierId}/drivers`).send(newDriver());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ carrierId, invitePending: true, baseAddress: null });
    const user = await db('users')
      .where({ id: response.body.userId })
      .first('role', 'password_hash');
    expect(user).toEqual({ role: 'MOTORISTA', password_hash: null });
  });

  it('should list, show and edit only the carrier own drivers', async () => {
    const carrierId = await createCarrier(db);
    const created = await request(app).post(`/carriers/${carrierId}/drivers`).send(newDriver());
    await createDriver(db, { carrierId: await createCarrier(db) });
    const path = `/carriers/${carrierId}/drivers/${created.body.id}`;

    const list = await request(app).get(`/carriers/${carrierId}/drivers`);
    expect(list.body.total).toBe(1);

    const updated = await request(app).patch(path).send({ name: 'Diego S.', phone: null });
    expect(updated.body).toMatchObject({ name: 'Diego S.', phone: null });

    const otherCarrier = await createCarrier(db);
    expect(
      (await request(app).get(`/carriers/${otherCarrier}/drivers/${created.body.id}`)).status,
    ).toBe(404);
  });

  it('should replace the driver profile with PUT, clearing the omitted phone', async () => {
    const carrierId = await createCarrier(db);
    const created = await request(app).post(`/carriers/${carrierId}/drivers`).send(newDriver());
    const path = `/carriers/${carrierId}/drivers/${created.body.id}`;

    const replaced = await request(app)
      .put(path)
      .send({ name: 'Diego Souza', cnhNumber: '11122233344', cnhCategory: 'D' });

    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({
      name: 'Diego Souza',
      cnhNumber: '11122233344',
      cnhCategory: 'D',
      phone: null,
    });

    const partial = await request(app).put(path).send({ name: 'Só o nome' });
    expect(partial.status).toBe(400);
  });

  it('should delete a driver without history, together with the user', async () => {
    const carrierId = await createCarrier(db);
    const created = await request(app).post(`/carriers/${carrierId}/drivers`).send(newDriver());

    const response = await request(app).delete(`/carriers/${carrierId}/drivers/${created.body.id}`);

    expect(response.status).toBe(204);
    expect(await db('users').where({ id: created.body.userId })).toHaveLength(0);
  });

  it('should not delete a driver with offer history or on a trip', async () => {
    const carrierId = await createCarrier(db);
    const withHistory = await createDriver(db, { carrierId });
    const shipmentId = await createShipment(db, await createShipper(db));
    await db('shipment_offers').insert({
      shipment_id: shipmentId,
      carrier_id: carrierId,
      driver_id: withHistory,
      price_proposed: 100,
    });
    const onTrip = await createDriver(db, { carrierId, status: 'EM_VIAGEM' });

    const historyResponse = await request(app).delete(
      `/carriers/${carrierId}/drivers/${withHistory}`,
    );
    expect(historyResponse.status).toBe(409);
    expect(historyResponse.body.error.message).toMatch(/INDISPONIVEL/);
    expect((await request(app).delete(`/carriers/${carrierId}/drivers/${onTrip}`)).status).toBe(
      409,
    );
  });

  it('should return 409 for an e-mail already used by another account', async () => {
    const carrierId = await createCarrier(db);
    await request(app)
      .post('/signup/empresa')
      .send(companySignup({ email: 'diego@frota.com' }));

    const response = await request(app).post(`/carriers/${carrierId}/drivers`).send(newDriver());
    expect(response.status).toBe(409);
  });

  it('should return 404 when the carrier does not exist', async () => {
    const shipperId = await createShipper(db);
    const response = await request(app).post(`/carriers/${shipperId}/drivers`).send(newDriver());
    expect(response.status).toBe(404);
  });
});

describe('fluxo só com cadastros pela API', () => {
  it('should let an autonomous driver sign up, add a vehicle and offer on a shipment', async () => {
    const shipper = await request(app).post('/signup/empresa').send(companySignup());
    const driver = await request(app).post('/signup/motorista').send({
      name: 'Elisa',
      email: 'elisa2@dev.local',
      password: 'senha-forte',
      cnhNumber: '11122233344',
      cnhCategory: 'C',
      baseAddress: SAO_PAULO,
    });
    const vehicle = await request(app)
      .post(`/drivers/${driver.body.id}/vehicles`)
      .send({ plate: 'XYZ9A88', type: 'TRUCK_TOCO', capacityKg: 6000, capacityM3: 30 });
    const shipmentId = await createShipment(db, shipper.body.id);

    const offer = await request(app)
      .post(`/drivers/${driver.body.id}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 2000, vehicleId: vehicle.body.id });

    expect(offer.status).toBe(201);
    expect(offer.body).toMatchObject({ carrierId: null, driverId: driver.body.id });
  });
});
