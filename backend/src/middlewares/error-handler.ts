import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@fleetworkslog/shared';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: {
      code: 'NOT_FOUND',
      message: `Rota não encontrada: ${req.method} ${req.path}`,
      requestId: String(req.id),
    },
  };
  res.status(404).json(body);
};

// Todo erro passa por aqui e sai no formato ApiErrorBody.
// Erros inesperados viram 500 sem vazar stack trace ou mensagem interna para o cliente.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = String(req.id);

  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, requestId, details: error.details },
    };
    res.status(error.statusCode).json(body);
    return;
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Payload inválido',
        requestId,
        details: error.issues,
      },
    };
    res.status(400).json(body);
    return;
  }

  req.log.error({ err: error }, 'Erro não tratado');
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno', requestId },
  };
  res.status(500).json(body);
};
