import { ShipmentStatus, type PaginatedResponse, type ShipmentDto } from '@fleetworkslog/shared';
import { AppError } from '../errors/app-error.js';
import { toShipmentDto, type ShipmentRow } from '../models/shipment.model.js';
import type { ShipmentRepository } from '../repositories/shipment.repository.js';
import {
  scheduleIssues,
  type CreateShipmentInput,
  type ListShipmentsQuery,
  type UpdateShipmentInput,
} from '../schemas/shipment.schema.js';
import type { OwnerService } from './owners.service.js';

/** Regras de negócio das cargas publicadas por uma empresa (embarcadora). */
export class ShipmentService {
  constructor(
    private readonly shipments: ShipmentRepository,
    private readonly owners: OwnerService,
  ) {}

  async list(
    shipperId: string,
    query: ListShipmentsQuery,
  ): Promise<PaginatedResponse<ShipmentDto>> {
    await this.owners.assertShipperExists(shipperId);
    const { rows, total } = await this.shipments.list(shipperId, query);
    return { items: rows.map(toShipmentDto), total, limit: query.limit, offset: query.offset };
  }

  async get(shipperId: string, shipmentId: string): Promise<ShipmentDto> {
    return getOwnedOrFail(this.shipments, shipperId, shipmentId);
  }

  async create(shipperId: string, input: CreateShipmentInput): Promise<ShipmentDto> {
    await this.owners.assertShipperExists(shipperId);
    const shipmentId = await this.shipments.create(shipperId, input);
    return this.get(shipperId, shipmentId);
  }

  /** Só carga ABERTA pode ser editada, e as datas novas precisam ser coerentes com as salvas. */
  update(shipperId: string, shipmentId: string, input: UpdateShipmentInput): Promise<ShipmentDto> {
    return this.shipments.transaction(async (repository) => {
      const current = await lockOwnedOrFail(repository, shipperId, shipmentId);
      if (current.status !== ShipmentStatus.ABERTA) {
        throw AppError.conflict('Só é possível editar uma carga ABERTA');
      }

      const touchesSchedule =
        input.pickupWindowStart !== undefined ||
        input.pickupWindowEnd !== undefined ||
        input.deliveryDeadline !== undefined;
      if (touchesSchedule) {
        const issues = scheduleIssues({
          pickupWindowStart: input.pickupWindowStart ?? current.pickup_window_start,
          pickupWindowEnd: input.pickupWindowEnd ?? current.pickup_window_end,
          deliveryDeadline: input.deliveryDeadline ?? current.delivery_deadline,
        });
        if (issues.length > 0) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Payload inválido', issues);
        }
      }

      await repository.update(shipmentId, input);
      return getOwnedOrFail(repository, shipperId, shipmentId);
    });
  }

  /**
   * Cancela uma carga ABERTA e encerra as ofertas pendentes dela (docs/08-precificacao.md).
   * Carga já aceita não é cancelada aqui: cancela-se a entrega, que devolve a carga para ABERTA.
   */
  cancel(shipperId: string, shipmentId: string): Promise<ShipmentDto> {
    return this.shipments.transaction(async (repository) => {
      const current = await lockOwnedOrFail(repository, shipperId, shipmentId);
      if (current.status !== ShipmentStatus.ABERTA) {
        throw AppError.conflict(
          current.status === ShipmentStatus.CANCELADA
            ? 'Carga já está cancelada'
            : 'Só é possível cancelar uma carga ABERTA; para carga aceita, cancele a entrega',
        );
      }

      await repository.updateStatus(shipmentId, ShipmentStatus.CANCELADA);
      await repository.cancelPendingOffers(shipmentId);
      return getOwnedOrFail(repository, shipperId, shipmentId);
    });
  }

  /**
   * Exclui uma carga ABERTA que ainda não recebeu nenhuma oferta.
   * Com ofertas (ou depois de aceita) o histórico precisa ser preservado: use o cancelamento.
   * O lock da carga impede que uma oferta entre entre a verificação e a exclusão
   * (a criação de oferta trava a carga com FOR SHARE).
   */
  delete(shipperId: string, shipmentId: string): Promise<void> {
    return this.shipments.transaction(async (repository) => {
      const current = await lockOwnedOrFail(repository, shipperId, shipmentId);
      if (current.status !== ShipmentStatus.ABERTA) {
        throw AppError.conflict('Só é possível excluir uma carga ABERTA');
      }
      if (await repository.hasOffers(shipmentId)) {
        throw AppError.conflict(
          'A carga já recebeu ofertas e não pode ser excluída; cancele-a para manter o histórico',
        );
      }
      await repository.delete(shipmentId);
    });
  }
}

async function getOwnedOrFail(
  repository: ShipmentRepository,
  shipperId: string,
  shipmentId: string,
): Promise<ShipmentDto> {
  const row = await repository.findOwned(shipperId, shipmentId);
  if (!row) throw AppError.notFound('Carga não encontrada');
  return toShipmentDto(row);
}

async function lockOwnedOrFail(
  repository: ShipmentRepository,
  shipperId: string,
  shipmentId: string,
): Promise<ShipmentRow> {
  const row = await repository.findOwnedForUpdate(shipperId, shipmentId);
  if (!row) throw AppError.notFound('Carga não encontrada');
  return row;
}
