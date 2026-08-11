import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { UserAvatar } from './components/account/UserAvatar';
import { useAuth } from '../src/hooks/useAuth';
import { Colors, Spacing } from '../src/constants/theme';

export default function ProfileScreen() {
  const router = useRouter(); const { currentUser, updateUser } = useAuth();
  const [name, setName] = useState(currentUser?.name ?? ''); const [role, setRole] = useState(currentUser?.role ?? ''); const [phone, setPhone] = useState(currentUser?.phone ?? ''); const [photo, setPhoto] = useState<string | null>(currentUser?.photo ?? null); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const choosePhoto = () => Alert.alert('Foto do perfil', undefined, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Escolher da galeria', onPress: async () => { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return Alert.alert('Permissão necessária', 'Permita o acesso às fotos para escolher uma imagem.'); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!result.canceled) setPhoto(result.assets[0].uri); } }, ...(photo ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: () => setPhoto(null) }] : [])]);
  const save = async () => { if (!name.trim() || saving) return setError('Informe seu nome completo.'); setSaving(true); setError(''); try { await updateUser({ name, role, phone, photo }); Alert.alert('Perfil atualizado', 'Suas alterações foram salvas.'); } catch { setError('Falha ao salvar. Tente novamente.'); } finally { setSaving(false); } };
  return <AccountScreen><AccountHeader title="Meu Perfil" onBack={() => router.back()} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
    <View style={styles.avatarBlock}>{photo ? <Image source={{ uri: photo }} style={styles.photo} /> : <UserAvatar user={{ ...currentUser!, photo }} size={100} />}<TouchableOpacity onPress={choosePhoto} style={styles.change}><Text style={styles.changeText}>Alterar foto</Text></TouchableOpacity></View>
    <Text style={s.label}>Nome Completo</Text><TextInput style={s.input} value={name} onChangeText={setName} autoCapitalize="words" />
    <Text style={s.label}>Cargo/Função</Text><TextInput style={s.input} value={role} onChangeText={setRole} placeholder="Ex.: Proprietário" placeholderTextColor={Colors.textMuted} />
    <Text style={s.label}>Telefone</Text><TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="(00) 00000-0000" placeholderTextColor={Colors.textMuted} />
    <Text style={s.label}>E-mail</Text><TextInput style={[s.input, s.readOnly]} value={currentUser?.email ?? ''} editable={false} />
    {!!error && <Text style={s.error}>{error}</Text>}<TouchableOpacity style={[s.primary, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryText}>Salvar Alterações</Text>}</TouchableOpacity>
  </ScrollView></KeyboardAvoidingView></AccountScreen>;
}
const styles = StyleSheet.create({ avatarBlock: { alignItems: 'center', marginVertical: Spacing.lg }, photo: { width: 100, height: 100, borderRadius: 50 }, change: { padding: Spacing.md, minHeight: 44 }, changeText: { color: Colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold' } });
