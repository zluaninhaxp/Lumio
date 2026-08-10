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

interface QuickAddFormProps {
  onSave: (data: Omit<Transaction, 'id'>) => void;
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

    onSave({
      date: finalDate,
      description: description.trim() || (type === 'entrada' ? 'Receita' : 'Despesa'),
      amount: type === 'entrada' ? num : -num,
      category: category || 'Outros',
    });
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
