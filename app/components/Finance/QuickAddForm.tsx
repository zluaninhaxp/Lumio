import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import type { Transaction } from '../../../src/store';
import { useAppStore } from '../../../src/store';
import { suggestedDueDate } from '../../../src/utils/supplier';
import { getPluginDefinition } from '../../../src/plugins/registry';
import { TagSelector } from '../TagSelector';
import { taskFormStyles } from '../Tasks/taskFormStyles';

function formatTransactionDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

interface QuickAddFormProps {
  onSave: (data: Omit<Transaction, 'id'>) => string;
  onCancel: () => void;
  editData?: Transaction | null;
  categories: string[];
  incomeCategories: string[];
}

function formatCurrencyValue(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return formatCurrencyValue(Number(digits) / 100);
}

function parseCurrency(value: string): number {
  return Number(value.replace(/\D/g, '')) / 100;
}

type TransactionDraft = {
  amount: string;
  type: 'saida' | 'entrada';
  expanded: boolean;
  description: string;
  category: string;
  transactionDate: string;
  clientId?: string;
  supplierId?: string;
  employeeId?: string;
  supplierDueDate: string;
  supplierPaid: boolean;
  stockItemId?: string;
  stockQuantity: string;
  stockReceived: boolean;
};

let pendingTransactionDraft: TransactionDraft | null = null;
let preserveDraftOnClose = false;

export function clearPendingTransactionDraft() {
  pendingTransactionDraft = null;
  preserveDraftOnClose = false;
}

export function consumeDraftClosePreservation() {
  const shouldPreserve = preserveDraftOnClose;
  preserveDraftOnClose = false;
  return shouldPreserve;
}

export function setPendingTransactionRelation(relation: 'client' | 'supplier' | 'employee', id: string) {
  if (!pendingTransactionDraft) return;
  if (relation === 'client') pendingTransactionDraft.clientId = id;
  else if (relation === 'supplier') pendingTransactionDraft.supplierId = id;
  else pendingTransactionDraft.employeeId = id;
}

export function QuickAddForm({ onSave, onCancel, editData, categories, incomeCategories }: QuickAddFormProps) {
  const router = useRouter();
  const isEditing = !!editData;
  const draft = !editData ? pendingTransactionDraft : null;
  const initialAmount = editData
    ? formatCurrencyValue(Math.abs(editData.amount))
    : draft?.amount ?? '';
  const initialType: 'saida' | 'entrada' = editData
    ? editData.amount > 0
      ? 'entrada'
      : 'saida'
    : draft?.type ?? 'saida';
  const initialDesc = editData
    ? editData.description === 'Receita' || editData.description === 'Despesa'
      ? ''
      : editData.description
    : draft?.description ?? '';
  const initialCategory = editData ? editData.category : draft?.category ?? '';

  const [amount, setAmount] = useState(initialAmount);
  const [type, setType] = useState<'saida' | 'entrada'>(initialType);
  const [expanded, setExpanded] = useState(isEditing || !!draft);
  const [description, setDescription] = useState(initialDesc);
  const [category, setCategory] = useState(initialCategory);

  const today = new Date();
  const initialDateStr = editData
    ? editData.date
    : draft?.transactionDate ?? today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const [transactionDate, setTransactionDate] = useState(initialDateStr);
  const { clienteItems, fornecedorItems, employeeItems, estoqueItems, activatedPlugins, receiveStockFromPurchase, addFinancialExpenseCategory, addFinancialIncomeCategory } = useAppStore();
  const [clientId, setClientId] = useState(editData?.clientId ?? draft?.clientId);
  const [clientSearch, setClientSearch] = useState('');
  const [supplierId, setSupplierId] = useState(editData?.supplierId ?? draft?.supplierId);
  const [employeeId, setEmployeeId] = useState(editData?.employeeId ?? draft?.employeeId);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [activeRelation, setActiveRelation] = useState<'client' | 'supplier' | 'employee' | null>(null);
  const [supplierDueDate, setSupplierDueDate] = useState(editData?.supplierDueDate ?? draft?.supplierDueDate ?? '');
  const [supplierPaid, setSupplierPaid] = useState(editData?.supplierPaid ?? draft?.supplierPaid ?? false);
  const [stockItemId, setStockItemId] = useState(editData?.stockItemId ?? draft?.stockItemId);
  const [stockQuantity, setStockQuantity] = useState(editData?.stockQuantity ? String(editData.stockQuantity) : draft?.stockQuantity ?? '');
  const [stockReceived, setStockReceived] = useState(editData?.stockReceived ?? draft?.stockReceived ?? false);

  const handleSave = () => {
    const num = parseCurrency(amount);
    if (!amount.trim() || isNaN(num) || num <= 0) return;
    if (!/^\d{2}\/\d{2}$/.test(transactionDate.trim())) return;
    if (!description.trim()) return;
    const finalDate = transactionDate.trim() || initialDateStr;

    const selectedClientId = clientId;
    const selectedSupplierId = supplierId;
    const selectedSupplierTerm = fornecedorItems.find((supplier) => supplier.id === selectedSupplierId)?.paymentTerm ?? '';
    const finalSupplierDueDate = type === 'saida' && selectedSupplierId
      ? supplierDueDate || suggestedDueDate(finalDate, selectedSupplierTerm)
      : undefined;

    const shouldReceiveStock = type === 'saida' && !!stockItemId && stockReceived && !!Number(stockQuantity.replace(',', '.'));
    const data = {
      date: finalDate,
      description: description.trim() || (type === 'entrada' ? 'Receita' : 'Despesa'),
      amount: type === 'entrada' ? num : -num,
      category: category.trim(),
      clientId: selectedClientId,
      supplierId: selectedSupplierId,
      employeeId,
      supplierDueDate: selectedSupplierId ? finalSupplierDueDate : undefined,
      supplierPaid: selectedSupplierId ? supplierPaid : undefined,
      stockItemId,
      stockQuantity: stockItemId ? Number(stockQuantity.replace(',', '.')) || undefined : undefined,
      stockReceived: stockItemId ? (editData?.stockReceived ?? false) : undefined,
    };
    const transactionId = onSave(data);
    clearPendingTransactionDraft();
    if (shouldReceiveStock && data.stockItemId && data.stockQuantity) {
      receiveStockFromPurchase(transactionId, data.stockItemId, data.stockQuantity);
    }
  };

  const canSave =
    amount.trim().length > 0 &&
    parseCurrency(amount) > 0 &&
    /^\d{2}\/\d{2}$/.test(transactionDate.trim()) &&
    description.trim().length > 0;

  const presetAmounts = ['10', '50', '100', '200', '500'];

  const discardDraft = () => {
    clearPendingTransactionDraft();
    onCancel();
  };

  const saveDraftBeforeNavigation = () => {
    pendingTransactionDraft = {
      amount,
      type,
      expanded,
      description,
      category,
      transactionDate,
      clientId,
      supplierId,
      employeeId,
      supplierDueDate,
      supplierPaid,
      stockItemId,
      stockQuantity,
      stockReceived,
    };
    preserveDraftOnClose = true;
  };

  const goToPluginStore = (pluginId: 'clientes' | 'fornecedores' | 'equipe') => {
    saveDraftBeforeNavigation();
    onCancel();
    const relation = pluginId === 'clientes' ? 'client' : pluginId === 'fornecedores' ? 'supplier' : 'employee';
    router.push(`/plugins/store?highlight=${pluginId}&returnToFinance=1&relation=${relation}` as any);
  };
  const goToPlugin = (pluginId: 'clientes' | 'fornecedores' | 'equipe') => {
    const route = getPluginDefinition(pluginId)?.route;
    if (route) {
      saveDraftBeforeNavigation();
      onCancel();
      const relation = pluginId === 'clientes' ? 'client' : pluginId === 'fornecedores' ? 'supplier' : 'employee';
      router.push(`${route}?returnToFinance=1&relation=${relation}` as any);
    }
  };

  const goToRelationPlugin = (pluginId: 'clientes' | 'fornecedores' | 'equipe') => {
    if (activatedPlugins.includes(pluginId)) goToPlugin(pluginId);
    else goToPluginStore(pluginId);
  };

  const renderCategorySelector = () => {
    const categoryOptions = type === 'entrada' ? incomeCategories : categories;

    return (
      <TagSelector
        title="Tag"
        hint={type === 'entrada' ? 'Como você identifica esse recebimento?' : 'Organize essa saída'}
        tags={categoryOptions}
        selected={category}
        onSelect={setCategory}
        onAdd={type === 'entrada' ? addFinancialIncomeCategory : addFinancialExpenseCategory}
      />
    );
  };

  const renderRelationSelector = (relation: 'client' | 'supplier' | 'employee') => {
    const isClient = relation === 'client';
    const isSupplier = relation === 'supplier';
    const items = isClient ? clienteItems : isSupplier ? fornecedorItems : employeeItems;
    const selectedId = isClient ? clientId : isSupplier ? supplierId : employeeId;
    const pluginId = isClient ? 'clientes' : isSupplier ? 'fornecedores' : 'equipe';
    const label = isClient ? 'Cliente' : isSupplier ? 'Fornecedor' : 'Funcionário';
    const search = isClient ? clientSearch : isSupplier ? supplierSearch : employeeSearch;
    const setSearch = isClient ? setClientSearch : isSupplier ? setSupplierSearch : setEmployeeSearch;
    const visibleItems = search.trim()
      ? items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
      : items;
    const clear = () => {
      if (isClient) setClientId(undefined);
      else if (isSupplier) {
        setSupplierId(undefined);
        setSupplierDueDate('');
      } else setEmployeeId(undefined);
    };

    return (
      <>
        <TouchableOpacity
          style={styles.relationSummary}
          onPress={() => setActiveRelation((current) => current === relation ? null : relation)}
        >
          <View style={styles.relationSummaryText}>
            <Text style={styles.relationSummaryLabel}>{label}</Text>
            <Text style={styles.relationSummaryValue} numberOfLines={1}>
              {items.find((item) => item.id === selectedId)?.name ?? 'Não atribuído'}
            </Text>
          </View>
          <Ionicons
            name={activeRelation === relation ? 'chevron-up' : 'chevron-down'}
            size={17}
            color={Colors.textMuted}
          />
        </TouchableOpacity>
        {activeRelation === relation && (
          <View style={styles.relationPanel}>
            <View style={styles.relationPanelHeader}>
              <Text style={styles.relationPanelTitle}>Vincular {label.toLowerCase()}</Text>
              <TouchableOpacity style={styles.addRelationChip} onPress={() => goToRelationPlugin(pluginId)}>
                <Ionicons name="add" size={15} color={Colors.accent} />
                <Text style={styles.addRelationText}>Novo</Text>
              </TouchableOpacity>
            </View>
            {items.length > 3 && (
              <View style={styles.relationSearch}>
                <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Buscar ${label.toLowerCase()}`}
                  placeholderTextColor={Colors.textMuted}
                  style={styles.relationSearchInput}
                  returnKeyType="search"
                />
              </View>
            )}
            <View style={styles.relationOptions}>
              <TouchableOpacity
                style={[styles.categoryChip, !selectedId && styles.categoryChipActive]}
                onPress={clear}
              >
                <Text style={[styles.categoryChipText, !selectedId && styles.categoryChipTextActive]}>Não atribuir</Text>
              </TouchableOpacity>
              {visibleItems.map((item) => {
                const active = selectedId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => {
                      if (isClient) setClientId(item.id);
                      else if (isSupplier) {
                        setSupplierId(item.id);
                        const supplier = fornecedorItems.find((candidate) => candidate.id === item.id);
                        setSupplierDueDate(supplierDueDate || suggestedDueDate(transactionDate, supplier?.paymentTerm ?? '') || '');
                      } else setEmployeeId(item.id);
                      setActiveRelation(null);
                    }}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isEditing ? 'Editar transação' : 'Nova transação'}</Text>

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'saida' && styles.typeBtnOut]}
          onPress={() => setType('saida')}
        >
          <Text style={[styles.typeBtnText, type === 'saida' && styles.typeBtnTextActive]}>
            Saída
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'entrada' && styles.typeBtnIn]}
          onPress={() => setType('entrada')}
        >
          <Text style={[styles.typeBtnText, type === 'entrada' && styles.typeBtnTextActive]}>
            Entrada
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Valor *</Text>
      <TextInput
        style={styles.amountInput}
        value={amount}
             onChangeText={(value) => setAmount(formatCurrencyInput(value))}
        placeholder="R$ 0,00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
      />

      <View style={styles.presetRow}>
        {presetAmounts.map((v) => (
          <TouchableOpacity
            key={v}
            style={styles.presetBtn}
             onPress={() => setAmount(formatCurrencyValue(Number(v)))}
          >
            <Text style={styles.presetText}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Data *</Text>
      <TextInput
        style={styles.input}
        value={transactionDate}
        onChangeText={(value) => setTransactionDate(formatTransactionDateInput(value))}
        placeholder="DD/MM"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={5}
      />

      <Text style={styles.label}>Descrição *</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Ex: Gasolina posto BR"
        placeholderTextColor={Colors.textMuted}
      />

      {renderCategorySelector()}

      <TouchableOpacity
        style={styles.expandBtn}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.expandBtnText}>
          {expanded ? 'Menos detalhes' : 'Mais detalhes'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <>
          {renderRelationSelector('client')}
          {renderRelationSelector('supplier')}
          {renderRelationSelector('employee')}
          {!!supplierId && <>
            <View style={styles.supplierMetaRow}><Text style={styles.supplierMetaLabel}>Vencimento</Text><TextInput style={styles.dueDateInput} value={supplierDueDate} onChangeText={setSupplierDueDate} placeholder="AAAA-MM-DD" placeholderTextColor={Colors.textMuted} /></View>
            <TouchableOpacity style={styles.paidRow} onPress={() => setSupplierPaid((paid) => !paid)}><View style={[styles.checkBox, supplierPaid && styles.checkBoxActive]}>{supplierPaid && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.paidText}>Já pago</Text></TouchableOpacity>
          </>}
          {type === 'saida' && activatedPlugins.includes('estoque') && !!supplierId && <>
            <Text style={styles.label}>Receber no estoque</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              <TouchableOpacity style={[styles.categoryChip, !stockItemId && styles.categoryChipActive]} onPress={() => setStockItemId(undefined)}><Text style={[styles.categoryChipText, !stockItemId && styles.categoryChipTextActive]}>Não vincular</Text></TouchableOpacity>
              {estoqueItems.map((item) => <TouchableOpacity key={item.id} style={[styles.categoryChip, stockItemId === item.id && styles.categoryChipActive]} onPress={() => setStockItemId(item.id)}><Text style={[styles.categoryChipText, stockItemId === item.id && styles.categoryChipTextActive]}>{item.name}</Text></TouchableOpacity>)}
            </ScrollView>
            {!!stockItemId && <><TextInput style={styles.input} value={stockQuantity} onChangeText={setStockQuantity} placeholder="Quantidade recebida" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" /><TouchableOpacity style={styles.paidRow} onPress={() => setStockReceived((received) => !received)}><View style={[styles.checkBox, stockReceived && styles.checkBoxActive]}>{stockReceived && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.paidText}>Compra recebida, dar entrada agora</Text></TouchableOpacity></>}
          </>}
        </>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={discardDraft}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>
            {isEditing ? 'Salvar' : 'Adicionar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...taskFormStyles,
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  typeBtnOut: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  typeBtnIn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typeBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  typeBtnTextActive: { color: '#FFF' },
  amountInput: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.display,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  categoryRow: {
    gap: 6,
    paddingVertical: 2,
  },
  relationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  relationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  relationSummaryText: { flex: 1, gap: 1 },
  relationSummaryLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  relationSummaryValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  relationPanel: {
    marginTop: 2,
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  relationPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  relationPanelTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  addRelationText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  relationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  relationSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  relationSearchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  categoryChipTextActive: { color: '#FFF' },
  addRelationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: '#FFFFFF',
  },
  expandBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  expandBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  supplierMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  supplierMetaLabel: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary },
  dueDateInput: { ...taskFormStyles.input, width: 130 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  checkBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkMark: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xs },
  paidText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary },
});
