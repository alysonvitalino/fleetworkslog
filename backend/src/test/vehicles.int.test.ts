import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCarrier,
  createDriver,
  createOffer,
  createShipment,
  createShipper,
  createVehicle,
} from './fixtures.js';
import { createTestContext, resetDatabase } from './setup-db.js';

const { db, app } = createTestContext();

beforeAll(() => db.migrate.latest());
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

const newVehicle = { plate: 'abc-1d23', type: 'VAN', capacityKg: 1500, capacityM3: 8.5 };

describe('veículos da frota da transportadora', () => {
  it('should create a vehicle with normalized plate and status DISPONIVEL', async () => {
    const carrierId = await createCarrier(db);

    const response = await request(app).post(`/carriers/${carrierId}/vehicles`).send(newVehicle);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      carrierId,
      ownerDriverId: null,
      plate: 'ABC1D23',
      type: 'VAN',
      capacityKg: 1500,
      capacityM3: 8.5,
      status: 'DISPONIVEL',
    });
  });

  it('should list only the carrier own vehicles with pagination and status filter', async () => {
    const carrierId = await createCarrier(db);
    const otherCarrierId = await createCarrier(db);
    await createVehicle(db, { carrierId }, { plate: 'AAA1111' });
    await createVehicle(db, { carrierId }, { plate: 'BBB2222', status: 'MANUTENCAO' });
    await createVehicle(db, { carrierId }, { plate: 'CCC3333' });
    await createVehicle(db, { carrierId: otherCarrierId });

    const page = await request(app).get(`/carriers/${carrierId}/vehicles?limit=2&offset=1`);
    expect(page.status).toBe(200);
    expect(page.body.total).toBe(3);
    expect(page.body.items.map((v: { plate: string }) => v.plate)).toEqual(['BBB2222', 'CCC3333']);

    const inMaintenance = await request(app).get(
      `/carriers/${carrierId}/vehicles?status=MANUTENCAO`,
    );
    expect(inMaintenance.body.items).toHaveLength(1);
  });

  it('should not expose or change a vehicle from another carrier', async () => {
    const carrierId = await createCarrier(db);
    const otherCarrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId: otherCarrierId });
    const path = `/carriers/${carrierId}/vehicles/${vehicleId}`;

    expect((await request(app).get(path)).status).toBe(404);
    expect((await request(app).patch(path).send({ capacityKg: 10 })).status).toBe(404);
    expect((await request(app).delete(path)).status).toBe(404);
    expect((await request(app).patch(`${path}/status`).send({ status: 'MANUTENCAO' })).status).toBe(
      404,
    );
  });

  it('should return 409 for a plate already used by any owner', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db);
    await createVehicle(db, { ownerDriverId: driverId }, { plate: 'ABC1D23' });

    const response = await request(app).post(`/carriers/${carrierId}/vehicles`).send(newVehicle);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('should return 404 when the carrier does not exist or is a shipper company', async () => {
    const shipperId = await createShipper(db);
    const missing = '00000000-0000-4000-8000-000000000000';

    expect((await request(app).get(`/carriers/${missing}/vehicles`)).status).toBe(404);
    expect(
      (await request(app).post(`/carriers/${shipperId}/vehicles`).send(newVehicle)).status,
    ).toBe(404);
  });

  it('should return 400 for an invalid id in the path', async () => {
    const response = await request(app).get('/carriers/nao-e-uuid/vehicles');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should update vehicle fields but reject status through the generic update', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId });
    const path = `/carriers/${carrierId}/vehicles/${vehicleId}`;

    const updated = await request(app).patch(path).send({ plate: 'xyz9z99', capacityKg: 7000 });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ plate: 'XYZ9Z99', capacityKg: 7000 });

    expect((await request(app).patch(path).send({ status: 'MANUTENCAO' })).status).toBe(400);
  });
});

describe('status do veículo', () => {
  it('should switch between DISPONIVEL and MANUTENCAO', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/vehicles/${vehicleId}/status`)
      .send({ status: 'MANUTENCAO' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('MANUTENCAO');
  });

  it('should not allow setting EM_VIAGEM manually', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/vehicles/${vehicleId}/status`)
      .send({ status: 'EM_VIAGEM' });
    expect(response.status).toBe(400);
  });

  it('should return 409 when the vehicle is on a trip', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId }, { status: 'EM_VIAGEM' });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/vehicles/${vehicleId}/status`)
      .send({ status: 'MANUTENCAO' });
    expect(response.status).toBe(409);
  });
});

describe('remoção de veículo', () => {
  it('should delete an unused vehicle', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId });
    const path = `/carriers/${carrierId}/vehicles/${vehicleId}`;

    expect((await request(app).delete(path)).status).toBe(204);
    expect((await request(app).get(path)).status).toBe(404);
  });

  it('should return 409 for a vehicle on a trip', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId }, { status: 'EM_VIAGEM' });

    const response = await request(app).delete(`/carriers/${carrierId}/vehicles/${vehicleId}`);
    expect(response.status).toBe(409);
  });

  it('should return 409 for a vehicle already referenced by an offer', async () => {
    const carrierId = await createCarrier(db);
    const vehicleId = await createVehicle(db, { carrierId });
    const shipmentId = await createShipment(db, await createShipper(db));
    await createOffer(db, shipmentId, { carrierId }, { vehicleId });

    const response = await request(app).delete(`/carriers/${carrierId}/vehicles/${vehicleId}`);
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/MANUTENCAO/);
  });
});

describe('veículo próprio do motorista autônomo', () => {
  it('should create and list the autonomous driver vehicle', async () => {
    const driverId = await createDriver(db);

    const created = await request(app).post(`/drivers/${driverId}/vehicles`).send(newVehicle);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ carrierId: null, ownerDriverId: driverId });

    const list = await request(app).get(`/drivers/${driverId}/vehicles`);
    expect(list.body.items).toHaveLength(1);
  });

  it('should return 404 for a driver that belongs to a carrier', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId });

    const response = await request(app).post(`/drivers/${driverId}/vehicles`).send(newVehicle);
    expect(response.status).toBe(404);
  });

  it('should not expose a carrier vehicle through the autonomous route', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db);
    const vehicleId = await createVehicle(db, { carrierId });

    expect((await request(app).get(`/drivers/${driverId}/vehicles/${vehicleId}`)).status).toBe(404);
  });
});
