import { ScrollView, Text, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen } from './account/_shared';
import { accountLayout } from '../src/components/account-menu';
import { Colors, Spacing, Typography } from '../src/constants/theme';
import { PRIVACY_SECTIONS, PRIVACY_CONTACT, PRIVACY_VERSION } from '../src/constants/privacy';
import { AppAlert } from '../src/services/appAlert';

export default function PrivacyScreen() {
  const router = useRouter();
  return <AccountScreen><AccountHeader refined title="Privacidade e teste" onBack={() => router.canGoBack() ? router.back() : router.replace('/welcome')} />
    <ScrollView contentContainerStyle={accountLayout.content}>
      <Text style={{ color: Colors.textSecondary, fontFamily: Typography.regular }}>Aviso atualizado em {PRIVACY_VERSION}</Text>
      {PRIVACY_SECTIONS.map(section => <Text key={section.title} selectable style={{ color: Colors.ink, fontFamily: Typography.regular, lineHeight: 24, marginTop: Spacing.lg }}><Text style={{ fontFamily: Typography.semibold }}>{section.title}{'\n'}</Text>{section.text}</Text>)}
      <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL('mailto:' + PRIVACY_CONTACT).catch(() => AppAlert.alert('Contato', PRIVACY_CONTACT))} style={{ paddingVertical: Spacing.lg }}><Text style={{ color: Colors.accentText }}>Contatar suporte e privacidade</Text></TouchableOpacity>
    </ScrollView>
  </AccountScreen>;
}
