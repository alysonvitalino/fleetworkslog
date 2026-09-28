import { Redis } from 'ioredis';

export function createRedis(url: string) {
  return new Redis(url, {
    // Não fica tentando para sempre dentro de uma request: falha e deixa o healthcheck reportar
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
}
