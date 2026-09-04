import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../../src/constants/theme';

interface TagSelectorProps {
  title: string;
  hint?: string;
  tags: string[];
  selected?: string | string[];
  onSelect: (tag: string) => void;
  onAdd: (tag: string) => void;
  accent?: string;
}

export function TagSelector({ title, hint, tags, selected, onSelect, onAdd, accent = Colors.accent }: TagSelectorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const value = draft.trim();
    if (!value || tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onAdd(value);
    onSelect(value);
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {!!hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
        <Text style={styles.count}>{tags.length} {tags.length === 1 ? 'opção' : 'opções'}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tags.map((tag) => {
          const active = Array.isArray(selected) ? selected.includes(tag) : selected === tag;
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, active && { backgroundColor: accent, borderColor: accent }]}
              onPress={() => onSelect(tag)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {active && <Ionicons name="checkmark" size={14} color="#FFF" />}
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.addChip} onPress={() => setAdding((value) => !value)}>
          <Ionicons name={adding ? 'close-outline' : 'add'} size={16} color={accent} />
          <Text style={[styles.addText, { color: accent }]}>{adding ? 'Fechar' : 'Nova tag'}</Text>
        </TouchableOpacity>
      </ScrollView>
      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ex.: Serviços recorrentes"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          <TouchableOpacity style={[styles.confirm, { backgroundColor: accent }]} onPress={submit} disabled={!draft.trim()}>
            <Ionicons name="checkmark" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.sm },
  title: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary },
  hint: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  count: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textMuted },
  row: { gap: 6, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 210, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  chipText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: '#FFF' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  addText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, color: Colors.primary, fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm },
  confirm: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
