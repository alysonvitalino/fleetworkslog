// Dados de desenvolvimento — `npm run db:seed`.
// IDs fixos para a collection do Postman (e quem testar à mão) apontar sempre para os mesmos
// registros. Idempotente: rodar de novo recoloca tudo no estado inicial (upsert por ID).
import type { Knex } from 'knex';
import { hashPassword } from '../../lib/password.js';

/** Senha de todos os usuários de desenvolvimento. */
export const SEED_PASSWORD = 'dev12345';

export const SEED_IDS = {
  users: {
    admin: '00000000-0000-4000-8000-000000000001',
    operator: '00000000-0000-4000-8000-000000000002',
    shipper: '00000000-0000-4000-8000-000000000003',
    carrierA: '00000000-0000-4000-8000-000000000004',
    carrierB: '00000000-0000-4000-8000-000000000005',
    carrierDriver: '00000000-0000-4000-8000-000000000006',
    autonomousDriver: '00000000-0000-4000-8000-000000000007',
  },
  shipper: '11111111-1111-4111-8111-111111111111',
  carrierA: '22222222-2222-4222-8222-222222222222',
  carrierB: '22222222-2222-4222-8222-333333333333',
  carrierDriver: '33333333-3333-4333-8333-333333333333',
  autonomousDriver: '44444444-4444-4444-8444-444444444444',
  carrierVehicle: '55555555-5555-4555-8555-555555555555',
  carrierBVehicle: '55555555-5555-4555-8555-666666666666',
  autonomousVehicle: '66666666-6666-4666-8666-666666666666',
  openShipment: '77777777-7777-4777-8777-777777777777',
  cancelledShipment: '77777777-7777-4777-8777-888888888888',
  pendingOffer: '88888888-8888-4888-8888-888888888888',
} as const;

const point = (knex: Knex, lat: number, lng: number) =>
  knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [lng, lat]);

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000);

async function upsert(knex: Knex, table: string, rows: Record<string, unknown>[]) {
  await knex(table).insert(rows).onConflict('id').merge();
}

export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed de desenvolvimento não roda em produção');
  }
  const ids = SEED_IDS;
  const now = knex.fn.now();

  // Todos os perfis, com a mesma senha de desenvolvimento
  const passwordHash = await hashPassword(SEED_PASSWORD);
  await upsert(
    knex,
    'users',
    [
      { id: ids.users.admin, name: 'Admin Dev', email: 'admin@dev.local', role: 'ADMIN' },
      {
        id: ids.users.operator,
        name: 'Operador Dev',
        email: 'operador@dev.local',
        role: 'OPERADOR',
      },
      {
        id: ids.users.shipper,
        name: 'Ana Embarcadora',
        email: 'empresa@dev.local',
        role: 'EMPRESA',
      },
      {
        id: ids.users.carrierA,
        name: 'Carlos Transportes',
        email: 'transportadora.a@dev.local',
        role: 'TRANSPORTADORA',
      },
      {
        id: ids.users.carrierB,
        name: 'Bruna Logística',
        email: 'transportadora.b@dev.local',
        role: 'TRANSPORTADORA',
      },
      {
        id: ids.users.carrierDriver,
        name: 'Diego Motorista',
        email: 'motorista.frota@dev.local',
        role: 'MOTORISTA',
      },
      {
        id: ids.users.autonomousDriver,
        name: 'Elisa Autônoma',
        email: 'motorista.autonomo@dev.local',
        role: 'MOTORISTA',
      },
    ].map((user) => ({
      ...user,
      password_hash: passwordHash,
      disabled_at: null,
      updated_at: now,
    })),
  );

  await upsert(
    knex,
    'companies',
    [
      {
        id: ids.shipper,
        user_id: ids.users.shipper,
        type: 'EMPRESA',
        legal_name: 'Embarcadora Dev LTDA',
        document: '11111111000111',
        address_json: null,
        base_geo: null,
      },
      {
        id: ids.carrierA,
        user_id: ids.users.carrierA,
        type: 'TRANSPORTADORA',
        legal_name: 'Transportadora A Dev LTDA',
        document: '22222222000122',
        address_json: JSON.stringify({
          address: 'Rua da Consolação, 100 - São Paulo/SP',
          lat: -23.5505,
          lng: -46.6333,
        }),
        base_geo: point(knex, -23.5505, -46.6333),
      },
      {
        id: ids.carrierB,
        user_id: ids.users.carrierB,
        type: 'TRANSPORTADORA',
        legal_name: 'Transportadora B Dev LTDA',
        document: '33333333000133',
        address_json: JSON.stringify({
          address: 'Centro - Guarulhos/SP',
          lat: -23.4538,
          lng: -46.5333,
        }),
        base_geo: point(knex, -23.4538, -46.5333),
      },
    ].map((company) => ({ ...company, updated_at: now })),
  );

  await upsert(
    knex,
    'drivers',
    [
      {
        id: ids.carrierDriver,
        user_id: ids.users.carrierDriver,
        carrier_id: ids.carrierA,
        cnh_number: '11111111111',
        cnh_category: 'E',
        base_address: null,
        base_geo: null,
      },
      {
        id: ids.autonomousDriver,
        user_id: ids.users.autonomousDriver,
        carrier_id: null,
        cnh_number: '22222222222',
        cnh_category: 'C',
        base_address: 'Centro - Campinas/SP',
        base_geo: point(knex, -22.9056, -47.0608),
      },
    ].map((driver) => ({ ...driver, status: 'DISPONIVEL', updated_at: now })),
  );

  const truck = { type: 'TRUCK_TOCO', capacity_kg: 6000, capacity_m3: 30 };
  await upsert(
    knex,
    'vehicles',
    [
      {
        id: ids.carrierVehicle,
        carrier_id: ids.carrierA,
        owner_driver_id: null,
        plate: 'FWL1A01',
        ...truck,
      },
      {
        id: ids.carrierBVehicle,
        carrier_id: ids.carrierB,
        owner_driver_id: null,
        plate: 'FWL1A02',
        ...truck,
      },
      {
        id: ids.autonomousVehicle,
        carrier_id: null,
        owner_driver_id: ids.autonomousDriver,
        plate: 'FWL1A03',
        ...truck,
      },
    ].map((vehicle) => ({ ...vehicle, status: 'DISPONIVEL', updated_at: now })),
  );

  // Motorista e veículo voltaram a DISPONIVEL acima: fecha vínculos que ficaram abertos
  await knex('driver_vehicles')
    .whereIn('driver_id', [ids.carrierDriver, ids.autonomousDriver])
    .whereNull('ended_at')
    .update({ ended_at: now });

  // Cargas em status diferentes; janelas sempre no futuro a cada execução
  const shipment = {
    shipper_id: ids.shipper,
    origin_address: 'Av. Paulista, 1000 - São Paulo/SP',
    origin_geo: point(knex, -23.5613, -46.6565),
    destination_address: 'Av. Brasil, 500 - Campinas/SP',
    destination_geo: point(knex, -22.9056, -47.0608),
    cargo_type: 'Eletrônicos',
    weight_kg: 1200,
    volume_m3: 6,
    required_vehicle_type: 'TRUCK_TOCO',
    pickup_window_start: inHours(24),
    pickup_window_end: inHours(28),
    delivery_deadline: inHours(72),
    special_requirements: 'Carga frágil',
    price_offered: 3000,
    updated_at: now,
  };
  await upsert(knex, 'shipments', [
    { id: ids.openShipment, ...shipment, status: 'ABERTA' },
    { id: ids.cancelledShipment, ...shipment, cargo_type: 'Móveis', status: 'CANCELADA' },
  ]);

  // Uma contraproposta pendente da transportadora B na carga aberta
  await upsert(knex, 'shipment_offers', [
    {
      id: ids.pendingOffer,
      shipment_id: ids.openShipment,
      carrier_id: ids.carrierB,
      driver_id: null,
      vehicle_id: null,
      price_proposed: 2750,
      status: 'PENDENTE',
      updated_at: now,
    },
  ]);
}
