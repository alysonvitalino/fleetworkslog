import type { Knex } from 'knex';
import { CompanyType } from '@fleetworkslog/shared';

/** Consultas de existência dos "donos" informados no path (empresa, transportadora, autônomo). */
export class OwnerRepository {
  constructor(private readonly db: Knex) {}

  async carrierExists(carrierId: string): Promise<boolean> {
    return this.companyExists(carrierId, CompanyType.TRANSPORTADORA);
  }

  async shipperExists(companyId: string): Promise<boolean> {
    return this.companyExists(companyId, CompanyType.EMPRESA);
  }

  async autonomousDriverExists(driverId: string): Promise<boolean> {
    const driver = await this.db('drivers')
      .where({ id: driverId })
      .whereNull('carrier_id')
      .first('id');
    return driver !== undefined;
  }

  private async companyExists(companyId: string, type: CompanyType): Promise<boolean> {
    const company = await this.db('companies').where({ id: companyId, type }).first('id');
    return company !== undefined;
  }
}
