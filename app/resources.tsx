import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen } from '../src/components/account/_shared';
import { AccountRow, AccountSection, accountLayout } from '../src/components/account-menu';
export default function ResourcesScreen() {
  const router = useRouter();
  return <AccountScreen><AccountHeader refined title="Recursos e integrações" onBack={() => router.back()} /><ScrollView contentContainerStyle={accountLayout.content}>
    <AccountSection style={accountLayout.firstSection} title="Inteligência Artificial" icon="sparkles-outline"><AccountRow icon="sparkles-outline" title="Chave de API (Google Gemini)" subtitle="Gerencie sua chave de IA" onPress={() => { router.push({ pathname: '/ai-settings', params: { from: 'resources' } }); }} /></AccountSection>
    <AccountSection title="Privacidade e suporte" icon="shield-checkmark-outline"><AccountRow icon="document-text-outline" title="Privacidade e condições do teste" subtitle="Dados, IA, retenção e contato" onPress={() => router.push('/privacy')} /></AccountSection>
  </ScrollView></AccountScreen>;
}
