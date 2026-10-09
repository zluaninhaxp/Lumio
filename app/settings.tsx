import { useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { AccountRow, AccountSection, accountLayout } from '../src/components/account-menu';
import { InformationEditor, EditorField } from '../src/components/information-editor';
import type { BottomSheetHandle } from './components/Calendar/BottomSheet';
import { useAuth } from '../src/hooks/useAuth';
import { authService } from '../src/services/authService';
import { AppAlert } from "@/src/services/appAlert";
import { AppFeedback } from "@/src/components/app-feedback";

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const editor = useRef<BottomSheetHandle>(null);
  const pending = useRef(false);
  const [editing, setEditing] = useState<'password' | 'delete' | null>(null);
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const close = () => { setEditing(null); setCurrent(''); setNext(''); setConfirm(''); setError(''); };
  const performDelete = async () => {
    if (!currentUser || pending.current) return;
    pending.current = true; setSaving(true); setError('');
    try { await authService.deleteAccount(currentUser.id, current); await logout().catch(() => { }); router.replace('/welcome'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível excluir a conta.'); }
    finally { pending.current = false; setSaving(false); }
  };
  const save = async () => {
    if (!currentUser || pending.current) return;
    if (!current) { setError('Informe sua senha atual para continuar.'); return; }
    if (editing === 'delete') {
      const message = 'Seus dados e sua foto serão removidos. Esta ação não pode ser desfeita.';
      AppAlert.alert('Excluir conta definitivamente?', message, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => { void performDelete(); } }]);
      return;
    }
    if (next.length < 6) { setError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    if (next !== confirm) { setError('As senhas não coincidem.'); return; }
    pending.current = true; setSaving(true); setError('');
    try { await authService.changePassword(currentUser.id, current, next); editor.current?.close(); AppFeedback.show('Senha atualizada', 'Sua senha foi alterada com sucesso.'); }
    catch { setError('Não foi possível atualizar a senha. Confira os dados e tente novamente.'); }
    finally { pending.current = false; setSaving(false); }
  };
  return <AccountScreen><AccountHeader refined title="Configurações" onBack={() => router.back()} /><ScrollView contentContainerStyle={accountLayout.content}>
    <AccountSection style={accountLayout.firstSection} title="Segurança" icon="shield-checkmark-outline"><AccountRow icon="lock-closed-outline" title="Alterar senha" subtitle="Gerencie a segurança da sua conta" onPress={() => setEditing('password')} /></AccountSection>
    <AccountSection title="Conta" icon="person-circle-outline"><AccountRow icon="trash-outline" title="Excluir conta" subtitle="Remova sua conta e seus dados definitivamente" destructive onPress={() => setEditing('delete')} /></AccountSection>
  </ScrollView><InformationEditor draft={{ current, next, confirm }} ref={editor} visible={editing !== null} onClose={close} title={editing === 'delete' ? 'Excluir conta' : 'Alterar senha'} saving={saving} destructive={editing === 'delete'} error={error} onSave={save} saveLabel={editing === 'delete' ? 'Excluir minha conta' : 'Atualizar senha'}>
      {editing === 'delete' && <Text style={s.muted}>Digite sua senha para excluir sua conta e seus dados definitivamente. Você precisará confirmar antes da exclusão.</Text>}
      <EditorField label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry textContentType="password" autoCapitalize="none" />
      {editing === 'password' && <><EditorField label="Nova senha" value={next} onChangeText={setNext} secureTextEntry textContentType="newPassword" autoCapitalize="none" /><EditorField label="Confirmar nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" autoCapitalize="none" /></>}
    </InformationEditor></AccountScreen>;
}
