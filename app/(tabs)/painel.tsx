import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';
import { useAuth } from '../../src/hooks/useAuth';
import { mockSummary } from '../../src/data/mock';

type PainelTab = 'Resumo' | 'Completo';
type CompleteTab = 'Financeiro' | 'Tarefas' | 'Calendário';
type FilterType = 'Todos' | 'Entradas' | 'Saídas' | string;

const fmt = (v: number) =>
  `R$ ${Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export default function PainelScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [painelTab, setPainelTab] = useState<PainelTab>('Resumo');
  const [period, setPeriod] = useState<'Semana' | 'Mês ativo' | 'Personalizado'>('Mês ativo');
  const [completeTab, setCompleteTab] = useState<CompleteTab>('Financeiro');
  const [filter, setFilter] = useState<FilterType>('Todos');

  const { transactions, tasks, events, removeTransaction, toggleTask, toggleEvent } = useAppStore();

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'Todos') return true;
    if (filter === 'Entradas') return t.amount > 0;
    if (filter === 'Saídas') return t.amount < 0;
    return t.category === filter;
  });

  const categories = [...new Set(transactions.map((t) => t.category))].filter(
    (c) => c !== 'Receita'
  );

  const financialFilters = ['Todos', 'Entradas', 'Saídas', ...categories];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Painel</Text>
        <TouchableOpacity onPress={handleLogout} hitSlop={12}>
          <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Main tabs */}
      <View style={styles.mainTabBar}>
        {(['Resumo', 'Completo'] as PainelTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.mainTab, painelTab === tab && styles.mainTabActive]}
            onPress={() => setPainelTab(tab)}
          >
            <Text style={[styles.mainTabText, painelTab === tab && styles.mainTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {painelTab === 'Resumo' ? (
        <ResumoView period={period} setPeriod={setPeriod} transactions={transactions} removeTransaction={removeTransaction} />
      ) : (
        <CompletoView
          completeTab={completeTab}
          setCompleteTab={setCompleteTab}
          filter={filter}
          setFilter={setFilter}
          financialFilters={financialFilters}
          filteredTransactions={filteredTransactions}
          tasks={tasks}
          events={events}
          removeTransaction={removeTransaction}
          toggleTask={toggleTask}
          toggleEvent={toggleEvent}
        />
      )}
    </SafeAreaView>
  );
}

function ResumoView({ period, setPeriod, transactions, removeTransaction }: any) {
  const [txFilter, setTxFilter] = useState<'Todos' | 'Entradas' | 'Saídas'>('Todos');

  const filtered = transactions.filter((t: any) => {
    if (txFilter === 'Entradas') return t.amount > 0;
    if (txFilter === 'Saídas') return t.amount < 0;
    return true;
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Period filter */}
      <View style={styles.chipBar}>
        {(['Semana', 'Mês ativo', 'Personalizado'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, period === p && styles.chipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Entradas</Text>
            <Text style={styles.summaryEntradas}>{fmt(mockSummary.entradas)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>Saídas</Text>
            <Text style={styles.summarySaidas}>{fmt(mockSummary.saidas)}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <Text style={styles.summaryPeriodLabel}>Saldo do período</Text>
        <Text style={styles.summarySaldo}>{fmt(mockSummary.saldo)}</Text>

        {/* Category bars */}
        <View style={styles.catBars}>
          {mockSummary.byCategory.map((cat) => (
            <View key={cat.name} style={styles.catRow}>
              <Text style={styles.catName}>{cat.name}</Text>
              <Text style={styles.catValue}>{fmt(cat.value)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(cat.value / cat.max) * 100}%` as any }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Transactions list */}
      <View style={styles.txSection}>
        <Text style={styles.sectionLabel}>TRANSAÇÕES</Text>
        <View style={styles.txFilterRow}>
          {(['Todos', 'Entradas', 'Saídas'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.txFilterBtn, txFilter === f && styles.txFilterBtnActive]}
              onPress={() => setTxFilter(f)}
            >
              <Text style={[styles.txFilterText, txFilter === f && styles.txFilterTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.map((t: any) => (
          <View key={t.id} style={styles.txCard}>
            <Text style={styles.txDate}>{t.date}</Text>
            <View style={styles.txInfo}>
              <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
              <Text style={styles.txCategory}>{t.category}</Text>
            </View>
            <Text style={[styles.txAmount, t.amount > 0 ? styles.amountIn : styles.amountOut]}>
              {t.amount > 0 ? '+' : ''}{fmt(t.amount)}
            </Text>
            <TouchableOpacity onPress={() => {}} style={styles.iconBtn}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Excluir?', '', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: () => removeTransaction(t.id) },
              ])}
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function CompletoView({ completeTab, setCompleteTab, filter, setFilter, financialFilters, filteredTransactions, tasks, events, removeTransaction, toggleTask, toggleEvent }: any) {
  return (
    <View style={{ flex: 1 }}>
      {/* Sub tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabBar} contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.sm }}>
        {(['Financeiro', 'Tarefas', 'Calendário'] as CompleteTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.subTab, completeTab === tab && styles.subTabActive]}
            onPress={() => setCompleteTab(tab)}
          >
            <Text style={[styles.subTabText, completeTab === tab && styles.subTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter chips */}
      {completeTab === 'Financeiro' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: Spacing.xs }}>
          {financialFilters.map((f: string) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingBottom: 100, gap: Spacing.xs }}>
        {completeTab === 'Financeiro' && filteredTransactions.map((t: any) => (
          <View key={t.id} style={styles.completeRow}>
            <Text style={styles.completeDate}>{t.date}</Text>
            <Text style={styles.completeDesc} numberOfLines={2}>{t.description}</Text>
            <Text style={[styles.completeAmount, t.amount > 0 ? styles.amountIn : styles.amountOut]}>
              {Math.abs(t.amount)}
            </Text>
          </View>
        ))}

        {completeTab === 'Tarefas' && (
          <>
            <Text style={[styles.sectionLabel, { marginBottom: Spacing.sm }]}>PENDENTES</Text>
            {tasks.filter((t: any) => !t.done).map((t: any) => (
              <View key={t.id} style={styles.completeRow}>
                <TouchableOpacity
                  style={[styles.checkbox, t.done && styles.checkboxDone]}
                  onPress={() => toggleTask(t.id)}
                >
                  {t.done && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </TouchableOpacity>
                <Text style={styles.completeDesc}>{t.description}</Text>
                <Text style={styles.completeDate}>—</Text>
              </View>
            ))}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>CONCLUÍDAS</Text>
            {tasks.filter((t: any) => t.done).map((t: any) => (
              <View key={t.id} style={styles.completeRow}>
                <TouchableOpacity
                  style={[styles.checkbox, styles.checkboxDone]}
                  onPress={() => toggleTask(t.id)}
                >
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </TouchableOpacity>
                <Text style={[styles.completeDesc, { color: Colors.textMuted, textDecorationLine: 'line-through' }]}>{t.description}</Text>
              </View>
            ))}
          </>
        )}

        {completeTab === 'Calendário' && events.map((e: any) => (
          <View key={e.id} style={styles.completeRow}>
            <Text style={styles.completeDate}>{e.date.slice(8)}/{e.date.slice(5, 7)}</Text>
            <View style={{ flex: 1 }}>
              {e.time && <Text style={styles.eventTime}>{e.time}</Text>}
              <Text style={styles.completeDesc}>{e.description}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkbox, e.done && styles.checkboxDone]}
              onPress={() => toggleEvent(e.id)}
            >
              {e.done && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl, color: Colors.primary,
  },
  mainTabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    padding: 4,
    marginBottom: Spacing.md,
  },
  mainTab: {
    flex: 1, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, alignItems: 'center',
  },
  mainTabActive: { backgroundColor: Colors.bgCard, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  mainTabText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.md, color: Colors.textSecondary,
  },
  mainTabTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold', color: Colors.primary,
  },

  chipBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl,
    gap: Spacing.sm, marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  chipTextActive: { color: '#FFF' },

  summaryCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl, padding: Spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    marginBottom: Spacing.xl,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  summaryEntradas: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg, color: Colors.accent,
  },
  summarySaidas: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg, color: Colors.danger,
  },
  summaryDivider: { height: 1, backgroundColor: Colors.border, marginBottom: Spacing.md },
  summaryPeriodLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4,
  },
  summarySaldo: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxxl, color: Colors.primary, marginBottom: Spacing.xl,
  },
  catBars: { gap: Spacing.md },
  catRow: { gap: 4 },
  catName: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.primary,
  },
  catValue: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm, color: Colors.textSecondary,
    position: 'absolute', right: 0,
  },
  barTrack: {
    height: 4, backgroundColor: Colors.border,
    borderRadius: 2, overflow: 'hidden',
  },
  barFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },

  txSection: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs, color: Colors.textMuted,
    letterSpacing: 1, marginBottom: Spacing.sm,
  },
  txFilterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  txFilterBtn: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  txFilterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  txFilterText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  txFilterTextActive: { color: '#FFF' },
  txCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    marginBottom: Spacing.sm, gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  txDate: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs, color: Colors.textMuted, width: 32,
  },
  txInfo: { flex: 1 },
  txDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.primary,
  },
  txCategory: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs, color: Colors.textMuted,
  },
  txAmount: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.sm,
  },
  amountIn: { color: Colors.accent },
  amountOut: { color: Colors.primary },
  iconBtn: { padding: 4 },

  // Completo
  subTabBar: { maxHeight: 44, marginBottom: Spacing.sm },
  subTab: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  subTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subTabText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  subTabTextActive: { color: '#FFF' },
  filterBar: { maxHeight: 40, marginBottom: Spacing.md },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs, color: Colors.textSecondary,
  },
  filterChipTextActive: { color: '#FFF' },
  completeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  completeDate: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs, color: Colors.textMuted, width: 32,
  },
  completeDesc: {
    flex: 1, fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.primary,
  },
  completeAmount: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.md,
  },
  eventTime: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs, color: Colors.accent,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
