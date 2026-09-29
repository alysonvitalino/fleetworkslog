import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { resolveHomeRoute } from '../features/session/home-route';
import { useSession } from '../features/session/SessionProvider';

// Ponto de entrada: decide a tela inicial pelo perfil logado
export default function Index() {
  const { isLoading, role } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={resolveHomeRoute(role)} />;
}
