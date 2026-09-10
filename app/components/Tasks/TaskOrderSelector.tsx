import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../../src/constants/theme';

type OrderOption = { id: string; label: string };

interface TaskOrderSelectorProps {
  orders: OrderOption[];
  selectedId?: string;
  onChange: (id?: string) => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SEARCH_DELAY = 180;
const OPTION_HEIGHT = 56;

export function TaskOrderSelector({ orders, selectedId, onChange }: TaskOrderSelectorProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const selected = orders.find((order) => order.id === selectedId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setDebouncedQuery('');
      translateY.setValue(0);
      backdropOpacity.setValue(0);
      return;
    }
    translateY.setValue(0);
    Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [backdropOpacity, translateY, visible]);

  const close = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const select = (id?: string) => {
    onChange(id);
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();
    translateY.setValue(0);
    backdropOpacity.setValue(0);
    setVisible(false);
  };

  const options = useMemo(() => {
    const normalized = debouncedQuery.trim().toLocaleLowerCase();
    if (!normalized) return orders;
    return orders.filter((order) => order.label.toLocaleLowerCase().includes(normalized));
  }, [debouncedQuery, orders]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 0.8) close();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start(),
    }),
  ).current;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.summary} onPress={() => setVisible(true)}>
        <View style={styles.summaryIcon}><Ionicons name="receipt-outline" size={17} color={Colors.accent} /></View>
        <View style={styles.summaryText}>
          <Text style={styles.label}>Pedido</Text>
          <Text style={[styles.value, !selected && styles.emptyValue]} numberOfLines={1}>{selected?.label ?? 'Não atribuído'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={close}>
            <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]} />
          </Pressable>
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY }] }]}>
            <View style={styles.handleHitArea} {...panResponder.panHandlers}><View style={styles.handle} /></View>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={styles.modalEyebrow}>Selecionar pedido</Text>
                <Text style={styles.modalTitle}>Qual pedido será entregue?</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={close} accessibilityLabel="Fechar seleção">
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar pedido"
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {query.length > 0 && query !== debouncedQuery && <ActivityIndicator size="small" color={Colors.accent} />}
            </View>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{debouncedQuery ? 'Resultados' : 'Pedidos disponíveis'}</Text>
              <Text style={styles.resultCount}>{options.length} encontrado{options.length === 1 ? '' : 's'}</Text>
            </View>
            <FlatList
              data={options}
              style={styles.resultList}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              getItemLayout={(_, index) => ({ length: OPTION_HEIGHT, offset: OPTION_HEIGHT * index, index })}
              contentContainerStyle={styles.resultContent}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.option} onPress={() => select(item.id)}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{item.label.replace('Pedido ', '').slice(-2)}</Text></View>
                  <Text style={styles.optionName} numberOfLines={1}>{item.label}</Text>
                  {item.id === selectedId && <Ionicons name="checkmark-circle" size={21} color={Colors.accent} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="receipt-outline" size={28} color={Colors.textMuted} /><Text style={styles.emptyTitle}>Nenhum pedido encontrado</Text></View>}
            />
            <TouchableOpacity style={styles.unassignButton} onPress={() => select(undefined)}>
              <Ionicons name="close-circle-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.unassignText}>Não atribuir</Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  summary: { minHeight: 42, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryIcon: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1 },
  label: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.textMuted },
  value: { marginTop: 2, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  emptyValue: { color: Colors.textMuted },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.42)' },
  modalSheet: { maxHeight: '78%', minHeight: 390, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  handleHitArea: { height: 30, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  modalHeading: { flex: 1 },
  modalEyebrow: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.accent, textTransform: 'uppercase' },
  modalTitle: { marginTop: 4, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  searchBox: { minHeight: 46, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchInput: { flex: 1, color: Colors.primary, fontFamily: 'PlusJakartaSans_400Regular' },
  resultHeader: { marginTop: Spacing.lg, marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between' },
  resultTitle: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.primary },
  resultCount: { color: Colors.textMuted, fontSize: FontSize.xs },
  resultList: { flexGrow: 0 },
  resultContent: { gap: Spacing.xs },
  option: { minHeight: OPTION_HEIGHT, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.accent, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xs },
  optionName: { flex: 1, color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  emptyTitle: { color: Colors.textSecondary },
  unassignButton: { minHeight: 42, marginTop: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  unassignText: { color: Colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
