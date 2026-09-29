import type { Role } from '@fleetworkslog/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadTokens } from '../../lib/token-storage';

interface SessionState {
  isLoading: boolean;
  role: Role | null;
}

const SessionContext = createContext<SessionState>({ isLoading: true, role: null });

// Por enquanto só verifica se há tokens salvos. Login, refresh e leitura do role
// a partir do /auth/me entram na PUTF-25.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ isLoading: true, role: null });

  useEffect(() => {
    loadTokens()
      .catch(() => null)
      .then(() => setState({ isLoading: false, role: null }));
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
