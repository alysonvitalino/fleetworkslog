import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createRoutes, type RouteDeps } from './routes/index.js';

export interface AppDeps extends RouteDeps {
  logger: Logger;
  corsOrigins: string[];
}

// A app recebe as dependências por parâmetro para os testes injetarem versões falsas
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger: deps.logger,
      // Reaproveita o X-Request-Id vindo de um proxy, senão gera um novo
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Healthcheck é chamado o tempo todo por monitores: não polui o log
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );

  app.use(createRoutes(deps));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
