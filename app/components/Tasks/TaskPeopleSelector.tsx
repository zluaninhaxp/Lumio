import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store';
import { getPluginDefinition } from '../../../src/plugins/registry';

export type Relation = 'client' | 'supplier' | 'employee';

type PersonItem = {
  id: string;
  name: string;
  contact?: string;
  role?: string;
};

type PersonOption = PersonItem;

interface TaskPeopleSelectorProps {
  clientId?: string;
  supplierId?: string;
  employeeId?: string;
  relations?: Relation[];
  title?: string | null;
  onChange: (relation: Relation, id?: string) => void;
  onBeforeNavigate?: (relation: Relation) => void;
}

const SEARCH_DELAY = 180;
const PREVIEW_LIMIT = 8;
const RECENT_LIMIT = 4;
const OPTION_HEIGHT = 56;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const relationLabels: Record<Relation, string> = {
  client: 'Cliente',
  supplier: 'Fornecedor',
  employee: 'Funcionário',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function relationDetails(item: PersonItem, relation: Relation) {
  if (relation === 'employee') return item.role || item.contact || 'Funcionário cadastrado';
  return item.contact || (relation === 'client' ? 'Cliente cadastrado' : 'Fornecedor cadastrado');
}

function sortPeople(items: PersonOption[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return [...items].sort((a, b) => {
    if (normalized) {
      const aName = a.name.toLocaleLowerCase();
      const bName = b.name.toLocaleLowerCase();
      const aStarts = aName.startsWith(normalized) ? 0 : 1;
      const bStarts = bName.startsWith(normalized) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
    }
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });
}

export function TaskPeopleSelector({
  clientId,
  supplierId,
  employeeId,
  relations = ['client', 'supplier', 'employee'],
  title = 'Atribuir para',
  onChange,
  onBeforeNavigate,
}: TaskPeopleSelectorProps) {
  const router = useRouter();
  const { clienteItems, fornecedorItems, employeeItems, activatedPlugins } = useAppStore();
  const [activeRelation, setActiveRelation] = useState<Relation | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentIds, setRecentIds] = useState<Partial<Record<Relation, string[]>>>({});
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const data: Record<Relation, { items: PersonItem[]; selected?: string }> = {
    client: { items: clienteItems, selected: clientId },
    supplier: { items: fornecedorItems, selected: supplierId },
    employee: { items: employeeItems, selected: employeeId },
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (activeRelation === null) {
      setQuery('');
      setDebouncedQuery('');
      sheetTranslateY.setValue(0);
      backdropOpacity.setValue(0);
    } else {
      sheetTranslateY.setValue(0);
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [activeRelation, backdropOpacity, sheetTranslateY]);

  const openRelationPlugin = (relation: Relation) => {
    const pluginId = relation === 'client' ? 'clientes' : relation === 'supplier' ? 'fornecedores' : 'equipe';
    const navigate = () => {
      if (activatedPlugins.includes(pluginId)) {
        const route = getPluginDefinition(pluginId)?.route;
        if (route) router.push(route as any);
      } else {
        router.push(`/plugins/store?highlight=${pluginId}` as any);
      }
    };
    closePicker();
    setTimeout(() => {
      if (onBeforeNavigate) {
        onBeforeNavigate(relation);
        return;
      }
      navigate();
    }, 240);
  };

  const closePicker = useCallback(() => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setActiveRelation(null));
  }, [backdropOpacity, sheetTranslateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => sheetTranslateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 0.8) {
          closePicker();
          return;
        }
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
      },
    }),
  ).current;

  const selectPerson = (relation: Relation, id?: string) => {
    if (id) {
      setRecentIds((current) => ({
        ...current,
        [relation]: [id, ...(current[relation] ?? []).filter((recentId) => recentId !== id)].slice(0, RECENT_LIMIT),
      }));
    }
    onChange(relation, id);
    // Selection closes immediately so a parent rerender cannot leave the nested Modal intercepting touches.
    sheetTranslateY.stopAnimation();
    backdropOpacity.stopAnimation();
    sheetTranslateY.setValue(0);
    backdropOpacity.setValue(0);
    setActiveRelation(null);
  };

  const activeItems = activeRelation ? data[activeRelation].items : [];
  const activeOptions = useMemo<PersonOption[]>(() => {
    if (!activeRelation) return [];
    const options = activeItems.map((item) => ({ ...item }));
    const normalized = debouncedQuery.trim().toLocaleLowerCase();
    if (normalized) {
      return sortPeople(
        options.filter((item) => [item.name, item.contact, item.role].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(normalized))),
        debouncedQuery,
      );
    }

    const recent = (recentIds[activeRelation] ?? [])
      .map((id) => options.find((item) => item.id === id))
      .filter((item): item is PersonOption => Boolean(item));
    const recentSet = new Set(recent.map((item) => item.id));
    const preview = sortPeople(options.filter((item) => !recentSet.has(item.id)), '');
    return [...recent, ...preview].slice(0, activeItems.length > PREVIEW_LIMIT ? PREVIEW_LIMIT : activeItems.length);
  }, [activeItems, activeRelation, debouncedQuery, recentIds]);

  return (
    <View style={styles.container}>
      {title !== null && <Text style={styles.title}>{title}</Text>}
      {relations.map((relation) => {
        const current = data[relation];
        const selected = current.items.find((item) => item.id === current.selected);
        return (
          <TouchableOpacity key={relation} style={styles.summary} onPress={() => setActiveRelation(relation)}>
            <View style={styles.summaryIcon}>
              <Ionicons name={relation === 'employee' ? 'briefcase-outline' : 'person-outline'} size={17} color={Colors.accent} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.label}>{relationLabels[relation]}</Text>
              <Text style={[styles.value, !selected && styles.emptyValue]} numberOfLines={1}>
                {selected?.name ?? 'Não atribuído'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        );
      })}

      <Modal visible={activeRelation !== null} transparent animationType="none" onRequestClose={closePicker}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closePicker}>
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]} />
          </Pressable>
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            {activeRelation && (
              <>
                <View style={styles.handleHitArea} {...panResponder.panHandlers}>
                  <View style={styles.handle} />
                </View>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeading}>
                    <Text style={styles.modalEyebrow}>Selecionar {relationLabels[activeRelation].toLowerCase()}</Text>
                    <Text style={styles.modalTitle}>Quem você quer vincular?</Text>
                  </View>
                  <TouchableOpacity style={styles.closeButton} onPress={closePicker} accessibilityLabel="Fechar seleção">
                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.createButton} onPress={() => openRelationPlugin(activeRelation)}>
                  <View style={styles.createIcon}><Ionicons name="add" size={18} color={Colors.accent} /></View>
                  <View style={styles.createText}>
                    <Text style={styles.createTitle}>Criar novo {relationLabels[activeRelation].toLowerCase()}</Text>
                    <Text style={styles.createHint}>Cadastrar e voltar para este formulário</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={17} color={Colors.accent} />
                </TouchableOpacity>

                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    autoFocus
                    value={query}
                    onChangeText={setQuery}
                    placeholder={`Buscar por nome${activeRelation === 'employee' ? ' ou cargo' : ''}`}
                    placeholderTextColor={Colors.textMuted}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                  {query.length > 0 && query !== debouncedQuery && <ActivityIndicator size="small" color={Colors.accent} />}
                </View>

                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>{debouncedQuery ? 'Resultados' : activeItems.length > PREVIEW_LIMIT ? 'Recentes e sugestões' : 'Pessoas cadastradas'}</Text>
                  <Text style={styles.resultCount}>{debouncedQuery ? `${activeOptions.length} encontrada${activeOptions.length === 1 ? '' : 's'}` : `${activeItems.length} cadastrada${activeItems.length === 1 ? '' : 's'}`}</Text>
                </View>

                <FlatList
                  data={activeOptions}
                  style={styles.resultList}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={10}
                  getItemLayout={(_, index) => ({ length: OPTION_HEIGHT, offset: OPTION_HEIGHT * index, index })}
                  contentContainerStyle={styles.resultContent}
                  renderItem={({ item }) => {
                    const selected = data[activeRelation].selected === item.id;
                    return (
                      <TouchableOpacity style={styles.option} onPress={() => selectPerson(activeRelation, item.id)}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.name)}</Text></View>
                        <View style={styles.optionText}>
                          <Text style={styles.optionName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.optionMeta} numberOfLines={1}>{relationDetails(item, activeRelation)}</Text>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={21} color={Colors.accent} />}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name={debouncedQuery ? 'search-outline' : 'people-outline'} size={28} color={Colors.textMuted} />
                      <Text style={styles.emptyTitle}>{debouncedQuery ? 'Nenhuma pessoa encontrada' : 'Nenhuma pessoa cadastrada'}</Text>
                      <Text style={styles.emptyHint}>{debouncedQuery ? 'Tente outro nome, contato ou cargo.' : 'Use “Criar novo” acima para cadastrar a primeira.'}</Text>
                    </View>
                  }
                />

                <TouchableOpacity style={styles.unassignButton} onPress={() => selectPerson(activeRelation)}>
                  <Ionicons name="close-circle-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.unassignText}>Não atribuir</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  summary: {
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentLight,
  },
  summaryText: { flex: 1, gap: 1 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.textMuted },
  value: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  emptyValue: { color: Colors.textMuted, fontFamily: 'PlusJakartaSans_500Medium' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.42)' },
  modalSheet: {
    height: '78%',
    maxHeight: '91%',
    minHeight: '58%',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    zIndex: 2,
    elevation: 2,
  },
  handleHitArea: { width: '100%', minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  modalHeading: { flex: 1, gap: 2 },
  modalEyebrow: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.accent, textTransform: 'uppercase' },
  modalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, color: Colors.primary },
  closeButton: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: '#BFEBDD' },
  createIcon: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard },
  createText: { flex: 1, gap: 2 },
  createTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accent },
  createHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textSecondary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 42, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  searchInput: { flex: 1, paddingVertical: Spacing.sm, fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.md, color: Colors.primary },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, marginBottom: Spacing.xs },
  resultTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  resultCount: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textMuted },
  resultList: { flex: 1 },
  resultContent: { paddingBottom: Spacing.sm },
  option: { minHeight: OPTION_HEIGHT, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
  avatarText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xs, color: '#FFFFFF' },
  optionText: { flex: 1, gap: 2 },
  optionName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  optionMeta: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textMuted },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.xs },
  emptyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  emptyHint: { maxWidth: 260, fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  unassignButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingTop: Spacing.md },
  unassignText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary },
});
