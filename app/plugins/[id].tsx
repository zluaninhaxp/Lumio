import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';
import { getPluginDefinition, isValidPluginId } from '../../src/plugins/registry';

/**
 * Tela mínima genérica para os plugins ainda sem CRUD completo
 * (`implemented: false` em `src/plugins/registry.ts`). Renderiza um
 * formulário a partir de `PluginDefinition.fields` e persiste os itens em
 * `genericPluginItems[pluginId]` no store. Nenhum dos 9 plugins precisou
 * de um aviso "Em breve" — todos suportaram a modelagem genérica de
 * campo-texto/número/seleção descrita na tabela do catálogo.
 */
export default function GenericPluginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const pluginId = params.id;
  const {
    genericPluginItems, addGenericPluginItem, removeGenericPluginItem, setPluginActivation,
  } = useAppStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  if (!pluginId || !isValidPluginId(pluginId)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Módulo não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const def = getPluginDefinition(pluginId)!;
  const items = genericPluginItems[def.id] ?? [];
  const primaryField = def.fields.find((f) => f.primary) ?? def.fields[0];

  const openAdd = () => {
    setForm({});
    setModalVisible(true);
  };

  const handleSave = () => {
    if (primaryField && !form[primaryField.key]?.trim()) return;
    addGenericPluginItem(def.id, form);
    setModalVisible(false);
  };

  const handleDelete = (itemId: string) => {
    Alert.alert(`Excluir ${def.itemLabel}`, 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeGenericPluginItem(def.id, itemId) },
    ]);
  };

  const handleDeactivate = () => {
    Alert.alert(
      `Desativar ${def.label}`,
      'O módulo sai da aba Apps, mas seus dados continuam guardados e voltam se você reativar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => {
            setPluginActivation(def.id, false);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{def.label}</Text>
        <TouchableOpacity onPress={handleDeactivate} style={styles.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name={def.icon as any} size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum {def.itemLabel} ainda.</Text>
          </View>
        )}
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onLongPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {(primaryField && item.values[primaryField.key]) || 'Sem título'}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {def.fields
                  .filter((f) => f.key !== primaryField?.key && item.values[f.key])
                  .map((f) => `${f.label}: ${item.values[f.key]}`)
                  .join(' · ')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo {def.itemLabel}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {def.fields.map((field) => (
                <View key={field.key} style={{ marginBottom: Spacing.md }}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  {field.type === 'select' ? (
                    <View style={styles.selectRow}>
                      {(field.options ?? []).map((opt) => {
                        const selected = form[field.key] === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[styles.selectChip, selected && styles.selectChipActive]}
                            onPress={() => setForm((f) => ({ ...f, [field.key]: opt }))}
                          >
                            <Text
                              style={[
                                styles.selectChipText,
                                selected && styles.selectChipTextActive,
                              ]}
                            >
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={Colors.textMuted}
                      value={form[field.key] ?? ''}
                      onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSave}>
                <Text style={styles.modalConfirmText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  iconBtn: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary,
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm, gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.primary,
  },
  cardSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary,
    marginTop: 2,
  },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl, paddingBottom: 40, gap: Spacing.md,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, color: Colors.primary,
  },
  fieldLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, color: Colors.textMuted,
    marginBottom: Spacing.xs, letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.lg,
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.md, color: Colors.primary,
  },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  selectChip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  selectChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  selectChipText: {
    fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.sm, color: Colors.textSecondary,
  },
  selectChipTextActive: { color: '#FFFFFF' },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalCancel: {
    flex: 1, padding: Spacing.lg, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary,
  },
  modalConfirm: {
    flex: 1, padding: Spacing.lg, borderRadius: Radius.md,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  modalConfirmText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: '#FFFFFF',
  },
});
