import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import type { CatalogItem, OrderItem } from '../store';

type Props = {
  item: OrderItem;
  catalogItems: CatalogItem[];
  onChange: (updates: Partial<OrderItem>) => void;
  allowStandalone?: boolean;
  onCreateCatalog?: () => void;
};

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export function DocumentItemPicker({ item, catalogItems, onChange, allowStandalone = true, onCreateCatalog }: Props) {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState(item.catalogItemId ? item.name : '');
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalogItems.filter((candidate) => candidate.active && (!normalized || candidate.name.toLowerCase().includes(normalized))).slice(0, 6);
  }, [catalogItems, query]);

  const select = (candidate: CatalogItem) => {
    onChange({ name: candidate.name, unitPrice: candidate.unitPrice, catalogItemId: candidate.id, kind: candidate.needsReview ? undefined : candidate.kind, stockItemId: candidate.controlStock ? candidate.stockItemId : undefined });
    setQuery(candidate.name);
    setFocused(false);
    Keyboard.dismiss();
  };

  const makeStandalone = () => {
    onChange({ catalogItemId: undefined, kind: undefined, stockItemId: undefined });
    setQuery('');
    setFocused(true);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Ionicons name="search-outline" size={17} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          value={item.catalogItemId ? item.name : query || item.name}
          onFocus={() => setFocused(true)}
          onChangeText={(value) => {
            setQuery(value);
            onChange({ name: value, catalogItemId: undefined, kind: undefined, stockItemId: undefined });
          }}
          placeholder="Buscar no catálogo ou digitar item"
          placeholderTextColor={Colors.textMuted}
        />
      </View>
      {focused && (
        <View style={styles.results}>
          {results.map((candidate) => (
            <TouchableOpacity key={candidate.id} style={styles.result} onPress={() => select(candidate)}>
              <View style={styles.resultCopy}>
                <Text style={styles.name} numberOfLines={1}>{candidate.name}</Text>
                <Text style={styles.meta}>{candidate.kind === 'produto' ? 'Produto' : 'Serviço'} · {candidate.unit}</Text>
              </View>
              <Text style={styles.price}>{money(candidate.unitPrice)}</Text>
            </TouchableOpacity>
          ))}
          {allowStandalone ? (
            <TouchableOpacity style={styles.standalone} onPress={makeStandalone}>
              <Ionicons name="create-outline" size={17} color={Colors.accent} />
              <Text style={styles.standaloneText}>Item avulso (fora do catálogo)</Text>
            </TouchableOpacity>
          ) : onCreateCatalog ? (
            <TouchableOpacity style={styles.standalone} onPress={onCreateCatalog}>
              <Ionicons name="add-circle-outline" size={17} color={Colors.accent} />
              <Text style={styles.standaloneText}>Cadastrar produto no Catálogo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.bgCard, borderRadius: Radius.sm, paddingHorizontal: Spacing.md },
  input: { flex: 1, padding: Spacing.md, color: Colors.primary },
  results: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultCopy: { flex: 1 },
  name: { color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  price: { color: Colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs },
  standalone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  standaloneText: { color: Colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm },
});

export default DocumentItemPicker;
