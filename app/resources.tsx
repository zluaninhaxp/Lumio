import { ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { AccountRow, AccountSection, accountLayout } from '../src/components/account-menu';
import { Colors } from '../src/constants/theme';
export default function ResourcesScreen() {
  const router = useRouter(); const { aiKeySaved } = useLocalSearchParams<{ aiKeySaved?: string; }>();
  return <AccountScreen><AccountHeader refined title="Recursos e integrações" onBack={() => router.back()} /><ScrollView contentContainerStyle={accountLayout.content}>
    {aiKeySaved === '1' && <Text style={{ color: Colors.successText }} accessibilityRole="alert">Chave salva com sucesso!</Text>}
    <AccountSection style={accountLayout.firstSection} title="Inteligência Artificial" icon="sparkles-outline"><AccountRow icon="sparkles-outline" title="Chave de API (Google Gemini)" subtitle="Gerencie sua chave de IA" onPress={() => { router.setParams({ aiKeySaved: '' }); router.push({ pathname: '/ai-settings', params: { from: 'resources' } }); }} /></AccountSection>
  </ScrollView></AccountScreen>;
}
