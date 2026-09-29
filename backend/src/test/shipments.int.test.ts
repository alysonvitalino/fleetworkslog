import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCarrier,
  createDriver,
  createOffer,
  createShipment,
  createShipper,
  createVehicle,
  inHours,
} from './fixtures.js';
import { createTestContext, resetDatabase } from './setup-db.js';

const { db, app } = createTestContext();

beforeAll(() => db.migrate.latest());
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

const newShipment = () => ({
  origin: { address: 'Av. Paulista, 1000 - São Paulo/SP', lat: -23.5613, lng: -46.6565 },
  destination: { address: 'Rua XV de Novembro, 50 - Curitiba/PR', lat: -25.4284, lng: -49.2733 },
  cargoType: 'Eletrônicos',
  weightKg: 1200.5,
  volumeM3: 6.25,
  requiredVehicleType: 'TRUCK_TOCO',
  pickupWindowStart: inHours(24),
  pickupWindowEnd: inHours(28),
  deliveryDeadline: inHours(72),
  specialRequirements: 'Carga frágil',
  priceOffered: 3500.9,
});

describe('publicação de carga', () => {
  it('should create an ABERTA shipment keeping coordinates and numbers', async () => {
    const shipperId = await createShipper(db);
    const body = newShipment();

    const response = await request(app).post(`/companies/${shipperId}/shipments`).send(body);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      shipperId,
      status: 'ABERTA',
      origin: body.origin,
      destination: body.destination,
      weightKg: 1200.5,
      volumeM3: 6.25,
      priceOffered: 3500.9,
      specialRequirements: 'Carga frágil',
    });
    expect(response.body.pickupWindowStart).toBe(new Date(body.pickupWindowStart).toISOString());
  });

  it('should reject an incoherent schedule with the field path', async () => {
    const shipperId = await createShipper(db);

    const response = await request(app)
      .post(`/companies/${shipperId}/shipments`)
      .send({ ...newShipment(), deliveryDeadline: inHours(12) });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toEqual(['deliveryDeadline']);
  });

  it('should return 404 when the company is a carrier and not a shipper', async () => {
    const carrierId = await createCarrier(db);

    const response = await request(app)
      .post(`/companies/${carrierId}/shipments`)
      .send(newShipment());
    expect(response.status).toBe(404);
  });
});

describe('consulta de cargas', () => {
  it('should list only own shipments, newest first, with status filter', async () => {
    const shipperId = await createShipper(db);
    const first = await createShipment(db, shipperId);
    const second = await createShipment(db, shipperId, { status: 'CANCELADA' });
    await createShipment(db, await createShipper(db));

    const all = await request(app).get(`/companies/${shipperId}/shipments`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items.map((s: { id: string }) => s.id)).toEqual([second, first]);

    const open = await request(app).get(`/companies/${shipperId}/shipments?status=ABERTA`);
    expect(open.body.items.map((s: { id: string }) => s.id)).toEqual([first]);
  });

  it('should return 404 for a shipment of another company', async () => {
    const shipperId = await createShipper(db);
    const otherShipment = await createShipment(db, await createShipper(db));

    const response = await request(app).get(`/companies/${shipperId}/shipments/${otherShipment}`);
    expect(response.status).toBe(404);
  });
});

describe('edição de carga', () => {
  it('should update fields of an ABERTA shipment', async () => {
    const shipperId = await createShipper(db);
    const shipmentId = await createShipment(db, shipperId);
    const destination = { address: 'Santos/SP', lat: -23.9608, lng: -46.3336 };

    const response = await request(app)
      .patch(`/companies/${shipperId}/shipments/${shipmentId}`)
      .send({ priceOffered: 2500, destination, specialRequirements: null });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      priceOffered: 2500,
      destination,
      specialRequirements: null,
    });
  });

  it('should validate new dates against the stored ones', async () => {
    const shipperId = await createShipper(db);
    const shipmentId = await createShipment(db, shipperId); // coleta começa em +24h

    const response = await request(app)
      .patch(`/companies/${shipperId}/shipments/${shipmentId}`)
      .send({ deliveryDeadline: inHours(10) });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path).toEqual(['deliveryDeadline']);
  });

  it('should return 409 when the shipment is no longer ABERTA', async () => {
    const shipperId = await createShipper(db);
    const shipmentId = await createShipment(db, shipperId, { status: 'ACEITA' });

    const response = await request(app)
      .patch(`/companies/${shipperId}/shipments/${shipmentId}`)
      .send({ priceOffered: 100 });
    expect(response.status).toBe(409);
  });
});

describe('cancelamento de carga', () => {
  it('should cancel the shipment and only its PENDENTE offers', async () => {
    const shipperId = await createShipper(db);
    const shipmentId = await createShipment(db, shipperId);
    const driverId = await createDriver(db);
    const vehicleId = await createVehicle(db, { ownerDriverId: driverId });
    const pendingOffer = await createOffer(db, shipmentId, { carrierId: await createCarrier(db) });
    const rejectedOffer = await createOffer(
      db,
      shipmentId,
      { driverId, vehicleId },
      { status: 'RECUSADA' },
    );

    const response = await request(app).post(
      `/companies/${shipperId}/shipments/${shipmentId}/cancel`,
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('CANCELADA');
    const offers = await db('shipment_offers').select('id', 'status');
    expect(Object.fromEntries(offers.map((o) => [o.id, o.status]))).toEqual({
      [pendingOffer]: 'CANCELADA',
      [rejectedOffer]: 'RECUSADA',
    });
  });

  it('should return 409 for an accepted or already cancelled shipment', async () => {
    const shipperId = await createShipper(db);
    const accepted = await createShipment(db, shipperId, { status: 'ACEITA' });
    const cancelled = await createShipment(db, shipperId, { status: 'CANCELADA' });

    for (const shipmentId of [accepted, cancelled]) {
      const response = await request(app).post(
        `/companies/${shipperId}/shipments/${shipmentId}/cancel`,
      );
      expect(response.status).toBe(409);
    }
  });
});
