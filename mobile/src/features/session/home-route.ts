import { Role } from '@fleetworkslog/shared';

export type HomeRoute = '/login' | '/motorista' | '/empresa' | '/usar-painel-web';

/**
 * Decide a tela inicial conforme o perfil logado (docs/07-monorepo.md — Canal por perfil).
 * O app atende só EMPRESA e MOTORISTA; os demais perfis usam o painel web.
 */
export function resolveHomeRoute(role: Role | null): HomeRoute {
  if (role === null) return '/login';
  if (role === Role.MOTORISTA) return '/motorista';
  if (role === Role.EMPRESA) return '/empresa';
  return '/usar-painel-web';
}
