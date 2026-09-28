import { pino } from 'pino';

// Logs em JSON (um objeto por linha). Em dev, rode com `| npx pino-pretty` para ler melhor.
export function createLogger(level: string) {
  return pino({
    level,
    base: { service: 'fleetworkslog-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      // Nunca logar credenciais, mesmo que alguém faça log do request inteiro
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
      censor: '[REDACTED]',
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
