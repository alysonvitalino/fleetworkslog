import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Valida req.body com um schema zod. Em caso de erro, o ZodError segue para o
 * error handler, que responde 400 no formato padrão.
 */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}
