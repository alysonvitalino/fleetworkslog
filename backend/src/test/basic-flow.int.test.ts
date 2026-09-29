// Fluxo básico do MVP ponta a ponta, só pela API (docs/03-mvp.md — objetivo do MVP):
// empresa publica carga → transportadora/autônomo aceita o preço ou contrapropõe →
// empresa aceita → motorista coleta, transporta e entrega.
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCarrier, createDriver, createShipper, createVehicle, inHours } from './fixtures.js';
import { createTestContext, resetDatabase } from './setup-db.js';

const { db, app } = createTestContext();

beforeAll(() => db.migrate.latest());
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

const shipmentBody = () => ({
  origin: { address: 'Av. Paulista, 1000 - São Paulo/SP', lat: -23.5613, lng: -46.6565 },
  destination: { address: 'Av. Brasil, 500 - Campinas/SP', lat: -22.9056, lng: -47.0608 },
  cargoType: 'Eletrônicos',
  weightKg: 1200,
  volumeM3: 6,
  requiredVehicleType: 'TRUCK_TOCO',
  pickupWindowStart: inHours(24),
  pickupWindowEnd: inHours(28),
  deliveryDeadline: inHours(72),
  priceOffered: 3000,
});

async function publishShipment(shipperId: string): Promise<string> {
  const response = await request(app)
    .post(`/companies/${shipperId}/shipments`)
    .send(shipmentBody());
  expect(response.status).toBe(201);
  return response.body.id;
}

describe('fluxo básico com transportadora e contraproposta', () => {
  it('should go from published shipment to delivered', async () => {
    const shipperId = await createShipper(db);
    const carrierA = await createCarrier(db);
    const carrierB = await createCarrier(db);
    const driverA = await createDriver(db, { carrierId: carrierA });
    const vehicleA = await createVehicle(db, { carrierId: carrierA });
    await createVehicle(db, { carrierId: carrierB });

    // 1. Empresa publica a carga
    const shipmentId = await publishShipment(shipperId);

    // 2. As transportadoras encontram a carga na busca por raio a partir da base
    const available = await request(app).get(`/carriers/${carrierA}/available-shipments`);
    expect(available.status).toBe(200);
    expect(available.body.items.map((s: { id: string }) => s.id)).toEqual([shipmentId]);
    expect(available.body.items[0]).not.toHaveProperty('shipperId');

    // 3. A contrapropõe (sem definir motorista ainda); B aceita o preço sugerido
    const counter = await request(app)
      .post(`/carriers/${carrierA}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 2800 });
    expect(counter.status).toBe(201);
    expect(counter.body).toMatchObject({
      status: 'PENDENTE',
      isCounterProposal: true,
      assignmentPending: true,
    });

    const acceptPrice = await request(app)
      .post(`/carriers/${carrierB}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 3000 });
    expect(acceptPrice.body).toMatchObject({ status: 'PENDENTE', isCounterProposal: false });

    // 4. Empresa compara as ofertas e aceita a contraproposta de A
    const offers = await request(app).get(`/companies/${shipperId}/shipments/${shipmentId}/offers`);
    expect(offers.body.total).toBe(2);

    const accepted = await request(app).post(
      `/companies/${shipperId}/shipments/${shipmentId}/offers/${counter.body.id}/accept`,
    );
    expect(accepted.status).toBe(201);
    expect(accepted.body).toMatchObject({ status: 'COLETA_PENDENTE', driverId: null });
    const deliveryId = accepted.body.id;

    const offersAfter = await request(app).get(
      `/companies/${shipperId}/shipments/${shipmentId}/offers`,
    );
    expect(
      Object.fromEntries(
        offersAfter.body.items.map((o: { id: string; status: string }) => [o.id, o.status]),
      ),
    ).toEqual({ [counter.body.id]: 'ACEITA', [acceptPrice.body.id]: 'CANCELADA' });

    // 5. Sem motorista atribuído, a entrega ainda não aparece para ninguém transportar
    const beforeAssignment = await request(app).get(`/drivers/${driverA}/deliveries`);
    expect(beforeAssignment.body.items).toEqual([]);

    // 6. Transportadora atribui motorista e veículo
    const assignment = await request(app)
      .put(`/carriers/${carrierA}/offers/${counter.body.id}/assignment`)
      .send({ driverId: driverA, vehicleId: vehicleA });
    expect(assignment.status).toBe(200);
    expect(assignment.body.assignmentPending).toBe(false);

    const assigned = await request(app).get(`/drivers/${driverA}/deliveries`);
    expect(assigned.body.items).toHaveLength(1);
    expect(assigned.body.items[0].shipment.origin.address).toContain('Paulista');

    // 7. Motorista coleta: ele e o veículo ficam EM_VIAGEM
    const statusPath = `/drivers/${driverA}/deliveries/${deliveryId}/status`;
    const pickedUp = await request(app).post(statusPath).send({ status: 'COLETADO' });
    expect(pickedUp.status).toBe(200);
    expect(pickedUp.body.pickedUpAt).not.toBeNull();
    expect(await db('drivers').where({ id: driverA }).first('status')).toEqual({
      status: 'EM_VIAGEM',
    });
    expect(await db('vehicles').where({ id: vehicleA }).first('status')).toEqual({
      status: 'EM_VIAGEM',
    });

    // 8. Transporte inicia: a carga passa a EM_TRANSITO
    const inTransit = await request(app).post(statusPath).send({ status: 'EM_TRANSITO' });
    expect(inTransit.body.status).toBe('EM_TRANSITO');
    expect(inTransit.body.shipment.status).toBe('EM_TRANSITO');

    // 9. Entrega: carga ENTREGUE e motorista/veículo liberados
    const delivered = await request(app)
      .post(statusPath)
      .send({ status: 'ENTREGUE', note: 'Recebido pela portaria' });
    expect(delivered.body).toMatchObject({ status: 'ENTREGUE' });
    expect(delivered.body.shipment.status).toBe('ENTREGUE');
    expect(await db('drivers').where({ id: driverA }).first('status')).toEqual({
      status: 'DISPONIVEL',
    });
    expect(await db('vehicles').where({ id: vehicleA }).first('status')).toEqual({
      status: 'DISPONIVEL',
    });
    const history = await db('driver_vehicles').where({ driver_id: driverA });
    expect(history).toHaveLength(1);
    expect(history[0].ended_at).not.toBeNull();

    // 10. Empresa vê a linha do tempo completa da entrega
    const detail = await request(app).get(`/companies/${shipperId}/deliveries/${deliveryId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.events.map((e: { status: string }) => e.status)).toEqual([
      'COLETA_PENDENTE',
      'COLETADO',
      'EM_TRANSITO',
      'ENTREGUE',
    ]);
    expect(detail.body.events[3].note).toBe('Recebido pela portaria');

    // Fora das cargas disponíveis depois de aceita
    const availableAfter = await request(app).get(`/carriers/${carrierB}/available-shipments`);
    expect(availableAfter.body.items).toEqual([]);
  });
});

describe('fluxo básico com motorista autônomo', () => {
  it('should let an autonomous driver accept the price and deliver the shipment', async () => {
    const shipperId = await createShipper(db);
    const driverId = await createDriver(db); // base em Campinas, ~85 km da origem
    const vehicleId = await createVehicle(db, { ownerDriverId: driverId });
    const shipmentId = await publishShipment(shipperId);

    const available = await request(app).get(`/drivers/${driverId}/available-shipments`);
    expect(available.body.items[0]).toMatchObject({ id: shipmentId });
    expect(available.body.items[0].distanceKm).toBeGreaterThan(50);

    const offer = await request(app)
      .post(`/drivers/${driverId}/shipments/${shipmentId}/offers`)
      .send({ priceProposed: 3000, vehicleId });
    expect(offer.status).toBe(201);
    expect(offer.body).toMatchObject({
      carrierId: null,
      driverId,
      vehicleId,
      assignmentPending: false,
    });

    const accepted = await request(app).post(
      `/companies/${shipperId}/shipments/${shipmentId}/offers/${offer.body.id}/accept`,
    );
    const deliveryId = accepted.body.id;
    expect(accepted.body).toMatchObject({ driverId, vehicleId });

    const statusPath = `/drivers/${driverId}/deliveries/${deliveryId}/status`;
    for (const status of ['COLETADO', 'EM_TRANSITO', 'ENTREGUE']) {
      const response = await request(app).post(statusPath).send({ status });
      expect(response.status, status).toBe(200);
    }

    const shipment = await request(app).get(`/companies/${shipperId}/shipments/${shipmentId}`);
    expect(shipment.body.status).toBe('ENTREGUE');
  });
});
