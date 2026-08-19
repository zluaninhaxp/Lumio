import React, { useState, useRef, useEffect } from 'react';
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

export function setPendingTransactionRelation(relation: 'client' | 'supplier', id: string) {
  if (!pendingTransactionDraft) return;
  if (relation === 'client') pendingTransactionDraft.clientId = id;
  else pendingTransactionDraft.supplierId = id;
}

export function QuickAddForm({ onSave, onCancel, editData, categories }: QuickAddFormProps) {
  const router = useRouter();
  const isEditing = !!editData;
  const draft = !editData ? pendingTransactionDraft : null;
  const initialAmount = editData ? String(Math.abs(editData.amount)).replace('.', ',') : draft?.amount ?? '';
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
  const { clienteItems, fornecedorItems, estoqueItems, activatedPlugins, receiveStockFromPurchase } = useAppStore();
  const [clientId, setClientId] = useState(editData?.clientId ?? draft?.clientId);
  const [clientSearch, setClientSearch] = useState('');
  const [supplierId, setSupplierId] = useState(editData?.supplierId ?? draft?.supplierId);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierDueDate, setSupplierDueDate] = useState(editData?.supplierDueDate ?? draft?.supplierDueDate ?? '');
  const [supplierPaid, setSupplierPaid] = useState(editData?.supplierPaid ?? draft?.supplierPaid ?? false);
  const [stockItemId, setStockItemId] = useState(editData?.stockItemId ?? draft?.stockItemId);
  const [stockQuantity, setStockQuantity] = useState(editData?.stockQuantity ? String(editData.stockQuantity) : draft?.stockQuantity ?? '');
  const [stockReceived, setStockReceived] = useState(editData?.stockReceived ?? draft?.stockReceived ?? false);

  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const handleSave = () => {
    const num = parseFloat(amount.replace(',', '.'));
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
      clientId: type === 'entrada' ? selectedClientId : undefined,
      supplierId: type === 'saida' ? selectedSupplierId : undefined,
      supplierDueDate: finalSupplierDueDate,
      supplierPaid: type === 'saida' && selectedSupplierId ? supplierPaid : undefined,
      stockItemId: type === 'saida' ? stockItemId : undefined,
      stockQuantity: type === 'saida' && stockItemId ? Number(stockQuantity.replace(',', '.')) || undefined : undefined,
      stockReceived: type === 'saida' && stockItemId ? (editData?.stockReceived ?? false) : undefined,
    };
    const transactionId = onSave(data);
    clearPendingTransactionDraft();
    if (shouldReceiveStock && data.stockItemId && data.stockQuantity) {
      receiveStockFromPurchase(transactionId, data.stockItemId, data.stockQuantity);
    }
  };

  const canSave =
    amount.trim().length > 0 &&
    !isNaN(parseFloat(amount.replace(',', '.'))) &&
    parseFloat(amount.replace(',', '.')) > 0 &&
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
      supplierDueDate,
      supplierPaid,
      stockItemId,
      stockQuantity,
      stockReceived,
    };
    preserveDraftOnClose = true;
  };

  const goToPluginStore = (pluginId: 'clientes' | 'fornecedores') => {
    saveDraftBeforeNavigation();
    onCancel();
    router.push(`/plugins/store?highlight=${pluginId}&returnToFinance=1&relation=${pluginId === 'clientes' ? 'client' : 'supplier'}` as any);
  };
  const goToPlugin = (pluginId: 'clientes' | 'fornecedores') => {
    const route = getPluginDefinition(pluginId)?.route;
    if (route) {
      saveDraftBeforeNavigation();
      onCancel();
      router.push(`${route}?returnToFinance=1&relation=${pluginId === 'clientes' ? 'client' : 'supplier'}` as any);
    }
  };

  const goToRelationPlugin = (pluginId: 'clientes' | 'fornecedores') => {
    if (activatedPlugins.includes(pluginId)) goToPlugin(pluginId);
    else goToPluginStore(pluginId);
  };

  const renderRelationSelector = (relation: 'client' | 'supplier') => {
    const isClient = relation === 'client';
    const items = isClient ? clienteItems : fornecedorItems;
    const selectedId = isClient ? clientId : supplierId;
    const pluginId = isClient ? 'clientes' : 'fornecedores';
    const label = isClient ? 'Cliente' : 'Fornecedor';
    const search = isClient ? clientSearch : supplierSearch;
    const setSearch = isClient ? setClientSearch : setSupplierSearch;
    const visibleItems = search.trim()
      ? items.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
      : items;
    const clear = () => {
      if (isClient) setClientId(undefined);
      else {
        setSupplierId(undefined);
        setSupplierDueDate('');
      }
    };

    return (
      <>
        <View style={styles.relationHeader}>
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={styles.relationActions}>
          <TouchableOpacity
            style={[styles.categoryChip, !selectedId && styles.categoryChipActive]}
            onPress={clear}
          >
            <Text style={[styles.categoryChipText, !selectedId && styles.categoryChipTextActive]}>
              Não atribuir
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addRelationChip}
            onPress={() => goToRelationPlugin(pluginId)}
          >
            <Ionicons name="add-circle-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.categoryChipText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
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
          {visibleItems.map((item) => {
            const active = selectedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => {
                  if (isClient) setClientId(item.id);
                  else {
                    setSupplierId(item.id);
                    const supplier = fornecedorItems.find((candidate) => candidate.id === item.id);
                    setSupplierDueDate(supplierDueDate || suggestedDueDate(transactionDate, supplier?.paymentTerm ?? '') || '');
                  }
                }}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
        ref={amountRef}
        style={styles.amountInput}
        value={amount}
        onChangeText={setAmount}
        placeholder="0,00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
      />

      <View style={styles.presetRow}>
        {presetAmounts.map((v) => (
          <TouchableOpacity
            key={v}
            style={styles.presetBtn}
            onPress={() => setAmount(v)}
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
          {type === 'entrada' && renderRelationSelector('client')}
          {type === 'saida' && (
            <>
              <Text style={styles.label}>Categoria</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {categories.map((cat) => {
                  const active = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {renderRelationSelector('supplier')}
              {!!supplierId && <>
                <View style={styles.supplierMetaRow}><Text style={styles.supplierMetaLabel}>Vencimento</Text><TextInput style={styles.dueDateInput} value={supplierDueDate} onChangeText={setSupplierDueDate} placeholder="AAAA-MM-DD" placeholderTextColor={Colors.textMuted} /></View>
                <TouchableOpacity style={styles.paidRow} onPress={() => setSupplierPaid((paid) => !paid)}><View style={[styles.checkBox, supplierPaid && styles.checkBoxActive]}>{supplierPaid && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.paidText}>Já pago</Text></TouchableOpacity>
              </>}
              {activatedPlugins.includes('estoque') && !!supplierId && <>
                <Text style={styles.label}>Receber no estoque</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                  <TouchableOpacity style={[styles.categoryChip, !stockItemId && styles.categoryChipActive]} onPress={() => setStockItemId(undefined)}><Text style={[styles.categoryChipText, !stockItemId && styles.categoryChipTextActive]}>Não vincular</Text></TouchableOpacity>
                  {estoqueItems.map((item) => <TouchableOpacity key={item.id} style={[styles.categoryChip, stockItemId === item.id && styles.categoryChipActive]} onPress={() => setStockItemId(item.id)}><Text style={[styles.categoryChipText, stockItemId === item.id && styles.categoryChipTextActive]}>{item.name}</Text></TouchableOpacity>)}
                </ScrollView>
                {!!stockItemId && <><TextInput style={styles.input} value={stockQuantity} onChangeText={setStockQuantity} placeholder="Quantidade recebida" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" /><TouchableOpacity style={styles.paidRow} onPress={() => setStockReceived((received) => !received)}><View style={[styles.checkBox, stockReceived && styles.checkBoxActive]}>{stockReceived && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.paidText}>Compra recebida, dar entrada agora</Text></TouchableOpacity></>}
              </>}
            </>
          )}
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
  container: { gap: Spacing.sm },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
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
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  typeBtnTextActive: { color: '#FFF' },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
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
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  categoryRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  relationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  relationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  relationSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 150,
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
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
  input: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  supplierMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  supplierMetaLabel: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary },
  dueDateInput: { width: 130, backgroundColor: Colors.bg, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: 'PlusJakartaSans_400Regular', color: Colors.primary, borderWidth: 1, borderColor: Colors.border },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  checkBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkMark: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xs },
  paidText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: '#FFF',
  },
});
