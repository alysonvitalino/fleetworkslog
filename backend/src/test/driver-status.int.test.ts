import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCarrier, createDriver } from './fixtures.js';
import { createTestContext, resetDatabase } from './setup-db.js';

const { db, app } = createTestContext();

beforeAll(() => db.migrate.latest());
beforeEach(() => resetDatabase(db));
afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

describe('status do motorista da transportadora', () => {
  it('should let the carrier mark its driver as INDISPONIVEL', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/drivers/${driverId}/status`)
      .send({ status: 'INDISPONIVEL' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: driverId, carrierId, status: 'INDISPONIVEL' });
  });

  it('should return 404 for a driver from another carrier', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId: await createCarrier(db) });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/drivers/${driverId}/status`)
      .send({ status: 'INDISPONIVEL' });
    expect(response.status).toBe(404);
  });

  it('should return 409 while the driver is on a trip', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId, status: 'EM_VIAGEM' });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/drivers/${driverId}/status`)
      .send({ status: 'DISPONIVEL' });
    expect(response.status).toBe(409);
  });

  it('should reject EM_VIAGEM because it is set by the delivery flow', async () => {
    const carrierId = await createCarrier(db);
    const driverId = await createDriver(db, { carrierId });

    const response = await request(app)
      .patch(`/carriers/${carrierId}/drivers/${driverId}/status`)
      .send({ status: 'EM_VIAGEM' });
    expect(response.status).toBe(400);
  });
});

describe('status do motorista autônomo', () => {
  it('should let the autonomous driver change its own status', async () => {
    const driverId = await createDriver(db);

    const response = await request(app)
      .patch(`/drivers/${driverId}/status`)
      .send({ status: 'INDISPONIVEL' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ carrierId: null, status: 'INDISPONIVEL' });
  });

  it('should not change a carrier driver through the autonomous route', async () => {
    const driverId = await createDriver(db, { carrierId: await createCarrier(db) });

    const response = await request(app)
      .patch(`/drivers/${driverId}/status`)
      .send({ status: 'INDISPONIVEL' });
    expect(response.status).toBe(404);
  });
});
