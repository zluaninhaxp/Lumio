import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import type { Transaction } from '../../../src/store';
import { useAppStore } from '../../../src/store';
import { suggestedDueDate } from '../../../src/utils/supplier';

interface QuickAddFormProps {
  onSave: (data: Omit<Transaction, 'id'>) => string;
  onCancel: () => void;
  editData?: Transaction | null;
  categories: string[];
}

export function QuickAddForm({ onSave, onCancel, editData, categories }: QuickAddFormProps) {
  const isEditing = !!editData;
  const initialAmount = editData ? String(Math.abs(editData.amount)).replace('.', ',') : '';
  const initialType: 'saida' | 'entrada' = editData
    ? editData.amount > 0
      ? 'entrada'
      : 'saida'
    : 'saida';
  const initialDesc = editData
    ? editData.description === 'Receita' || editData.description === 'Despesa'
      ? ''
      : editData.description
    : '';
  const initialCategory = editData
    ? editData.category
    : initialType === 'entrada'
    ? 'Receita'
    : categories.length > 0
    ? categories[0]
    : 'Outros';

  const [amount, setAmount] = useState(initialAmount);
  const [type, setType] = useState<'saida' | 'entrada'>(initialType);
  const [expanded, setExpanded] = useState(isEditing);
  const [description, setDescription] = useState(initialDesc);
  const [category, setCategory] = useState(initialCategory);

  const today = new Date();
  const initialDateStr = editData
    ? editData.date
    : today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const [transactionDate, setTransactionDate] = useState(initialDateStr);
  const { clienteItems, addClienteItem, fornecedorItems, addFornecedorItem, estoqueItems, activatedPlugins, receiveStockFromPurchase } = useAppStore();
  const [clientId, setClientId] = useState(editData?.clientId);
  const [newClientName, setNewClientName] = useState('');
  const [newClientContact, setNewClientContact] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);
  const [supplierId, setSupplierId] = useState(editData?.supplierId);
  const [supplierDueDate, setSupplierDueDate] = useState(editData?.supplierDueDate ?? '');
  const [supplierPaid, setSupplierPaid] = useState(editData?.supplierPaid ?? false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierTerm, setNewSupplierTerm] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [stockItemId, setStockItemId] = useState(editData?.stockItemId);
  const [stockQuantity, setStockQuantity] = useState(editData?.stockQuantity ? String(editData.stockQuantity) : '');
  const [stockReceived, setStockReceived] = useState(editData?.stockReceived ?? false);

  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (type === 'entrada') {
      setCategory('Receita');
    } else if (categories.length > 0 && (category === 'Receita' || !categories.includes(category))) {
      setCategory(categories[0]);
    }
  }, [type, categories]);

  const handleSave = () => {
    const num = parseFloat(amount.replace(',', '.'));
    if (!amount.trim() || isNaN(num) || num <= 0) return;
    if (!category.trim()) return;

    const finalDate = transactionDate.trim() || initialDateStr;

    let selectedClientId = clientId;
    if (type === 'entrada' && creatingClient && newClientName.trim()) {
      selectedClientId = addClienteItem({
        name: newClientName.trim(),
        contact: newClientContact.trim(),
        notes: '',
        createdAt: new Date().toISOString(),
      });
    }

    let selectedSupplierId = supplierId;
    let selectedSupplierTerm = fornecedorItems.find((supplier) => supplier.id === selectedSupplierId)?.paymentTerm ?? '';
    if (type === 'saida' && creatingSupplier && newSupplierName.trim()) {
      selectedSupplierId = addFornecedorItem({
        name: newSupplierName.trim(),
        contact: newSupplierContact.trim(),
        paymentTerm: newSupplierTerm.trim(),
        notes: '',
      });
      selectedSupplierTerm = newSupplierTerm.trim();
    }
    const finalSupplierDueDate = type === 'saida' && selectedSupplierId
      ? supplierDueDate || suggestedDueDate(finalDate, selectedSupplierTerm)
      : undefined;

    const shouldReceiveStock = type === 'saida' && !!stockItemId && stockReceived && !!Number(stockQuantity.replace(',', '.'));
    const data = {
      date: finalDate,
      description: description.trim() || (type === 'entrada' ? 'Receita' : 'Despesa'),
      amount: type === 'entrada' ? num : -num,
      category: category || 'Outros',
      clientId: type === 'entrada' ? selectedClientId : undefined,
      supplierId: type === 'saida' ? selectedSupplierId : undefined,
      supplierDueDate: finalSupplierDueDate,
      supplierPaid: type === 'saida' && selectedSupplierId ? supplierPaid : undefined,
      stockItemId: type === 'saida' ? stockItemId : undefined,
      stockQuantity: type === 'saida' && stockItemId ? Number(stockQuantity.replace(',', '.')) || undefined : undefined,
      stockReceived: type === 'saida' && stockItemId ? (editData?.stockReceived ?? false) : undefined,
    };
    const transactionId = onSave(data);
    if (shouldReceiveStock && data.stockItemId && data.stockQuantity) {
      receiveStockFromPurchase(transactionId, data.stockItemId, data.stockQuantity);
    }
  };

  const canSave =
    amount.trim().length > 0 &&
    !isNaN(parseFloat(amount.replace(',', '.'))) &&
    parseFloat(amount.replace(',', '.')) > 0 &&
      category.trim().length > 0;

  const presetAmounts = ['10', '50', '100', '200', '500'];

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

      <Text style={styles.label}>Valor</Text>
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
        </>
      )}

      {type === 'entrada' && (
        <>
          <Text style={styles.label}>Quem pagou?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <TouchableOpacity style={[styles.categoryChip, !clientId && !creatingClient && styles.categoryChipActive]} onPress={() => { setClientId(undefined); setCreatingClient(false); }}>
              <Text style={[styles.categoryChipText, !clientId && !creatingClient && styles.categoryChipTextActive]}>Sem cliente</Text>
            </TouchableOpacity>
            {clienteItems.map((client) => (
              <TouchableOpacity key={client.id} style={[styles.categoryChip, clientId === client.id && styles.categoryChipActive]} onPress={() => { setClientId(client.id); setCreatingClient(false); }}>
                <Text style={[styles.categoryChipText, clientId === client.id && styles.categoryChipTextActive]}>{client.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.categoryChip, creatingClient && styles.categoryChipActive]} onPress={() => { setCreatingClient(true); setClientId(undefined); }}>
              <Text style={[styles.categoryChipText, creatingClient && styles.categoryChipTextActive]}>+ Criar cliente</Text>
            </TouchableOpacity>
          </ScrollView>
          {creatingClient && <>
            <TextInput style={styles.input} value={newClientName} onChangeText={setNewClientName} placeholder="Nome do novo cliente" placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} value={newClientContact} onChangeText={setNewClientContact} placeholder="Contato (opcional)" placeholderTextColor={Colors.textMuted} />
          </>}
        </>
      )}

      {type === 'saida' && (
        <>
          <Text style={styles.label}>Fornecedor</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <TouchableOpacity style={[styles.categoryChip, !supplierId && !creatingSupplier && styles.categoryChipActive]} onPress={() => { setSupplierId(undefined); setCreatingSupplier(false); setSupplierDueDate(''); }}>
              <Text style={[styles.categoryChipText, !supplierId && !creatingSupplier && styles.categoryChipTextActive]}>Sem fornecedor</Text>
            </TouchableOpacity>
            {fornecedorItems.map((supplier) => (
              <TouchableOpacity key={supplier.id} style={[styles.categoryChip, supplierId === supplier.id && styles.categoryChipActive]} onPress={() => { setSupplierId(supplier.id); setCreatingSupplier(false); setSupplierDueDate(supplierDueDate || suggestedDueDate(transactionDate, supplier.paymentTerm) || ''); }}>
                <Text style={[styles.categoryChipText, supplierId === supplier.id && styles.categoryChipTextActive]}>{supplier.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.categoryChip, creatingSupplier && styles.categoryChipActive]} onPress={() => { setCreatingSupplier(true); setSupplierId(undefined); }}>
              <Text style={[styles.categoryChipText, creatingSupplier && styles.categoryChipTextActive]}>+ Criar fornecedor</Text>
            </TouchableOpacity>
          </ScrollView>
          {creatingSupplier && <>
            <TextInput style={styles.input} value={newSupplierName} onChangeText={setNewSupplierName} placeholder="Nome do fornecedor" placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} value={newSupplierContact} onChangeText={setNewSupplierContact} placeholder="Contato (opcional)" placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} value={newSupplierTerm} onChangeText={setNewSupplierTerm} placeholder="Prazo padrão (ex.: 30 dias)" placeholderTextColor={Colors.textMuted} />
          </>}
          {!!(supplierId || creatingSupplier) && <>
            <View style={styles.supplierMetaRow}><Text style={styles.supplierMetaLabel}>Vencimento</Text><TextInput style={styles.dueDateInput} value={supplierDueDate} onChangeText={setSupplierDueDate} placeholder="AAAA-MM-DD" placeholderTextColor={Colors.textMuted} /></View>
            <TouchableOpacity style={styles.paidRow} onPress={() => setSupplierPaid((paid) => !paid)}><View style={[styles.checkBox, supplierPaid && styles.checkBoxActive]}>{supplierPaid && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.paidText}>Já pago</Text></TouchableOpacity>
          </>}
          {activatedPlugins.includes('estoque') && !!(supplierId || creatingSupplier) && <>
            <Text style={styles.label}>Receber no estoque</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              <TouchableOpacity style={[styles.categoryChip, !stockItemId && styles.categoryChipActive]} onPress={() => setStockItemId(undefined)}><Text style={[styles.categoryChipText, !stockItemId && styles.categoryChipTextActive]}>Não vincular</Text></TouchableOpacity>
              {estoqueItems.map((item) => <TouchableOpacity key={item.id} style={[styles.categoryChip, stockItemId === item.id && styles.categoryChipActive]} onPress={() => setStockItemId(item.id)}><Text style={[styles.categoryChipText, stockItemId === item.id && styles.categoryChipTextActive]}>{item.name}</Text></TouchableOpacity>)}
            </ScrollView>
            {!!stockItemId && <><TextInput style={styles.input} value={stockQuantity} onChangeText={setStockQuantity} placeholder="Quantidade recebida" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" /><TouchableOpacity style={styles.paidRow} onPress={() => setStockReceived((received) => !received)}><View style={[styles.checkBox, stockReceived && styles.checkBoxActive]}>{stockReceived && <Text style={styles.checkMark}>✓</Text>}</View><Text style={styles.paidText}>Compra recebida, dar entrada agora</Text></TouchableOpacity></>}
          </>}
        </>
      )}

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
          <Text style={styles.label}>Data</Text>
          <TextInput
            style={styles.input}
            value={transactionDate}
            onChangeText={setTransactionDate}
            placeholder={initialDateStr}
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Ex: Gasolina posto BR"
            placeholderTextColor={Colors.textMuted}
          />
        </>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
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
  categoryChipTextActive: { color: '#FFF' },
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
