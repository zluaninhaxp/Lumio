import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import type { CatalogItem, OrderItem } from '../store';

type Props = {
  item: Omit<OrderItem, 'unitPrice'> & { unitPrice: number | string };
  catalogItems: CatalogItem[];
  onChange: (updates: Partial<OrderItem>) => void;
  allowStandalone?: boolean;
  onCreateCatalog?: () => void;
};

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const normalizeSearch = (value: string) => value
  .toLocaleLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function searchRank(candidate: CatalogItem, query: string) {
  const name = normalizeSearch(candidate.name);
  const unit = normalizeSearch(candidate.unit);
  const words = `${name} ${unit}`.split(/\s+/).filter(Boolean);
  const startsWord = words.some((word) => word.startsWith(query));
  const startsName = name.startsWith(query);
  if (startsName) return 0;
  if (startsWord) return 1;
  if (query.length >= 3 && (name.includes(query) || unit.includes(query))) return 2;
  return -1;
}

export function DocumentItemPicker({ item, catalogItems, onChange, allowStandalone = true, onCreateCatalog }: Props) {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState(item.catalogItemId ? item.name : '');
  useEffect(() => {
    if (!focused) setQuery(item.catalogItemId ? item.name : '');
  }, [focused, item.catalogItemId, item.name]);
  const results = useMemo(() => {
    const normalized = normalizeSearch(query.trim());
    if (!normalized) return [];
    return catalogItems
      .filter((candidate) => candidate.active)
      .map((candidate) => ({ candidate, rank: searchRank(candidate, normalized) }))
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.candidate.name.localeCompare(b.candidate.name, 'pt-BR', { sensitivity: 'base' }))
      .slice(0, 6)
      .map(({ candidate }) => candidate);
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
          onFocus={() => {
            setFocused(true);
            setQuery(item.catalogItemId ? '' : item.name);
          }}
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
