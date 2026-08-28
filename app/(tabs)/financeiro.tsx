import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  SectionList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useFinanceState, TransactionSection } from '../../src/hooks/useFinanceState';
import { useAppStore, type Transaction } from '../../src/store';
import { CollapsingHeader } from '../components/Finance/CollapsingHeader';
import { TransactionItem } from '../components/Finance/TransactionItem';
import {
  QuickAddForm,
  clearPendingTransactionDraft,
  consumeDraftClosePreservation,
  setPendingTransactionRelation,
} from '../components/Finance/QuickAddForm';
import { MonthSelector } from '../components/Finance/MonthSelector';
import { FinanceSkeleton } from '../components/Finance/FinanceSkeleton';
import { FinanceEmptyState } from '../components/Finance/FinanceEmptyState';
import { UndoSnackbar } from '../components/Finance/UndoSnackbar';
import { SelectionBar } from '../components/Finance/SelectionBar';
import { FAB } from '../components/Calendar/FAB';
import { BottomSheet } from '../components/Calendar/BottomSheet';
import { UserAvatar } from '../components/account/UserAvatar';
import { AccountSheet } from '../components/account/AccountSheet';
import { BottomFade } from '../components/BottomFade';

const HEADER_DEFAULT_HEIGHT = 290;
const HEADER_MIN_HEIGHT = 90;
const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList<Transaction, TransactionSection>
);

export default function FinanceiroScreen() {
  const router = useRouter();
  const { returnToFinance, createdId, relation } = useLocalSearchParams<{
    returnToFinance?: string;
    createdId?: string;
    relation?: 'client' | 'supplier' | 'employee';
  }>();
  const { currentUser } = useAuth();
  const [accountVisible, setAccountVisible] = useState(false);
  const handledReturnRef = useRef<string | null>(null);
  const markTransactionReceived = useAppStore((state) => state.markTransactionReceived);
  const refreshContratos = useAppStore((state) => state.refreshContratos);
  const financialExpenseCategories = useAppStore((state) => state.financialExpenseCategories);
  const financialIncomeCategories = useAppStore((state) => state.financialIncomeCategories);

  const {
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
    periodLabel,
    goToPreviousMonth,
    goToNextMonth,
    periodHasData,
    addTransaction,
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
  } = useFinanceState();

  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  const [dynamicHeaderHeight, setDynamicHeaderHeight] = useState(HEADER_DEFAULT_HEIGHT);

  const scrollY = useRef(new Animated.Value(0)).current;
  const prevSwipeRef = useRef<any>(null);

  const handleHeightChange = useCallback((height: number) => {
    setDynamicHeaderHeight(height);
  }, []);

  useEffect(() => {
    refreshContratos();
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [refreshContratos]);

  const openAddSheet = useCallback(() => {
    setEditingItem(null);
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    if (!consumeDraftClosePreservation()) clearPendingTransactionDraft();
    setSheetVisible(false);
    setEditingItem(null);
  }, []);

  useEffect(() => {
    if (returnToFinance !== '1' || !createdId || !relation) return;
    const key = `${relation}:${createdId}`;
    if (handledReturnRef.current === key) return;
    handledReturnRef.current = key;
    setPendingTransactionRelation(relation, createdId);
    setEditingItem(null);
    setSheetVisible(true);
    router.setParams({ returnToFinance: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToFinance, router]);

  const handleSaveTransaction = useCallback(
    (data: Omit<Transaction, 'id'>) => {
      let transactionId: string;
      if (editingItem) {
        updateTransaction(editingItem.id, data);
        transactionId = editingItem.id;
      } else {
        transactionId = addTransaction(data);
      }
      closeSheet();
      return transactionId;
    },
    [editingItem, addTransaction, updateTransaction, closeSheet]
  );

  const handleEdit = useCallback((item: Transaction) => {
    setEditingItem(item);
    setSheetVisible(true);
  }, []);

  const handleSwipeDelete = useCallback(
    (id: string) => {
      deleteWithUndo([id]);
    },
    [deleteWithUndo]
  );

  const handleSwipeOpen = useCallback(
    (ref: any) => {
      if (prevSwipeRef.current && prevSwipeRef.current !== ref) {
        prevSwipeRef.current.close();
      }
      prevSwipeRef.current = ref;
    },
    []
  );

  const handlePullSearch = useCallback(
    (e: any) => {
      const offset = e.nativeEvent.contentOffset?.y ?? 0;
      if (offset <= -10) {
        setSearchVisible(true);
      }
    },
    [setSearchVisible]
  );

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const categoryOptions = useMemo(
    () =>
      filterOptions.filter(
        (f) => f !== 'Todos' && f !== 'Entradas' && f !== 'Saídas'
      ),
    [filterOptions]
  );

  const quickAddCategories = useMemo(
    () => {
      const fromOnboarding = financialExpenseCategories.map((c) => c.label);
      return fromOnboarding.length > 0 ? fromOnboarding : ['Outros'];
    },
    [financialExpenseCategories]
  );

  const quickAddIncomeCategories = useMemo(
    () => {
      const fromOnboarding = financialIncomeCategories.map((c) => c.label);
      return fromOnboarding.length > 0 ? fromOnboarding : ['Receita'];
    },
    [financialIncomeCategories]
  );

  const renderItem = useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionItem
        item={item}
        fmt={fmtClean}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(item.id)}
        onPress={toggleSelection}
        onLongPress={enterSelectionMode}
        onDelete={handleSwipeDelete}
        onEdit={handleEdit}
        onMarkReceived={(id) => markTransactionReceived(id, true)}
        onSwipeOpen={handleSwipeOpen}
      />
    ),
    [
      fmtClean,
      selectionMode,
      selectedIds,
      toggleSelection,
      enterSelectionMode,
      handleSwipeDelete,
      handleEdit,
      markTransactionReceived,
      handleSwipeOpen,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: TransactionSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
        <View style={styles.sectionHeaderLine} />
      </View>
    ),
    []
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View style={{ height: dynamicHeaderHeight }} />
    ),
    [dynamicHeaderHeight]
  );

  const ListEmpty = useMemo(
    () =>
      loading ? (
        <View style={styles.emptyContainer}>
          <FinanceSkeleton />
        </View>
      ) : (
        <FinanceEmptyState
          hasFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          emptyMonth={!periodHasData && !hasActiveFilters}
        />
      ),
    [loading, hasActiveFilters, periodHasData, clearFilters]
  );

  const isEmpty = sections.length === 0 && !loading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Financeiro</Text>
        <View style={styles.topActions}>
          <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
        </View>
      </View>

      <MonthSelector
        label={periodLabel}
        onPrevious={goToPreviousMonth}
        onNext={goToNextMonth}
      />

      <View style={styles.body}>
        {searchVisible && (
          <Pressable style={styles.searchBackdrop} onPress={() => setSearchVisible(false)} />
        )}
        <CollapsingHeader
          summary={summary}
          scrollY={scrollY}
          headerMinHeight={HEADER_MIN_HEIGHT}
          fmt={fmtCurrency}
          filterOptions={filterOptions}
          selectedFilter={filter}
          onFilterSelect={setFilter}
          onHeightChange={handleHeightChange}
          search={search}
          searchVisible={searchVisible}
          onSearchChange={setSearch}
          onSearchToggle={() => setSearchVisible((visible) => !visible)}
        />

        <AnimatedSectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          onScroll={handleScroll}
          onScrollEndDrag={handlePullSearch}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          contentContainerStyle={[
            styles.listContent,
            isEmpty && styles.listContentEmpty,
          ]}
           removeClippedSubviews={false}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={15}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />

        <BottomFade />

        {!selectionMode && <FAB onPress={openAddSheet} />}

        <BottomSheet visible={sheetVisible} onClose={closeSheet}>
          <QuickAddForm
            onSave={handleSaveTransaction}
            onCancel={closeSheet}
            editData={editingItem}
            categories={quickAddCategories}
            incomeCategories={quickAddIncomeCategories}
          />
        </BottomSheet>

        {selectionMode && (
          <SelectionBar
            selectedCount={selectedIds.size}
            onDelete={() => deleteWithUndo([...selectedIds])}
            onCategorize={(cat) =>
              bulkCategorize([...selectedIds], cat)
            }
            onCancel={exitSelectionMode}
            categoryOptions={categoryOptions}
          />
        )}

        <UndoSnackbar ref={snackbarRef} onUndo={handleUndo} />

        <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
    zIndex: 20,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    color: Colors.primary,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  searchBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  body: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
    paddingHorizontal: Spacing.xl,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    paddingTop: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.bg,
  },
  sectionHeaderText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
});
