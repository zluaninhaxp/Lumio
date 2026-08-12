import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { storageService } from '../src/services/storageService';
import { AccountStorageKeys } from '../src/constants/accountKeys';
import { Colors, FontSize, Radius, Spacing } from '../src/constants/theme';

type ThemeChoice = 'system' | 'light' | 'dark';
type Preferences = { theme: ThemeChoice; taskNotifications: boolean; financeNotifications: boolean; calendarNotifications: boolean };
const defaults: Preferences = { theme: 'system', taskNotifications: true, financeNotifications: true, calendarNotifications: true };

export default function PreferencesScreen() {
  const router = useRouter(); const [preferences, setPreferences] = useState(defaults); const [loading, setLoading] = useState(true);
  useEffect(() => { storageService.getItem<Preferences>(AccountStorageKeys.PREFERENCES).then((value) => { if (value) setPreferences({ ...defaults, ...value }); }).finally(() => setLoading(false)); }, []);
  const update = (changes: Partial<Preferences>) => { const next = { ...preferences, ...changes }; setPreferences(next); storageService.setItem(AccountStorageKeys.PREFERENCES, next); };
  if (loading) return <AccountScreen><AccountHeader title="Preferências" onBack={() => router.back()} /><ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.xxxl }} /></AccountScreen>;
  return <AccountScreen><AccountHeader title="Preferências" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.scroll}>
    <Text style={s.sectionTitle}>TEMA</Text><View style={styles.segment}>{(['system', 'light', 'dark'] as ThemeChoice[]).map((choice) => <TouchableOpacity key={choice} onPress={() => update({ theme: choice })} style={[styles.segmentItem, preferences.theme === choice && styles.segmentActive]} accessibilityRole="radio" accessibilityState={{ selected: preferences.theme === choice }}><Text style={[styles.segmentText, preferences.theme === choice && styles.segmentTextActive]}>{choice === 'system' ? 'Sistema' : choice === 'light' ? 'Claro' : 'Escuro'}</Text></TouchableOpacity>)}</View>
    <Text style={[s.sectionTitle, { marginTop: Spacing.xxl }]}>NOTIFICAÇÕES</Text><View style={s.card}>{[['taskNotifications', 'Tarefas e lembretes'], ['financeNotifications', 'Movimentações financeiras'], ['calendarNotifications', 'Compromissos do calendário']].map(([key, label]) => <View key={key} style={styles.row}><Text style={styles.rowText}>{label}</Text><Switch value={preferences[key as keyof Preferences] as boolean} onValueChange={(value) => update({ [key]: value })} trackColor={{ false: Colors.border, true: Colors.accentLight }} thumbColor={preferences[key as keyof Preferences] ? Colors.accent : '#FFFFFF'} accessibilityLabel={label} /></View>)}</View>
  </ScrollView></AccountScreen>;
}
const styles = StyleSheet.create({ segment: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: 4, borderWidth: 1, borderColor: Colors.border }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: Colors.primary }, segmentText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontFamily: 'PlusJakartaSans_600SemiBold' }, segmentTextActive: { color: '#FFFFFF' }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border }, rowText: { flex: 1, color: Colors.primary, fontSize: FontSize.md } });
