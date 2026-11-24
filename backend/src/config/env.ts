import { z } from 'zod';

// Valida as variáveis de ambiente na inicialização: falha rápido e com mensagem clara
// em vez de quebrar no meio de uma request.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // Sem valor explícito, o Swagger fica ligado só em development (ver apiDocsEnabled)
  API_DOCS_ENABLED: z.stringbool().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function apiDocsEnabled(env: Env): boolean {
  return env.API_DOCS_ENABLED ?? env.NODE_ENV === 'development';
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return result.data;
}
