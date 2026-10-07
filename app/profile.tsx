import { AccountRow, AccountSection, BusinessBadge, AccountDivider, accountLayout } from '../src/components/account-menu';
import { InformationEditor, EditorField, BusinessIdentityFields } from '../src/components/information-editor';
import type { BottomSheetHandle } from './components/Calendar/BottomSheet';
import { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { UserAvatar } from './components/account/UserAvatar';
import { useAuth } from '../src/hooks/useAuth';
import { authService } from '../src/services/authService';
import { onboardingService } from '../src/services/onboardingService';
import { photoService } from '../src/services/photoService';
import { businessStateService } from '../src/services/businessStateService';
import { useAppStore } from '../src/store';
import { Colors, FontSize, Radius, Spacing, Typography } from '../src/constants/theme';

type Editing = 'personal' | 'business' | null;
export default function ProfileScreen() {
  const router = useRouter(); const { currentUser, updateUser, refreshUser } = useAuth(); const businessName = useAppStore(x => x.businessName); const businessType = useAppStore(x => x.businessType); const updateBusinessDetails = useAppStore(x => x.updateBusinessDetails);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const uploadPhoto = async () => { if (savingPhoto) return; setSavingPhoto(true); try { const url = await photoService.pickAndUpload(); if (url) await refreshUser(); } catch (cause) { Alert.alert('Foto', cause instanceof Error ? cause.message : 'Não foi possível salvar a foto.'); } finally { setSavingPhoto(false); } };
  const [editing, setEditing] = useState<Editing>(null); const [name, setName] = useState(''); const [role, setRole] = useState(''); const [phone, setPhone] = useState(''); const [businessNameDraft, setBusinessNameDraft] = useState(''); const [businessTypeDraft, setBusinessTypeDraft] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setName(currentUser?.name ?? ''); setRole(currentUser?.role ?? ''); setPhone(currentUser?.phone ?? ''); }, [currentUser]);
  useEffect(() => { setBusinessNameDraft(businessName); setBusinessTypeDraft(businessType); }, [businessName, businessType]);
  const cancel = () => { setEditing(null); setError(''); setName(currentUser?.name ?? ''); setRole(currentUser?.role ?? ''); setPhone(currentUser?.phone ?? ''); setBusinessNameDraft(businessName); setBusinessTypeDraft(businessType); };
  const savePersonal = async () => { if (!name.trim()) return setError('Informe seu nome para continuar.'); setSaving(true); setError(''); try { await updateUser({ name, role, phone }); editorRef.current?.close(); Alert.alert('Dados atualizados', 'Suas informações foram salvas.'); } catch { setError('Não foi possível salvar agora. Tente novamente.'); } finally { setSaving(false); } };
  const saveBusiness = async () => { if (!businessNameDraft.trim()) return setError('Informe o nome do negócio para continuar.'); if (!currentUser) return; setSaving(true); setError(''); try { const nextName = businessNameDraft.trim(); const nextType = businessTypeDraft.trim(); updateBusinessDetails(nextName, nextType); await businessStateService.commit(); const state = useAppStore.getState(); await onboardingService.saveStructuredProfile(currentUser.id, state.onboardingExtraction ? { ...state.onboardingExtraction, taxonomy: state.taxonomy } : state.taxonomy); editorRef.current?.close(); Alert.alert('Negócio atualizado', 'Nome e ramo foram salvos sem refazer sua configuração inicial.'); } catch { setError('Não foi possível salvar agora. Tente novamente.'); } finally { setSaving(false); } };
  const editorRef = useRef<BottomSheetHandle>(null);
  const openEditor = (section: Editing) => { cancel(); setEditing(section); };
  return <AccountScreen><AccountHeader refined title="Meu perfil" onBack={() => router.back()} /><ScrollView contentContainerStyle={accountLayout.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><TouchableOpacity onPress={uploadPhoto} disabled={savingPhoto} accessibilityRole="button" accessibilityLabel="Alterar foto de perfil"><UserAvatar user={currentUser} size={Spacing.xxxl * 3 + Spacing.sm} /><View style={styles.camera}>{savingPhoto ? <ActivityIndicator color={Colors.accent} /> : <Ionicons name="camera-outline" size={18} color={Colors.accent} />}</View></TouchableOpacity><Text style={styles.name}>{currentUser?.name || 'Seu perfil'}</Text><Text style={styles.email}>{currentUser?.email}</Text><View style={{ alignSelf: 'center', maxWidth: '100%' }}><BusinessBadge name={businessName} /></View></View>
    <AccountSection title="Seus dados" icon="person-outline" onEdit={() => openEditor('personal')}><AccountRow icon="person-outline" title="Nome completo" subtitle={currentUser?.name || 'Não informado'} /><AccountDivider /><AccountRow icon="briefcase-outline" title="Cargo ou função" subtitle={currentUser?.role || 'Não informado'} /><AccountDivider /><AccountRow icon="call-outline" title="Telefone" subtitle={currentUser?.phone || 'Não informado'} /><AccountDivider /><AccountRow icon="mail-outline" title="E-mail de acesso" subtitle={currentUser?.email || ''} /></AccountSection>
    <AccountSection title="Seu negócio" icon="storefront-outline" onEdit={() => openEditor('business')}><AccountRow icon="storefront-outline" title="Nome do negócio" subtitle={businessName || 'Não informado'} /><AccountDivider /><AccountRow icon="pricetag-outline" title="Ramo ou segmento" subtitle={businessType || 'Não informado'} /></AccountSection>
  </ScrollView><InformationEditor ref={editorRef} visible={editing !== null} onClose={cancel} title={editing === 'personal' ? 'Editar seus dados' : 'Editar seu negócio'} saving={saving} error={error} onSave={editing === 'personal' ? savePersonal : saveBusiness}>
      {editing === 'personal' ? <><EditorField label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" /><EditorField label="Cargo ou função" value={role} onChangeText={setRole} /><EditorField label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Text style={s.muted}>Seu e-mail de acesso não pode ser alterado por aqui.</Text></> : <BusinessIdentityFields name={businessNameDraft} segment={businessTypeDraft} onNameChange={setBusinessNameDraft} onSegmentChange={setBusinessTypeDraft} />}
    </InformationEditor></AccountScreen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: Spacing.xs, marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm, overflow: 'hidden' }, name: { color: Colors.ink, fontFamily: Typography.bold, fontSize: FontSize.xl, lineHeight: 28, textAlign: 'center', marginTop: Spacing.xs }, email: { color: Colors.textSecondary, fontFamily: Typography.regular, fontSize: FontSize.md, lineHeight: 22, textAlign: 'center' }, camera: { position: 'absolute', right: 0, bottom: 0, backgroundColor: Colors.accentLight, padding: Spacing.sm, borderRadius: Radius.full, borderWidth: 2, borderColor: Colors.appBackground } });
