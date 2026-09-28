import { Screen } from '../components/Screen';
import { ApiStatus } from '../features/health/ApiStatus';

export default function LoginScreen() {
  return (
    <Screen title="Entrar" description="Formulário de login entra na PUTF-25.">
      <ApiStatus />
    </Screen>
  );
}
