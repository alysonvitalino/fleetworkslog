// Fixtures inseridas direto no banco: o cadastro via API (signup) ainda não existe
import type { Knex } from 'knex';
import type { GeoPoint } from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';

export const SAO_PAULO: GeoPoint = { lat: -23.5505, lng: -46.6333 };
export const CAMPINAS: GeoPoint = { lat: -22.9056, lng: -47.0608 };
export const RIO_DE_JANEIRO: GeoPoint = { lat: -22.9068, lng: -43.1729 };
export const GUARULHOS: GeoPoint = { lat: -23.4538, lng: -46.5333 };

let sequence = 0;
const nextNumber = (length: number) => String(++sequence).padStart(length, '0');

export const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

async function insertUser(db: Knex, role: string): Promise<string> {
  const n = nextNumber(6);
  const [row] = await db('users')
    .insert({ name: `Usuário ${n}`, email: `user${n}@test.local`, role })
    .returning('id');
  return (row as { id: string }).id;
}

async function insertCompany(db: Knex, type: 'EMPRESA' | 'TRANSPORTADORA'): Promise<string> {
  const userId = await insertUser(db, type);
  const [row] = await db('companies')
    .insert({
      user_id: userId,
      type,
      legal_name: `${type} ${sequence} LTDA`,
      document: nextNumber(14),
      base_geo: type === 'TRANSPORTADORA' ? toGeography(db, SAO_PAULO) : null,
    })
    .returning('id');
  return (row as { id: string }).id;
}

export const createShipper = (db: Knex) => insertCompany(db, 'EMPRESA');
export const createCarrier = (db: Knex) => insertCompany(db, 'TRANSPORTADORA');

export async function createDriver(
  db: Knex,
  options: { carrierId?: string; status?: string } = {},
): Promise<string> {
  const userId = await insertUser(db, 'MOTORISTA');
  const [row] = await db('drivers')
    .insert({
      user_id: userId,
      carrier_id: options.carrierId ?? null,
      cnh_number: nextNumber(11),
      cnh_category: 'E',
      status: options.status ?? 'DISPONIVEL',
      // Autônomo precisa de endereço-base (matching de cargas por raio)
      base_geo: options.carrierId ? null : toGeography(db, CAMPINAS),
    })
    .returning('id');
  return (row as { id: string }).id;
}

export async function createVehicle(
  db: Knex,
  owner: { carrierId: string } | { ownerDriverId: string },
  options: { status?: string; plate?: string; type?: string; capacityKg?: number } = {},
): Promise<string> {
  const [row] = await db('vehicles')
    .insert({
      carrier_id: 'carrierId' in owner ? owner.carrierId : null,
      owner_driver_id: 'ownerDriverId' in owner ? owner.ownerDriverId : null,
      plate: options.plate ?? `TST${nextNumber(4)}`,
      type: options.type ?? 'TRUCK_TOCO',
      capacity_kg: options.capacityKg ?? 6000,
      capacity_m3: 30,
      status: options.status ?? 'DISPONIVEL',
    })
    .returning('id');
  return (row as { id: string }).id;
}

export async function createShipment(
  db: Knex,
  shipperId: string,
  options: {
    status?: string;
    origin?: GeoPoint;
    requiredVehicleType?: string;
    weightKg?: number;
  } = {},
): Promise<string> {
  const [row] = await db('shipments')
    .insert({
      shipper_id: shipperId,
      origin_address: 'Origem',
      origin_geo: toGeography(db, options.origin ?? SAO_PAULO),
      destination_address: 'Destino',
      destination_geo: toGeography(db, CAMPINAS),
      cargo_type: 'Carga geral',
      weight_kg: options.weightKg ?? 1000,
      volume_m3: 5,
      required_vehicle_type: options.requiredVehicleType ?? 'TRUCK_TOCO',
      pickup_window_start: inHours(24),
      pickup_window_end: inHours(28),
      delivery_deadline: inHours(48),
      price_offered: 2000,
      status: options.status ?? 'ABERTA',
    })
    .returning('id');
  return (row as { id: string }).id;
}

export async function createOffer(
  db: Knex,
  shipmentId: string,
  offerer: { carrierId: string } | { driverId: string; vehicleId: string },
  options: { status?: string; vehicleId?: string } = {},
): Promise<string> {
  const [row] = await db('shipment_offers')
    .insert({
      shipment_id: shipmentId,
      carrier_id: 'carrierId' in offerer ? offerer.carrierId : null,
      driver_id: 'driverId' in offerer ? offerer.driverId : null,
      vehicle_id: 'vehicleId' in offerer ? offerer.vehicleId : (options.vehicleId ?? null),
      price_proposed: 2000,
      status: options.status ?? 'PENDENTE',
    })
    .returning('id');
  return (row as { id: string }).id;
}
