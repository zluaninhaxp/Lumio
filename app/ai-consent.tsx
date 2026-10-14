import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen } from '../src/components/account/_shared';
import { accountLayout } from '../src/components/account-menu';
import { Colors, Spacing, Typography } from '../src/constants/theme';
import { PRIVACY_VERSION } from '../src/constants/privacy';
import { useAppStore } from '../src/store';
import { businessStateService } from '../src/services/businessStateService';
import { AppAlert } from '../src/services/appAlert';

export default function AiConsent() {
  const router=useRouter();const [busy,setBusy]=useState(false);
  const accept=async()=>{if(busy)return;setBusy(true);try{
    useAppStore.setState({aiDisclosureAcceptedVersion:PRIVACY_VERSION});
    await businessStateService.commit(); router.replace('/celebration');
  }catch(error){AppAlert.alert('Não foi possível confirmar',error instanceof Error?error.message:'Tente novamente.');}finally{setBusy(false);}};
  return <AccountScreen><AccountHeader refined title="Gerar relatório com IA" onBack={()=>router.replace('/onboarding')} /><ScrollView contentContainerStyle={accountLayout.content}>
    <Text style={{color:Colors.ink,fontFamily:Typography.regular,lineHeight:24}}>A IA é opcional. Suas respostas serão enviadas ao Google Gemini usando sua chave e podem consumir quota ou gerar cobrança. Não envie dados pessoais, sensíveis ou confidenciais; use dados fictícios no teste. No regime gratuito, Google pode utilizar o conteúdo para melhoria e revisão humana. Confira o plano da chave.</Text>
    <TouchableOpacity accessibilityRole="link" onPress={()=>router.push('/privacy')} style={{paddingVertical:Spacing.lg}}><Text style={{color:Colors.accentText}}>Ler o aviso de privacidade completo</Text></TouchableOpacity>
    <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={()=>void accept()} style={{paddingVertical:Spacing.lg}}><Text style={{color:Colors.accentText}}>{busy?'Confirmando…':'Estou ciente e escolho gerar com IA'}</Text></TouchableOpacity>
    <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={()=>router.replace('/onboarding')} style={{paddingVertical:Spacing.lg}}><Text style={{color:Colors.accentText}}>Voltar e continuar sem IA</Text></TouchableOpacity>
  </ScrollView></AccountScreen>;
}
