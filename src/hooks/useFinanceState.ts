import { useState, useCallback, useMemo, useRef } from 'react';
import { useAppStore, Transaction } from '../store';

export type FinanceFilter = 'Todos' | 'Entradas' | 'Saídas' | string;

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const CATEGORY_ICONS: Record<string, string> = {
  'Combustível': 'flame-outline',
  'Materiais': 'construct-outline',
  'Fornecedores': 'business-outline',
  'Alimentação': 'restaurant-outline',
  'Receita': 'cash-outline',
  'Outros': 'ellipsis-horizontal-outline',
};

export const CATEGORY_ICON_COLORS: Record<string, string> = {
  'Combustível': '#F59E0B',
  'Materiais': '#3B82F6',
  'Fornecedores': '#8B5CF6',
  'Alimentação': '#EC4899',
  'Receita': '#00A878',
  'Outros': '#AAAAAA',
};

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? 'ellipsis-horizontal-outline';
}

export function getCategoryIconColor(category: string): string {
  return CATEGORY_ICON_COLORS[category] ?? '#AAAAAA';
}

const fmtCurrency = (v: number) =>
  `R$ ${Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const fmtClean = (v: number) =>
  `${Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export interface TransactionSection {
  title: string;
  data: Transaction[];
}

function getSectionTitle(date: string): string {
  const parts = date.split('/');
  if (parts.length !== 2) return date;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(day) || isNaN(month) || month < 1 || month > 12) return date;
  return `${day} de ${MONTH_NAMES[month - 1]}`;
}

export function formatPeriodLabel(month: number, year: number): string {
  if (month < 1 || month > 12) return `${year}`;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function useFinanceState() {
  const {
    transactions,
    addTransaction,
    removeTransaction,
    updateTransaction,
    removeTransactions,
    financialExpenseCategories,
    financialIncomeCategories,
  } = useAppStore();

  const now = new Date();
  const [period, setPeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const [filter, setFilter] = useState<FinanceFilter>('Todos');
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const deletedSnapshotRef = useRef<Transaction[]>([]);

  const snackbarRef = useRef<{
    show: (ids: string[]) => void;
    dismiss: () => void;
  } | null>(null);

  const goToPreviousMonth = useCallback(() => {
    setPeriod((p) => {
      if (p.month === 1) return { month: 12, year: p.year - 1 };
      return { month: p.month - 1, year: p.year };
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setPeriod((p) => {
      if (p.month === 12) return { month: 1, year: p.year + 1 };
      return { month: p.month + 1, year: p.year };
    });
  }, []);

  const periodMonthStr = useMemo(
    () => String(period.month).padStart(2, '0'),
    [period.month]
  );

  const periodLabel = useMemo(
    () => formatPeriodLabel(period.month, period.year),
    [period.month, period.year]
  );

  const periodTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const parts = t.date.split('/');
        if (parts.length !== 2) return false;
        const txMonth = parseInt(parts[1], 10);
        return txMonth === period.month;
      }),
    [transactions, period.month]
  );

  const onboardingCategoryLabels = useMemo(
    () =>
      [...financialExpenseCategories, ...financialIncomeCategories].map(
        (c) => c.label
      ),
    [financialExpenseCategories, financialIncomeCategories]
  );

  const categoryList = useMemo(
    () =>
      [
        ...new Set([
          ...transactions.map((t) => t.category),
          ...onboardingCategoryLabels,
        ]),
      ].filter((c) => c !== 'Receita'),
    [transactions, onboardingCategoryLabels]
  );

  const filterOptions: FinanceFilter[] = useMemo(
    () => ['Todos', 'Entradas', 'Saídas', ...categoryList],
    [categoryList]
  );

  const filteredTransactions = useMemo(() => {
    let result = periodTransactions;
    if (filter === 'Entradas') result = result.filter((t) => t.amount > 0);
    else if (filter === 'Saídas') result = result.filter((t) => t.amount < 0);
    else if (filter !== 'Todos')
      result = result.filter((t) => t.category === filter);

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(s)
      );
    }

    return result;
  }, [periodTransactions, filter, search]);

  const sections: TransactionSection[] = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((t) => {
      if (!grouped[t.date]) grouped[t.date] = [];
      grouped[t.date].push(t);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        const [da, ma] = a.split('/').map(Number);
        const [db, mb] = b.split('/').map(Number);
        if (ma !== mb) return mb - ma;
        return db - da;
      })
      .map(([date, data]) => ({
        title: getSectionTitle(date),
        data,
      }));
  }, [filteredTransactions]);

  const summary = useMemo(() => {
    const entradas = periodTransactions
      .filter((t) => t.amount > 0 && t.confirmed !== false)
      .reduce((s, t) => s + t.amount, 0);
    const saidas = periodTransactions
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const saldo = entradas - saidas;

    const catMap: Record<string, number> = {};
    periodTransactions
      .filter((t) => t.amount < 0 && t.category !== 'Receita')
      .forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + Math.abs(t.amount);
      });

    const categories = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value]) => ({ name, value }));

    const maxVal = categories.length > 0 ? categories[0].value : 1;

    return { entradas, saidas, saldo, categories, maxVal };
  }, [periodTransactions]);

  const enterSelectionMode = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (next.size === 0) {
            setSelectionMode(false);
            return prev;
          }
        } else {
          next.add(id);
        }
        return next;
      });
    },
    []
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const deleteWithUndo = useCallback(
    (ids: string[]) => {
      deletedSnapshotRef.current = transactions.filter((t) =>
        ids.includes(t.id)
      );
      removeTransactions(ids);
      snackbarRef.current?.show(ids);
      exitSelectionMode();
    },
    [transactions, removeTransactions, exitSelectionMode]
  );

  const handleUndo = useCallback(() => {
    const items = deletedSnapshotRef.current;
    if (items.length > 0) {
      items.forEach((item) => addTransaction(item));
      deletedSnapshotRef.current = [];
    }
    snackbarRef.current?.dismiss();
  }, [addTransaction]);

  const bulkCategorize = useCallback(
    (ids: string[], category: string) => {
      ids.forEach((id) => updateTransaction(id, { category }));
      exitSelectionMode();
    },
    [updateTransaction, exitSelectionMode]
  );

  const clearFilters = useCallback(() => {
    setFilter('Todos');
    setSearch('');
    setSearchVisible(false);
  }, []);

  const hasActiveFilters = filter !== 'Todos' || search.trim().length > 0;

  const periodHasData = periodTransactions.length > 0;

  return {
    filteredTransactions,
    sections,
    filterOptions,
    filter,
    setFilter,
    search,
    setSearch,
    searchVisible,
    setSearchVisible,
    selectionMode,
    selectedIds,
    summary,
    period,
    periodLabel,
    goToPreviousMonth,
    goToNextMonth,
    periodHasData,
    addTransaction,
    removeTransaction,
    updateTransaction,
    deleteWithUndo,
    handleUndo,
    bulkCategorize,
    enterSelectionMode,
    toggleSelection,
    exitSelectionMode,
    clearFilters,
    hasActiveFilters,
    snackbarRef,
    fmtCurrency,
    fmtClean,
  };
}
