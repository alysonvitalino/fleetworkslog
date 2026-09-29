// Regras garantidas pelo próprio banco (CHECK e índices únicos), independente da API
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toGeography } from '../db/geo.js';
import {
  SAO_PAULO,
  createCarrier,
  createDriver,
  createOffer,
  createShipment,
  createShipper,
  createVehicle,
  inHours,
} from './fixtures.js';
import { createTestContext, resetDatabase } from './setup-db.js';

const { db } = createTestContext();

beforeAll(() => db.migrate.latest());
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

async function newUserId(role: string) {
  const [row] = await db('users')
    .insert({ name: 'X', email: `${crypto.randomUUID()}@test.local`, role })
    .returning('id');
  return (row as { id: string }).id;
}

describe('users', () => {
  it('should treat e-mails with different casing as duplicates', async () => {
    await db('users').insert({ name: 'A', email: 'Joao@Test.local', role: 'EMPRESA' });
    await expect(
      db('users').insert({ name: 'B', email: 'joao@test.local', role: 'EMPRESA' }),
    ).rejects.toMatchObject({ code: '23505' });
  });
});

describe('companies e drivers', () => {
  it('should require base_geo for a carrier', async () => {
    const userId = await newUserId('TRANSPORTADORA');
    await expect(
      db('companies').insert({
        user_id: userId,
        type: 'TRANSPORTADORA',
        legal_name: 'Sem base',
        document: '12345678000199',
      }),
    ).rejects.toMatchObject({ constraint: 'companies_carrier_requires_base_geo' });
  });

  it('should require base_geo for an autonomous driver', async () => {
    const userId = await newUserId('MOTORISTA');
    await expect(
      db('drivers').insert({ user_id: userId, cnh_number: '12345678901', cnh_category: 'B' }),
    ).rejects.toMatchObject({ constraint: 'drivers_autonomous_requires_base_geo' });
  });
});

describe('vehicles', () => {
  it('should require exactly one owner', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db);
    const base = { plate: 'ABC1234', type: 'VAN', capacity_kg: 1, capacity_m3: 1 };

    await expect(db('vehicles').insert(base)).rejects.toMatchObject({
      constraint: 'vehicles_exactly_one_owner',
    });
    await expect(
      db('vehicles').insert({ ...base, carrier_id: carrierId, owner_driver_id: driverId }),
    ).rejects.toMatchObject({ constraint: 'vehicles_exactly_one_owner' });
  });
});

describe('shipments', () => {
  it('should reject a delivery deadline before the pickup window starts', async () => {
    const shipperId = await createShipper(db);
    await expect(
      db('shipments').insert({
        shipper_id: shipperId,
        origin_address: 'A',
        origin_geo: toGeography(db, SAO_PAULO),
        destination_address: 'B',
        destination_geo: toGeography(db, SAO_PAULO),
        cargo_type: 'X',
        weight_kg: 1,
        volume_m3: 1,
        required_vehicle_type: 'VAN',
        pickup_window_start: inHours(24),
        pickup_window_end: inHours(26),
        delivery_deadline: inHours(20),
        price_offered: 1,
      }),
    ).rejects.toMatchObject({ constraint: 'shipments_deadline_after_pickup' });
  });
});

describe('shipment_offers', () => {
  it('should require driver and vehicle when an autonomous driver offers', async () => {
    const shipmentId = await createShipment(db, await createShipper(db));
    const driverId = await createDriver(db);
    await expect(
      db('shipment_offers').insert({
        shipment_id: shipmentId,
        driver_id: driverId,
        price_proposed: 100,
      }),
    ).rejects.toMatchObject({
      constraint: 'shipment_offers_autonomous_requires_driver_and_vehicle',
    });
  });

  it('should allow only one PENDENTE offer per carrier and shipment', async () => {
    const shipmentId = await createShipment(db, await createShipper(db));
    const carrierId = await createCarrier(db);
    const firstOffer = await createOffer(db, shipmentId, { carrierId });

    await expect(createOffer(db, shipmentId, { carrierId })).rejects.toMatchObject({
      constraint: 'shipment_offers_one_pending_per_carrier',
    });

    // Depois de retirar a oferta, o mesmo ofertante pode ofertar de novo (docs/08-precificacao.md)
    await db('shipment_offers').where({ id: firstOffer }).update({ status: 'RETIRADA' });
    await expect(createOffer(db, shipmentId, { carrierId })).resolves.toBeTypeOf('string');
  });

  it('should allow only one PENDENTE offer per autonomous driver and shipment', async () => {
    const shipmentId = await createShipment(db, await createShipper(db));
    const driverId = await createDriver(db);
    const vehicleId = await createVehicle(db, { ownerDriverId: driverId });
    await createOffer(db, shipmentId, { driverId, vehicleId });

    await expect(createOffer(db, shipmentId, { driverId, vehicleId })).rejects.toMatchObject({
      constraint: 'shipment_offers_one_pending_per_autonomous',
    });
  });
});
