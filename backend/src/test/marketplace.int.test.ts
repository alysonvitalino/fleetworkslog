// Regras do marketplace: cargas disponíveis, ofertas, decisão da empresa e atribuição
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  GUARULHOS,
  RIO_DE_JANEIRO,
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

const ids = (body: { items: { id: string }[] }) => body.items.map((item) => item.id);

describe('cargas disponíveis (PUTF-39)', () => {
  it('should only list open shipments inside the radius that some own vehicle fits', async () => {
    const shipperId = await createShipper(db);
    const carrierId = await createCarrier(db); // base em São Paulo
    await createVehicle(db, { carrierId }); // TRUCK_TOCO, 6000 kg

    const near = await createShipment(db, shipperId, { origin: GUARULHOS });
    const nearest = await createShipment(db, shipperId); // origem na própria base
    await createShipment(db, shipperId, { origin: RIO_DE_JANEIRO }); // ~360 km
    await createShipment(db, shipperId, { requiredVehicleType: 'CARRETA' });
    await createShipment(db, shipperId, { weightKg: 9000 });
    await createShipment(db, shipperId, { status: 'ACEITA' });

    const response = await request(app).get(`/carriers/${carrierId}/available-shipments`);

    expect(response.status).toBe(200);
    expect(ids(response.body)).toEqual([nearest, near]); // ordenado por distância
    expect(response.body.total).toBe(2);
  });

  it('should use lat/lng from the query as the search center', async () => {
    const shipperId = await createShipper(db);
    const carrierId = await createCarrier(db);
    await createVehicle(db, { carrierId });
    const inRio = await createShipment(db, shipperId, { origin: RIO_DE_JANEIRO });

    const response = await request(app).get(
      `/carriers/${carrierId}/available-shipments?lat=${RIO_DE_JANEIRO.lat}&lng=${RIO_DE_JANEIRO.lng}&radiusKm=20`,
    );
    expect(ids(response.body)).toEqual([inRio]);
  });

  it('should hide shipments where the offerer was already rejected', async () => {
    const shipperId = await createShipper(db);
    const carrierId = await createCarrier(db);
    await createVehicle(db, { carrierId });
    const shipmentId = await createShipment(db, shipperId);
    await createOffer(db, shipmentId, { carrierId }, { status: 'RECUSADA' });

    const response = await request(app).get(`/carriers/${carrierId}/available-shipments`);
    expect(response.body.items).toEqual([]);
  });
});

describe('ofertas (PUTF-40)', () => {
  it('should not accept offers on a shipment that is not ABERTA', async () => {
    const carrierId = await createCarrier(db);
    const shipmentId = await createShipment(db, await createShipper(db), { status: 'CANCELADA' });

    const response = await request(app)
      .post(`/carriers/${carrierId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 100 });
    expect(response.status).toBe(409);
  });

  it('should allow a new offer after withdrawing, but never two pending at once', async () => {
    const carrierId = await createCarrier(db);
    const shipmentId = await createShipment(db, await createShipper(db));
    const path = `/carriers/${carrierId}/shipments/${shipmentId}/offers`;

    const first = await request(app).post(path).send({ priceProposed: 1900 });
    expect((await request(app).post(path).send({ priceProposed: 1800 })).status).toBe(409);

    const withdrawn = await request(app).post(
      `/carriers/${carrierId}/offers/${first.body.id}/withdraw`,
    );
    expect(withdrawn.body.status).toBe('RETIRADA');
    expect((await request(app).post(path).send({ priceProposed: 1800 })).status).toBe(201);

    const again = await request(app).post(
      `/carriers/${carrierId}/offers/${first.body.id}/withdraw`,
    );
    expect(again.status).toBe(409);
  });

  it('should never allow a rejected offerer to offer again on the same shipment', async () => {
    const shipperId = await createShipper(db);
    const carrierId = await createCarrier(db);
    const shipmentId = await createShipment(db, shipperId);
    const offer = await request(app)
      .post(`/carriers/${carrierId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 5000 });

    const rejected = await request(app).post(
      `/companies/${shipperId}/shipments/${shipmentId}/offers/${offer.body.id}/reject`,
    );
    expect(rejected.body.status).toBe('RECUSADA');

    const retry = await request(app)
      .post(`/carriers/${carrierId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 2000 });
    expect(retry.status).toBe(409);
  });

  it('should require driver and vehicle together for a carrier offer', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId });
    const shipmentId = await createShipment(db, await createShipper(db));

    const response = await request(app)
      .post(`/carriers/${carrierId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 100, driverId });
    expect(response.status).toBe(400);
  });

  it('should reject resources from another carrier', async () => {
    const carrierId = await createCarrier(db);
    const otherCarrier = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId: otherCarrier });
    const vehicleId = await createVehicle(db, { carrierId: otherCarrier });
    const shipmentId = await createShipment(db, await createShipper(db));

    const response = await request(app)
      .post(`/carriers/${carrierId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 100, driverId, vehicleId });
    expect(response.status).toBe(404);
  });

  it('should reject an autonomous offer with a vehicle that does not fit the shipment', async () => {
    const driverId = await createDriver(db);
    const vehicleId = await createVehicle(db, { ownerDriverId: driverId }, { type: 'VAN' });
    const shipmentId = await createShipment(db, await createShipper(db));

    const response = await request(app)
      .post(`/drivers/${driverId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 100, vehicleId });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/TRUCK_TOCO/);
  });

  it('should list only the offerer own offers', async () => {
    const carrierId = await createCarrier(db);
    const shipmentId = await createShipment(db, await createShipper(db));
    await createOffer(db, shipmentId, { carrierId });
    await createOffer(db, shipmentId, { carrierId: await createCarrier(db) });

    const response = await request(app).get(`/carriers/${carrierId}/offers`);
    expect(response.body.total).toBe(1);
  });
});

describe('decisão da empresa (PUTF-41)', () => {
  it('should wait for a concurrent accept on the same shipment and then refuse', async () => {
    const shipperId = await createShipper(db);
    const shipmentId = await createShipment(db, shipperId);
    const offerId = await createOffer(db, shipmentId, { carrierId: await createCarrier(db) });

    // Simula outro aceite em andamento: uma transação segura o lock da carga
    const concurrent = await db.transaction();
    await concurrent('shipments').where({ id: shipmentId }).forUpdate().first('id');

    const acceptRequest = request(app)
      .post(`/companies/${shipperId}/shipments/${shipmentId}/offers/${offerId}/accept`)
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 300)); // o aceite chega ao lock e espera

    await concurrent('shipments').where({ id: shipmentId }).update({ status: 'ACEITA' });
    await concurrent.commit();

    const response = await acceptRequest;
    expect(response.status).toBe(409);
    expect(await db('deliveries').where({ shipment_id: shipmentId })).toHaveLength(0);
  });

  it('should not let a company decide on offers of another company shipment', async () => {
    const shipmentId = await createShipment(db, await createShipper(db));
    const offerId = await createOffer(db, shipmentId, { carrierId: await createCarrier(db) });
    const intruder = await createShipper(db);

    const response = await request(app).post(
      `/companies/${intruder}/shipments/${shipmentId}/offers/${offerId}/accept`,
    );
    expect(response.status).toBe(404);
  });
});

describe('atribuição de motorista e veículo (PUTF-42)', () => {
  async function acceptedCarrierOffer() {
    const shipperId = await createShipper(db);
    const carrierId = await createCarrier(db);
    const shipmentId = await createShipment(db, shipperId);
    const offerId = await createOffer(db, shipmentId, { carrierId });
    const accepted = await request(app).post(
      `/companies/${shipperId}/shipments/${shipmentId}/offers/${offerId}/accept`,
    );
    return { carrierId, offerId, deliveryId: accepted.body.id as string };
  }

  it('should require an available driver', async () => {
    const { carrierId, offerId } = await acceptedCarrierOffer();
    const driverId = await createDriver(db, { carrierId, status: 'INDISPONIVEL' });
    const vehicleId = await createVehicle(db, { carrierId });

    const response = await request(app)
      .put(`/carriers/${carrierId}/offers/${offerId}/assignment`)
      .send({ driverId, vehicleId });
    expect(response.status).toBe(409);
  });

  it('should not change the assignment after pickup', async () => {
    const { carrierId, offerId, deliveryId } = await acceptedCarrierOffer();
    const driverId = await createDriver(db, { carrierId });
    const vehicleId = await createVehicle(db, { carrierId });
    const path = `/carriers/${carrierId}/offers/${offerId}/assignment`;

    await request(app).put(path).send({ driverId, vehicleId });
    await request(app)
      .post(`/drivers/${driverId}/deliveries/${deliveryId}/status`)
      .send({ status: 'COLETADO' });

    const otherDriver = await createDriver(db, { carrierId });
    const otherVehicle = await createVehicle(db, { carrierId });
    const response = await request(app)
      .put(path)
      .send({ driverId: otherDriver, vehicleId: otherVehicle });
    expect(response.status).toBe(409);
  });
});
