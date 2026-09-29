import type { Knex } from 'knex';
import type { GeoPoint } from '@fleetworkslog/shared';

// PostGIS recebe (longitude, latitude) — a ordem é invertida em relação ao que a API expõe
export function toGeography(db: Knex, point: GeoPoint): Knex.Raw {
  return db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [point.lng, point.lat]);
}

/** Colunas `<alias>_lat` e `<alias>_lng` extraídas de uma coluna GEOGRAPHY(Point). */
export function selectLatLng(db: Knex, column: string, alias: string): Knex.Raw[] {
  return [
    db.raw('ST_Y(??::geometry) AS ??', [column, `${alias}_lat`]),
    db.raw('ST_X(??::geometry) AS ??', [column, `${alias}_lng`]),
  ];
}
