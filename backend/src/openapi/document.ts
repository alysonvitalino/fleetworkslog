import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z, type ZodObject, type ZodType } from 'zod';
import {
  createCarrierDriverSchema,
  listDriversQuerySchema,
  replaceCarrierDriverSchema,
  signupAutonomousDriverSchema,
  signupCarrierSchema,
  signupShipperSchema,
  updateAutonomousDriverSchema,
  updateCarrierDriverSchema,
  updateCompanySchema,
} from '../schemas/account.schema.js';
import { uuidSchema } from '../schemas/common.schema.js';
import { cancelDeliverySchema, updateDeliveryStatusSchema } from '../schemas/delivery.schema.js';
import {
  availableShipmentsQuerySchema,
  createAutonomousOfferSchema,
  createCarrierOfferSchema,
  listOffersQuerySchema,
  offerAssignmentSchema,
} from '../schemas/marketplace.schema.js';
import {
  createShipmentSchema,
  listShipmentsQuerySchema,
  replaceShipmentSchema,
  updateShipmentSchema,
} from '../schemas/shipment.schema.js';
import {
  createVehicleSchema,
  listVehiclesQuerySchema,
  replaceVehicleSchema,
  updateDriverStatusSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
} from '../schemas/vehicle.schema.js';

// O contrato é gerado a partir dos mesmos schemas zod que validam as requests:
// mudou a validação, a documentação acompanha. As respostas ainda não têm schema zod
// (os tipos de resposta vivem em @fleetworkslog/shared), então são descritas só por status.

// Espelha ApiErrorBody de @fleetworkslog/shared.
// Entra em components/schemas pelo `.meta({ id })`, sem precisar de registry.register()
const apiErrorSchema = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      requestId: z.string().optional(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ApiError' });

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteDoc {
  method: HttpMethod;
  // Path no formato do Express (:param); convertido para {param} no contrato
  path: string;
  tag: string;
  summary: string;
  description?: string;
  body?: ZodType;
  // Exemplo que passa na validação do `body` (garantido pelo document.test.ts)
  bodyExample?: unknown;
  query?: ZodObject;
  successStatus?: 200 | 201 | 204;
  // Quando a rota pode devolver 409: em que situação isso acontece
  conflict?: string;
  // Respostas fora do padrão (ex.: 503 do /health)
  extraResponses?: Record<number, string>;
}

/** Converte /carriers/:carrierId para /carriers/{carrierId}. */
export function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:(\w+)/g, '{$1}');
}

function pathParamsSchema(expressPath: string): ZodObject | undefined {
  const names = [...expressPath.matchAll(/:(\w+)/g)].map((match) => match[1]);
  if (names.length === 0) return undefined;
  return z.object(Object.fromEntries(names.map((name) => [name, uuidSchema])));
}

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: apiErrorSchema } },
});

/**
 * Monta as respostas a partir do que a rota realmente pode devolver:
 * - 400 só se a rota valida alguma entrada (path, query ou body)
 * - 404 só se a rota busca um recurso pelo path (todo :param é dono ou recurso)
 * - 409 só nas rotas que declaram `conflict`
 */
function buildResponses(route: RouteDoc, hasParams: boolean): RouteConfig['responses'] {
  const successStatus = route.successStatus ?? (route.method === 'post' ? 201 : 200);
  const responses: RouteConfig['responses'] = {
    [successStatus]: { description: successStatus === 204 ? 'Sem conteúdo' : 'Sucesso' },
  };

  if (hasParams || route.query || route.body) {
    responses[400] = errorResponse('Payload ou parâmetros inválidos (VALIDATION_ERROR)');
  }
  if (hasParams) {
    responses[404] = errorResponse(
      'Recurso não encontrado, ou não pertence ao dono informado no path',
    );
  }
  if (route.conflict) responses[409] = errorResponse(route.conflict);
  for (const [status, description] of Object.entries(route.extraResponses ?? {})) {
    responses[status] = { description };
  }
  responses[500] = errorResponse('Erro interno');
  return responses;
}

function buildRouteConfig(route: RouteDoc): RouteConfig {
  const params = pathParamsSchema(route.path);
  const bodyContent = route.body && {
    schema: route.body,
    ...(route.bodyExample !== undefined && { example: route.bodyExample }),
  };

  return {
    method: route.method,
    path: toOpenApiPath(route.path),
    tags: [route.tag],
    summary: route.summary,
    ...(route.description && { description: route.description }),
    request: {
      ...(params && { params }),
      ...(route.query && { query: route.query }),
      ...(bodyContent && {
        body: { required: true, content: { 'application/json': bodyContent } },
      }),
    },
    responses: buildResponses(route, params !== undefined),
  };
}

// ---------------------------------------------------------------------------
// Exemplos de corpo
// Os dados são fictícios, mas passam na validação (CNPJs com dígito verificador válido).

// UUID de exemplo nos corpos que referenciam outro recurso
const EXAMPLE_ID = '3f8b6a2e-9c41-4d7a-b5e3-1a2b3c4d5e6f';
const REPLACE_IDS_NOTE =
  'Os IDs do exemplo são fictícios: troque pelos IDs devolvidos nos cadastros.';

const curitibaAddress = {
  address: 'Rua XV de Novembro, 1000 - Centro, Curitiba - PR',
  lat: -25.4296,
  lng: -49.2713,
};
const carrierBaseAddress = {
  address: 'Rua Senador Accioly Filho, 500 - CIC, Curitiba - PR',
  lat: -25.495,
  lng: -49.348,
};
const pontaGrossaAddress = {
  address: 'Av. Visconde de Taunay, 200 - Ronda, Ponta Grossa - PR',
  lat: -25.0945,
  lng: -50.1633,
};
const saoPauloAddress = {
  address: 'Av. Paulista, 1578 - Bela Vista, São Paulo - SP',
  lat: -23.5614,
  lng: -46.6559,
};

/** Data ISO 8601 com fuso de Brasília, `daysAhead` dias depois de `now`. */
function futureIsoDate(now: Date, daysAhead: number, hour: number): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + daysAhead);
  const day = date.toISOString().slice(0, 10);
  return `${day}T${String(hour).padStart(2, '0')}:00:00-03:00`;
}

// As datas precisam ser futuras (a janela de coleta não pode ter terminado),
// por isso o exemplo é calculado a partir da data em que o contrato é gerado
function shipmentExample(now: Date) {
  return {
    origin: curitibaAddress,
    destination: saoPauloAddress,
    cargoType: 'Eletrônicos',
    weightKg: 3500,
    volumeM3: 25,
    requiredVehicleType: 'TRUCK_TOCO',
    pickupWindowStart: futureIsoDate(now, 2, 8),
    pickupWindowEnd: futureIsoDate(now, 2, 18),
    deliveryDeadline: futureIsoDate(now, 4, 18),
    specialRequirements: 'Carga frágil: não empilhar',
    priceOffered: 4800,
  };
}

// ---------------------------------------------------------------------------
// Rotas que se repetem para transportadora e motorista autônomo (ver fleet/marketplace.routes.ts)

const VEHICLE_IN_TRIP_CONFLICT =
  'Veículo em viagem, ou com histórico de ofertas/entregas (não pode ser removido)';

function vehicleRoutes(basePath: string, owner: string, plate: string): RouteDoc[] {
  const tag = 'Frota';
  return [
    {
      method: 'get',
      path: basePath,
      tag,
      summary: `Lista veículos (${owner})`,
      query: listVehiclesQuerySchema,
    },
    {
      method: 'post',
      path: basePath,
      tag,
      summary: `Cadastra veículo (${owner})`,
      body: createVehicleSchema,
      bodyExample: { plate, type: 'TRUCK_TOCO', capacityKg: 6000, capacityM3: 40 },
      conflict: 'Já existe um veículo cadastrado com essa placa',
    },
    { method: 'get', path: `${basePath}/:vehicleId`, tag, summary: `Detalha veículo (${owner})` },
    {
      method: 'put',
      path: `${basePath}/:vehicleId`,
      tag,
      summary: `Substitui veículo (${owner})`,
      description: 'Envie todos os campos. Para alterar só alguns, use PATCH.',
      body: replaceVehicleSchema,
      bodyExample: { plate, type: 'TRUCK_TRUCK', capacityKg: 12000, capacityM3: 60 },
      conflict: 'Já existe um veículo cadastrado com essa placa',
    },
    {
      method: 'patch',
      path: `${basePath}/:vehicleId`,
      tag,
      summary: `Atualiza veículo (${owner})`,
      body: updateVehicleSchema,
      bodyExample: { capacityKg: 6500 },
      conflict: 'Já existe um veículo cadastrado com essa placa',
    },
    {
      method: 'patch',
      path: `${basePath}/:vehicleId/status`,
      tag,
      summary: `Altera status do veículo (${owner})`,
      body: updateVehicleStatusSchema,
      bodyExample: { status: 'MANUTENCAO' },
      conflict: 'Veículo em viagem: o status volta para DISPONIVEL ao fim da entrega',
    },
    {
      method: 'delete',
      path: `${basePath}/:vehicleId`,
      tag,
      summary: `Remove veículo (${owner})`,
      successStatus: 204,
      conflict: VEHICLE_IN_TRIP_CONFLICT,
    },
  ];
}

function offererRoutes(
  basePath: string,
  owner: string,
  offerSchema: ZodType,
  offerExample: unknown,
): RouteDoc[] {
  const tag = 'Marketplace';
  return [
    {
      method: 'get',
      path: `${basePath}/available-shipments`,
      tag,
      summary: `Cargas disponíveis por raio (${owner})`,
      query: availableShipmentsQuerySchema,
    },
    {
      method: 'post',
      path: `${basePath}/shipments/:shipmentId/offers`,
      tag,
      summary: `Faz oferta numa carga (${owner})`,
      body: offerSchema,
      bodyExample: offerExample,
      conflict:
        'Carga não está aberta, já existe (ou foi recusada) oferta deste ofertante, ' +
        'ou motorista/veículo indisponível',
    },
    {
      method: 'get',
      path: `${basePath}/offers`,
      tag,
      summary: `Lista ofertas feitas (${owner})`,
      query: listOffersQuerySchema,
    },
    {
      method: 'post',
      path: `${basePath}/offers/:offerId/withdraw`,
      tag,
      summary: `Retira oferta (${owner})`,
      successStatus: 200,
      conflict: 'Só é possível retirar uma oferta PENDENTE',
    },
  ];
}

// ---------------------------------------------------------------------------

export function buildRouteDocs(now = new Date()): RouteDoc[] {
  return [
    {
      method: 'get',
      path: '/health',
      tag: 'Health',
      summary: 'Status da API e das dependências',
      extraResponses: { 503: 'Postgres ou Redis fora do ar' },
    },

    // Contas
    {
      method: 'post',
      path: '/signup/empresa',
      tag: 'Contas',
      summary: 'Cadastro de empresa (embarcadora)',
      description: 'Empresa que publica cargas. Para transportadora use /signup/transportadora.',
      body: signupShipperSchema,
      bodyExample: {
        name: 'Ana Souza',
        email: 'ana.souza@industria-exemplo.com.br',
        password: 'senhaSegura123',
        phone: '(41) 98002-4922',
        legalName: 'Indústria Exemplo Ltda',
        document: '11.222.333/0001-81',
        address: curitibaAddress,
      },
      conflict: 'E-mail ou CNPJ já cadastrado',
    },
    {
      method: 'post',
      path: '/signup/transportadora',
      tag: 'Contas',
      summary: 'Cadastro de transportadora',
      description: 'O endereço é obrigatório: é o centro da busca de cargas por raio.',
      body: signupCarrierSchema,
      bodyExample: {
        name: 'Carlos Lima',
        email: 'carlos.lima@transportadora-exemplo.com.br',
        password: 'senhaSegura123',
        phone: '(41) 3333-4444',
        legalName: 'Faro Fino Transportes Ltda',
        document: '45.219.685/0001-08',
        address: carrierBaseAddress,
      },
      conflict: 'E-mail ou CNPJ já cadastrado',
    },
    {
      method: 'post',
      path: '/signup/motorista',
      tag: 'Contas',
      summary: 'Cadastro de motorista autônomo',
      body: signupAutonomousDriverSchema,
      bodyExample: {
        name: 'João Pereira',
        email: 'joao.pereira@motorista-exemplo.com.br',
        password: 'senhaSegura123',
        phone: '(42) 99876-5432',
        cnhNumber: '12345678901',
        cnhCategory: 'E',
        baseAddress: pontaGrossaAddress,
      },
      conflict: 'E-mail ou CNH já cadastrado',
    },
    { method: 'get', path: '/companies/:companyId', tag: 'Contas', summary: 'Detalha empresa' },
    {
      method: 'patch',
      path: '/companies/:companyId',
      tag: 'Contas',
      summary: 'Atualiza empresa',
      description: 'Envie só os campos a alterar. Transportadora não pode ficar sem endereço.',
      body: updateCompanySchema,
      bodyExample: { phone: '(41) 3222-1100' },
    },
    { method: 'get', path: '/drivers/:driverId', tag: 'Contas', summary: 'Detalha motorista' },
    {
      method: 'patch',
      path: '/drivers/:driverId',
      tag: 'Contas',
      summary: 'Atualiza motorista autônomo',
      description: 'Envie só os campos a alterar.',
      body: updateAutonomousDriverSchema,
      bodyExample: { cnhCategory: 'D', baseAddress: curitibaAddress },
      conflict: 'CNH já cadastrada',
    },

    // Motoristas da transportadora
    {
      method: 'get',
      path: '/carriers/:carrierId/drivers',
      tag: 'Motoristas',
      summary: 'Lista motoristas da transportadora',
      query: listDriversQuerySchema,
    },
    {
      method: 'post',
      path: '/carriers/:carrierId/drivers',
      tag: 'Motoristas',
      summary: 'Cadastra motorista na transportadora',
      body: createCarrierDriverSchema,
      bodyExample: {
        name: 'Marcos Silva',
        email: 'marcos.silva@transportadora-exemplo.com.br',
        cnhNumber: '98765432100',
        cnhCategory: 'E',
        phone: '41991234567',
      },
      conflict: 'E-mail ou CNH já cadastrado',
    },
    {
      method: 'get',
      path: '/carriers/:carrierId/drivers/:driverId',
      tag: 'Motoristas',
      summary: 'Detalha motorista da transportadora',
    },
    {
      method: 'put',
      path: '/carriers/:carrierId/drivers/:driverId',
      tag: 'Motoristas',
      summary: 'Substitui perfil do motorista da transportadora',
      description:
        'Envie todos os campos (o telefone omitido é removido). Para alterar só alguns, use PATCH.',
      body: replaceCarrierDriverSchema,
      bodyExample: {
        name: 'Marcos Silva Santos',
        cnhNumber: '98765432100',
        cnhCategory: 'E',
        phone: '41998765432',
      },
      conflict: 'CNH já cadastrada',
    },
    {
      method: 'patch',
      path: '/carriers/:carrierId/drivers/:driverId',
      tag: 'Motoristas',
      summary: 'Atualiza motorista da transportadora',
      description: 'Envie só os campos a alterar.',
      body: updateCarrierDriverSchema,
      bodyExample: { phone: '41998765432' },
      conflict: 'CNH já cadastrada',
    },
    {
      method: 'delete',
      path: '/carriers/:carrierId/drivers/:driverId',
      tag: 'Motoristas',
      summary: 'Remove motorista da transportadora',
      successStatus: 204,
      conflict:
        'Motorista em viagem, ou com histórico de ofertas/entregas (marque como INDISPONIVEL)',
    },
    {
      method: 'patch',
      path: '/carriers/:carrierId/drivers/:driverId/status',
      tag: 'Motoristas',
      summary: 'Altera status do motorista da transportadora',
      body: updateDriverStatusSchema,
      bodyExample: { status: 'INDISPONIVEL' },
      conflict: 'Motorista em viagem: o status volta para DISPONIVEL ao fim da entrega',
    },
    {
      method: 'patch',
      path: '/drivers/:driverId/status',
      tag: 'Motoristas',
      summary: 'Altera status do motorista autônomo',
      body: updateDriverStatusSchema,
      bodyExample: { status: 'INDISPONIVEL' },
      conflict: 'Motorista em viagem: o status volta para DISPONIVEL ao fim da entrega',
    },

    // Frota (placas diferentes: a placa é única no sistema inteiro)
    ...vehicleRoutes('/carriers/:carrierId/vehicles', 'transportadora', 'ABC1D23'),
    ...vehicleRoutes('/drivers/:driverId/vehicles', 'autônomo', 'BRA2E19'),

    // Cargas
    {
      method: 'get',
      path: '/companies/:companyId/shipments',
      tag: 'Cargas',
      summary: 'Lista cargas da empresa',
      query: listShipmentsQuerySchema,
    },
    {
      method: 'post',
      path: '/companies/:companyId/shipments',
      tag: 'Cargas',
      summary: 'Publica carga',
      description: 'Datas em ISO 8601 com fuso. A janela de coleta precisa estar no futuro.',
      body: createShipmentSchema,
      bodyExample: shipmentExample(now),
    },
    {
      method: 'get',
      path: '/companies/:companyId/shipments/:shipmentId',
      tag: 'Cargas',
      summary: 'Detalha carga',
    },
    {
      method: 'put',
      path: '/companies/:companyId/shipments/:shipmentId',
      tag: 'Cargas',
      summary: 'Substitui carga',
      description:
        'Envie todos os campos (specialRequirements omitido é removido). ' +
        'Para alterar só alguns, use PATCH.',
      body: replaceShipmentSchema,
      bodyExample: { ...shipmentExample(now), priceOffered: 5200 },
      conflict: 'Só é possível editar uma carga ABERTA',
    },
    {
      method: 'patch',
      path: '/companies/:companyId/shipments/:shipmentId',
      tag: 'Cargas',
      summary: 'Atualiza carga',
      description: 'Envie só os campos a alterar.',
      body: updateShipmentSchema,
      bodyExample: { priceOffered: 5200 },
      conflict: 'Só é possível editar uma carga ABERTA',
    },
    {
      method: 'delete',
      path: '/companies/:companyId/shipments/:shipmentId',
      tag: 'Cargas',
      summary: 'Exclui carga',
      description:
        'Só para carga ABERTA que ainda não recebeu ofertas. Com ofertas, use o cancelamento.',
      successStatus: 204,
      conflict: 'Carga não está ABERTA ou já recebeu ofertas (cancele-a em vez de excluir)',
    },
    {
      method: 'post',
      path: '/companies/:companyId/shipments/:shipmentId/cancel',
      tag: 'Cargas',
      summary: 'Cancela carga',
      successStatus: 200,
      conflict: 'Só é possível cancelar uma carga ABERTA (carga aceita: cancele a entrega)',
    },

    // Marketplace
    ...offererRoutes('/carriers/:carrierId', 'transportadora', createCarrierOfferSchema, {
      priceProposed: 4500,
    }),
    ...offererRoutes('/drivers/:driverId', 'autônomo', createAutonomousOfferSchema, {
      priceProposed: 4300,
      vehicleId: EXAMPLE_ID,
    }),
    {
      method: 'put',
      path: '/carriers/:carrierId/offers/:offerId/assignment',
      tag: 'Marketplace',
      summary: 'Atribui motorista e veículo à oferta',
      description: REPLACE_IDS_NOTE,
      body: offerAssignmentSchema,
      bodyExample: { driverId: EXAMPLE_ID, vehicleId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' },
      conflict:
        'Oferta não está PENDENTE/ACEITA, coleta já feita, ou motorista/veículo indisponível',
    },
    {
      method: 'get',
      path: '/companies/:companyId/shipments/:shipmentId/offers',
      tag: 'Marketplace',
      summary: 'Lista ofertas recebidas numa carga',
      query: listOffersQuerySchema,
    },
    {
      method: 'post',
      path: '/companies/:companyId/shipments/:shipmentId/offers/:offerId/accept',
      tag: 'Marketplace',
      summary: 'Aceita oferta (gera a entrega)',
      conflict: 'Carga não está mais aberta, ou oferta não está PENDENTE',
    },
    {
      method: 'post',
      path: '/companies/:companyId/shipments/:shipmentId/offers/:offerId/reject',
      tag: 'Marketplace',
      summary: 'Recusa oferta',
      successStatus: 200,
      conflict: 'Só é possível recusar uma oferta PENDENTE',
    },

    // Entregas
    {
      method: 'get',
      path: '/companies/:companyId/deliveries/:deliveryId',
      tag: 'Entregas',
      summary: 'Acompanha entrega (empresa)',
    },
    {
      method: 'post',
      path: '/companies/:companyId/deliveries/:deliveryId/cancel',
      tag: 'Entregas',
      summary: 'Cancela entrega (empresa)',
      // O corpo é opcional no controller, mas documentado para o "Try it out" mostrar `note`
      description: 'O corpo é opcional.',
      body: cancelDeliverySchema,
      bodyExample: { note: 'Pedido cancelado pelo cliente' },
      successStatus: 200,
      conflict: 'O status atual da entrega não permite cancelamento',
    },
    {
      method: 'get',
      path: '/drivers/:driverId/deliveries',
      tag: 'Entregas',
      summary: 'Lista entregas do motorista',
    },
    {
      method: 'post',
      path: '/drivers/:driverId/deliveries/:deliveryId/status',
      tag: 'Entregas',
      summary: 'Avança status da entrega (motorista)',
      description: 'Sequência: COLETADO → EM_TRANSITO → ENTREGUE.',
      body: updateDeliveryStatusSchema,
      bodyExample: { status: 'COLETADO', note: 'Carga coletada sem avarias' },
      successStatus: 200,
      conflict:
        'Transição fora da sequência, veículo ainda não atribuído pela transportadora, ' +
        'ou motorista/veículo ocupado em outra viagem',
    },
  ];
}

export function buildOpenApiDocument(now = new Date()) {
  const registry = new OpenAPIRegistry();
  for (const route of buildRouteDocs(now)) registry.registerPath(buildRouteConfig(route));

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'FleetWorksLog API',
      version: '0.1.0',
      description:
        'Documentação gerada a partir dos schemas zod de validação. ' +
        'Ainda sem autenticação: as rotas recebem o dono do recurso no path.',
    },
    // Relativo: o Swagger UI chama a mesma origem em que foi aberto (sem fixar porta)
    servers: [{ url: '/' }],
  });
}
