import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../../src/constants/theme';
import type { CatalogItem } from '../../src/store';

type Props = {
  selectedId?: string;
  items: CatalogItem[];
  onChange: (id?: string) => void;
  onBeforeNavigate?: () => void;
};

export function CatalogItemSelector({ selectedId, items, onChange, onBeforeNavigate }: Props) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const selected = items.find((item) => item.id === selectedId);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items
      .filter((item) => !normalized || `${item.name} ${item.unit}`.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [items, query]);

  const close = () => {
    setVisible(false);
    setQuery('');
  };

  return (
    <View>
      <TouchableOpacity style={styles.summary} onPress={() => setVisible(true)}>
        <View style={styles.summaryIcon}><Ionicons name="cube-outline" size={17} color={Colors.accent} /></View>
        <View style={styles.summaryText}>
          <Text style={styles.label}>Produto</Text>
          <Text style={[styles.value, !selected && styles.emptyValue]} numberOfLines={1}>{selected?.name ?? 'Não selecionado'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View><Text style={styles.eyebrow}>Selecionar produto</Text><Text style={styles.title}>Qual produto controlar?</Text></View>
              <TouchableOpacity onPress={close} style={styles.close}><Ionicons name="close" size={20} color={Colors.textSecondary} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.createButton} onPress={() => { close(); onBeforeNavigate?.(); }}>
              <View style={styles.createIcon}><Ionicons name="add" size={18} color={Colors.accent} /></View>
              <View style={styles.createText}><Text style={styles.createTitle}>Criar novo produto</Text><Text style={styles.createHint}>Cadastrar no Catálogo e voltar para este formulário</Text></View>
              <Ionicons name="arrow-forward" size={17} color={Colors.accent} />
            </TouchableOpacity>
            <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={Colors.textMuted} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Buscar produto" placeholderTextColor={Colors.textMuted} style={styles.searchInput} /></View>
            <View style={styles.resultHeader}><Text style={styles.resultTitle}>{query ? 'Resultados' : 'Produtos cadastrados'}</Text><Text style={styles.resultCount}>{results.length} produto{results.length === 1 ? '' : 's'}</Text></View>
            <View style={styles.list}>{results.map((item) => <TouchableOpacity key={item.id} style={styles.option} onPress={() => { onChange(item.id); close(); }}><View style={styles.avatar}><Ionicons name="cube-outline" size={17} color="#FFFFFF" /></View><View style={styles.optionText}><Text style={styles.optionName} numberOfLines={1}>{item.name}</Text><Text style={styles.optionMeta}>{item.unit}{item.controlStock ? ' · estoque controlado' : ''}</Text></View>{item.id === selectedId && <Ionicons name="checkmark-circle" size={21} color={Colors.accent} />}</TouchableOpacity>)}</View>
            {results.length === 0 && <View style={styles.emptyState}><Ionicons name="search-outline" size={28} color={Colors.textMuted} /><Text style={styles.emptyTitle}>Nenhum produto encontrado</Text><Text style={styles.emptyHint}>Use “Criar novo produto” acima para cadastrar.</Text></View>}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { minHeight: 42, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryIcon: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentLight },
  summaryText: { flex: 1, gap: 1 }, label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.textMuted }, value: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary }, emptyValue: { color: Colors.textMuted, fontFamily: 'PlusJakartaSans_500Medium' },
  overlay: { flex: 1, justifyContent: 'flex-end' }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' }, sheet: { height: '78%', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, backgroundColor: Colors.bgCard }, handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginVertical: Spacing.md }, header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md }, eyebrow: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.accent, textTransform: 'uppercase' }, title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, color: Colors.primary }, close: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }, createButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: '#BFEBDD' }, createIcon: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard }, createText: { flex: 1, gap: 2 }, createTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accent }, createHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textSecondary }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 42, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg }, searchInput: { flex: 1, paddingVertical: Spacing.sm, color: Colors.primary }, resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, marginBottom: Spacing.xs }, resultTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary }, resultCount: { fontSize: FontSize.xs, color: Colors.textMuted }, list: { flex: 1 }, option: { minHeight: 56, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border }, avatar: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary }, optionText: { flex: 1, gap: 2 }, optionName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary }, optionMeta: { fontSize: FontSize.xs, color: Colors.textMuted }, emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.xs }, emptyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs }, emptyHint: { maxWidth: 260, fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
});
