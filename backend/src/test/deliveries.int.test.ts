// Máquina de estados da entrega e cancelamento (PUTF-45, PUTF-46)
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
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

/** Carga aceita de um motorista autônomo, pronta para coletar. */
async function acceptedDelivery() {
  const shipperId = await createShipper(db);
  const driverId = await createDriver(db);
  const vehicleId = await createVehicle(db, { ownerDriverId: driverId });
  const shipmentId = await createShipment(db, shipperId);
  const offerId = await createOffer(db, shipmentId, { driverId, vehicleId });
  const accepted = await request(app).post(
    `/companies/${shipperId}/shipments/${shipmentId}/offers/${offerId}/accept`,
  );
  const deliveryId = accepted.body.id as string;
  const advance = (status: string) =>
    request(app).post(`/drivers/${driverId}/deliveries/${deliveryId}/status`).send({ status });
  return { shipperId, driverId, vehicleId, shipmentId, offerId, deliveryId, advance };
}

describe('máquina de estados da entrega', () => {
  it('should not skip steps', async () => {
    const { advance } = await acceptedDelivery();

    const response = await advance('EM_TRANSITO');
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/próximo passo: COLETADO/);
  });

  it('should not move a delivered shipment again', async () => {
    const { advance } = await acceptedDelivery();
    for (const status of ['COLETADO', 'EM_TRANSITO', 'ENTREGUE']) await advance(status);

    expect((await advance('ENTREGUE')).status).toBe(409);
  });

  it('should hide the delivery from another driver', async () => {
    const { deliveryId } = await acceptedDelivery();
    const otherDriver = await createDriver(db);

    const response = await request(app)
      .post(`/drivers/${otherDriver}/deliveries/${deliveryId}/status`)
      .send({ status: 'COLETADO' });
    expect(response.status).toBe(404);
  });

  it('should block pickup when the vehicle is already on another trip', async () => {
    const { vehicleId, advance } = await acceptedDelivery();
    await db('vehicles').where({ id: vehicleId }).update({ status: 'EM_VIAGEM' });

    expect((await advance('COLETADO')).status).toBe(409);
  });

  it('should record who set each status with the note', async () => {
    const { deliveryId } = await acceptedDelivery();
    const events = await db('delivery_status_events').where({ delivery_id: deliveryId });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: 'COLETA_PENDENTE', note: 'Oferta aceita' });
  });
});

describe('cancelamento da entrega pela empresa', () => {
  it('should reopen the shipment and release driver and vehicle after pickup', async () => {
    const { shipperId, driverId, vehicleId, shipmentId, offerId, deliveryId, advance } =
      await acceptedDelivery();
    await advance('COLETADO');

    const response = await request(app)
      .post(`/companies/${shipperId}/deliveries/${deliveryId}/cancel`)
      .send({ note: 'Carga não estava pronta' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'CANCELADO' });
    expect(response.body.cancelledAt).not.toBeNull();
    expect(response.body.shipment.status).toBe('ABERTA');
    expect(await db('shipment_offers').where({ id: offerId }).first('status')).toEqual({
      status: 'CANCELADA',
    });
    expect(await db('drivers').where({ id: driverId }).first('status')).toEqual({
      status: 'DISPONIVEL',
    });
    expect(await db('vehicles').where({ id: vehicleId }).first('status')).toEqual({
      status: 'DISPONIVEL',
    });

    // Quem teve a oferta cancelada pode ofertar de novo, e a carga pode gerar nova entrega
    const reOffer = await request(app)
      .post(`/drivers/${driverId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 2100, vehicleId });
    expect(reOffer.status).toBe(201);
    const reAccepted = await request(app).post(
      `/companies/${shipperId}/shipments/${shipmentId}/offers/${reOffer.body.id}/accept`,
    );
    expect(reAccepted.status).toBe(201);
  });

  it('should not release resources that were never taken', async () => {
    const { shipperId, driverId, deliveryId } = await acceptedDelivery();
    // O motorista está em outra viagem, mas ainda não coletou esta carga
    await db('drivers').where({ id: driverId }).update({ status: 'EM_VIAGEM' });

    await request(app).post(`/companies/${shipperId}/deliveries/${deliveryId}/cancel`);

    expect(await db('drivers').where({ id: driverId }).first('status')).toEqual({
      status: 'EM_VIAGEM',
    });
  });

  it('should not cancel a delivered shipment', async () => {
    const { shipperId, deliveryId, advance } = await acceptedDelivery();
    for (const status of ['COLETADO', 'EM_TRANSITO', 'ENTREGUE']) await advance(status);

    const response = await request(app).post(
      `/companies/${shipperId}/deliveries/${deliveryId}/cancel`,
    );
    expect(response.status).toBe(409);
  });

  it('should not let another company cancel the delivery', async () => {
    const { deliveryId } = await acceptedDelivery();
    const intruder = await createShipper(db);

    const response = await request(app).post(
      `/companies/${intruder}/deliveries/${deliveryId}/cancel`,
    );
    expect(response.status).toBe(404);
  });
});
