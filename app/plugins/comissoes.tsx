import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const formatMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] ?? month}/${y}`;
};

export default function ComissoesScreen() {
  const router = useRouter();
  const { commissions, employeeItems, closeEmployeeCommission, setPluginActivation } = useAppStore();

  const pendingByEmployee = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    commissions.filter((c) => !c.paid).forEach((c) => {
      const entry = map.get(c.employeeId) ?? { amount: 0, count: 0 };
      entry.amount += c.amount;
      entry.count += 1;
      map.set(c.employeeId, entry);
    });
    return [...map].map(([employeeId, agg]) => ({
      employee: employeeItems.find((e) => e.id === employeeId),
      employeeId,
      ...agg,
    })).filter((entry) => entry.employee);
  }, [commissions, employeeItems]);

  const paidHistory = useMemo(() =>
    commissions.filter((c) => c.paid).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')),
    [commissions],
  );

  const totalPending = pendingByEmployee.reduce((sum, e) => sum + e.amount, 0);

  const handlePay = (employeeId: string, name: string, amount: number) => Alert.alert(
    'Confirmar pagamento',
    `Concluir o saldo de ${money(amount)} de comissão de ${name}? Nenhuma transação será criada.`,
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Concluir', onPress: () => closeEmployeeCommission(employeeId) },
    ],
  );

  const handleDeactivate = () => Alert.alert('Desativar Comissões', 'O módulo sai da aba Apps, mas os dados continuam guardados.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desativar', style: 'destructive', onPress: () => { setPluginActivation('comissoes', false); router.back(); } },
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={Colors.primary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Comissões</Text>
        <TouchableOpacity onPress={handleDeactivate} style={styles.iconBtn}><Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total pendente a pagar</Text>
          <Text style={styles.summaryAmount}>{money(totalPending)}</Text>
          <Text style={styles.summaryHint}>
            Comissões devidas por pedidos concluídos. Conclua o saldo quando fizer o fechamento.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>PENDENTES POR FUNCIONÁRIO</Text>
        {pendingByEmployee.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="cash-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhuma comissão pendente.</Text>
          </View>
        )}
        {pendingByEmployee.map((entry) => (
          <View key={entry.employeeId} style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{entry.employee!.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>{entry.employee!.name}</Text>
              <Text style={styles.cardSubtitle}>{entry.employee!.role} · {entry.count} pedido(s)</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>{money(entry.amount)}</Text>
                <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(entry.employeeId, entry.employee!.name, entry.amount)}>
                <Text style={styles.payBtnText}>Concluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {paidHistory.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>HISTÓRICO DE PAGAMENTOS</Text>
            {paidHistory.map((c) => {
              const employee = employeeItems.find((e) => e.id === c.employeeId);
              return (
                <View key={c.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>{employee?.name ?? 'Funcionário removido'}</Text>
                    <Text style={styles.historySubtitle}>{formatMonth(c.month)} · {c.rate}% · pedido {c.orderId.slice(-6)}</Text>
                  </View>
                  <Text style={styles.historyAmount}>{money(c.amount)}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  iconBtn: { padding: Spacing.xs },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  summaryCard: { backgroundColor: Colors.accentLight, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  summaryLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accent },
  summaryAmount: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: FontSize.xxl, color: Colors.accent, marginTop: 4 },
  summaryHint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.sm },
  sectionLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 40, gap: Spacing.md },
  emptyText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.accent },
  cardMain: { flex: 1 },
  cardTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.primary },
  cardSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: Spacing.xs },
  amount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.md, color: Colors.accent },
  payBtn: { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: 6 },
  payBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: '#FFFFFF' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  historyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  historySubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  historyAmount: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.sm, color: Colors.accent },
});
