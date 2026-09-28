// Valores de domínio compartilhados entre backend, web e mobile.
// Fonte: docs/02-modelo-de-dados.md e docs/08-precificacao.md.
//
// Usamos objetos `as const` + tipo união em vez de `enum` do TypeScript:
// não geram código extra em runtime e funcionam igual no Node, no Vite e no Metro.

type ValueOf<T> = T[keyof T];

export const Role = {
  ADMIN: 'ADMIN',
  OPERADOR: 'OPERADOR',
  EMPRESA: 'EMPRESA',
  TRANSPORTADORA: 'TRANSPORTADORA',
  MOTORISTA: 'MOTORISTA',
} as const;
export type Role = ValueOf<typeof Role>;

export const CompanyType = {
  EMPRESA: 'EMPRESA',
  TRANSPORTADORA: 'TRANSPORTADORA',
} as const;
export type CompanyType = ValueOf<typeof CompanyType>;

export const DriverStatus = {
  DISPONIVEL: 'DISPONIVEL',
  EM_VIAGEM: 'EM_VIAGEM',
  INDISPONIVEL: 'INDISPONIVEL',
} as const;
export type DriverStatus = ValueOf<typeof DriverStatus>;

// Lista inicial do doc de modelo de dados — completar quando os tipos de veículo forem fechados
export const VehicleType = {
  VAN: 'VAN',
  TRUCK_TOCO: 'TRUCK_TOCO',
  TRUCK_TRUCK: 'TRUCK_TRUCK',
  CARRETA: 'CARRETA',
} as const;
export type VehicleType = ValueOf<typeof VehicleType>;

export const VehicleStatus = {
  DISPONIVEL: 'DISPONIVEL',
  EM_VIAGEM: 'EM_VIAGEM',
  MANUTENCAO: 'MANUTENCAO',
} as const;
export type VehicleStatus = ValueOf<typeof VehicleStatus>;

export const ShipmentStatus = {
  ABERTA: 'ABERTA',
  ACEITA: 'ACEITA',
  EM_TRANSITO: 'EM_TRANSITO',
  ENTREGUE: 'ENTREGUE',
  CANCELADA: 'CANCELADA',
} as const;
export type ShipmentStatus = ValueOf<typeof ShipmentStatus>;

export const OfferStatus = {
  PENDENTE: 'PENDENTE',
  ACEITA: 'ACEITA',
  RECUSADA: 'RECUSADA',
  RETIRADA: 'RETIRADA',
  CANCELADA: 'CANCELADA',
} as const;
export type OfferStatus = ValueOf<typeof OfferStatus>;

// Atraso não é status: fica na flag `is_late` da entrega
export const DeliveryStatus = {
  COLETA_PENDENTE: 'COLETA_PENDENTE',
  COLETADO: 'COLETADO',
  EM_TRANSITO: 'EM_TRANSITO',
  ENTREGUE: 'ENTREGUE',
  CANCELADO: 'CANCELADO',
} as const;
export type DeliveryStatus = ValueOf<typeof DeliveryStatus>;

/**
 * Cria uma função que verifica se um valor desconhecido pertence ao conjunto.
 * Útil para validar dados vindos da API, do banco ou de eventos WebSocket.
 */
export function createValueGuard<T extends Record<string, string>>(values: T) {
  const allowed = new Set<string>(Object.values(values));
  return (value: unknown): value is ValueOf<T> => typeof value === 'string' && allowed.has(value);
}

export const isRole = createValueGuard(Role);
export const isOfferStatus = createValueGuard(OfferStatus);
export const isDeliveryStatus = createValueGuard(DeliveryStatus);
export const isShipmentStatus = createValueGuard(ShipmentStatus);
