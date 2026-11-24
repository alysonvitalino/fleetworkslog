import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { createKnex } from '../db/knex.js';
import { createRoutes } from '../routes/index.js';
import { buildOpenApiDocument, buildRouteDocs, toOpenApiPath } from './document.js';

// O Knex só conecta na primeira query: aqui só montamos o router
const db = createKnex('postgres://unused@localhost:1/unused');

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: RouterLayer[] };
}

/** Lista "METHOD /path" de todas as rotas do Express, descendo nos sub-routers. */
function collectExpressRoutes(stack: RouterLayer[]): string[] {
  return stack.flatMap((layer) => {
    if (layer.route) {
      const path = toOpenApiPath(layer.route.path);
      return Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${path}`);
    }
    return layer.handle?.stack ? collectExpressRoutes(layer.handle.stack) : [];
  });
}

function collectDocumentedRoutes(): string[] {
  const document = buildOpenApiDocument();
  return Object.entries(document.paths ?? {}).flatMap(([path, operations]) =>
    Object.keys(operations ?? {}).map((method) => `${method.toUpperCase()} ${path}`),
  );
}

describe('OpenAPI document', () => {
  it('should document exactly the routes registered in Express', () => {
    const router = createRoutes({
      db,
      healthChecks: { postgres: () => Promise.resolve(), redis: () => Promise.resolve() },
    }) as Router & { stack: RouterLayer[] };

    const expressRoutes = collectExpressRoutes(router.stack).sort();
    expect(collectDocumentedRoutes().sort()).toEqual(expressRoutes);
  });

  it('should convert express path params to openapi format', () => {
    expect(toOpenApiPath('/carriers/:carrierId/vehicles/:vehicleId')).toBe(
      '/carriers/{carrierId}/vehicles/{vehicleId}',
    );
  });

  it('should describe the request body from the zod schema', () => {
    const document = buildOpenApiDocument();
    const operation = document.paths?.['/carriers/{carrierId}/vehicles']?.post;
    const body = operation?.requestBody;
    const schema = body && 'content' in body ? body.content['application/json']?.schema : undefined;

    expect(schema).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['plate', 'type', 'capacityKg', 'capacityM3']),
      additionalProperties: false,
    });
  });

  it('should register the standard error schema as a component', () => {
    expect(buildOpenApiDocument().components?.schemas).toHaveProperty('ApiError');
  });
});

describe('OpenAPI responses', () => {
  const document = buildOpenApiDocument();
  const statusesOf = (path: string, method: 'get' | 'post' | 'patch' | 'delete' | 'put') =>
    Object.keys(document.paths?.[path]?.[method]?.responses ?? {}).sort();

  it('should not document 404 on signup routes', () => {
    expect(statusesOf('/signup/empresa', 'post')).toEqual(['201', '400', '409', '500']);
  });

  it('should document only 200, 503 and 500 on /health', () => {
    expect(statusesOf('/health', 'get')).toEqual(['200', '500', '503']);
  });

  it('should not document 409 on read-only routes', () => {
    expect(statusesOf('/companies/{companyId}', 'get')).toEqual(['200', '400', '404', '500']);
  });

  it('should document 204 without 201 on delete routes', () => {
    expect(statusesOf('/carriers/{carrierId}/vehicles/{vehicleId}', 'delete')).toEqual([
      '204',
      '400',
      '404',
      '409',
      '500',
    ]);
  });
});

describe('OpenAPI body examples', () => {
  const routesWithBody = buildRouteDocs().filter((route) => route.body);

  it.each(routesWithBody.map((route) => [`${route.method.toUpperCase()} ${route.path}`, route]))(
    'should have a valid body example for %s',
    (_name, route) => {
      expect(route.bodyExample).toBeDefined();
      const result = route.body!.safeParse(route.bodyExample);
      expect(result.error?.issues).toBeUndefined();
    },
  );

  it('should expose the body example in the generated document', () => {
    const operation = buildOpenApiDocument().paths?.['/signup/empresa']?.post;
    const body = operation?.requestBody;
    const media = body && 'content' in body ? body.content['application/json'] : undefined;
    expect(media?.example).toMatchObject({ document: '11.222.333/0001-81' });
  });
});
