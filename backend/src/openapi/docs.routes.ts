import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './document.js';

/**
 * GET /docs              → Swagger UI (interface no navegador)
 * GET /docs/openapi.json → contrato OpenAPI cru (importável no Postman/Insomnia)
 */
export function createDocsRoutes(): Router {
  const router = Router();
  // Gerado uma vez na subida: o contrato só muda quando o código muda
  const document = buildOpenApiDocument();

  router.get('/docs/openapi.json', (_req, res) => {
    res.json(document);
  });
  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: 'FleetWorksLog API — Docs' }),
  );

  return router;
}
