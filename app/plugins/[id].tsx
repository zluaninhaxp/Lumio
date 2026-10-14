import { FeedbackEmptyState } from '../../src/components/empty-state';
import { ModuleTextStyles } from '../../src/components/module-text-styles';
import { FormTextInput } from '../../src/components/form-text-input';
import { ModalScrollView } from '../../src/components/modal-scroll-view';
import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FAB } from "../../src/components/Calendar/FAB";
import { BottomSheet, type BottomSheetHandle } from "../../src/components/Calendar/BottomSheet";
import { SwipeableActions } from "../../src/components/SwipeableActions";
import { RequiredLabel } from "../../src/components/RequiredLabel";
import { pluginFormStyles } from "../../src/components/Forms/pluginFormStyles";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles, Typography } from "../../src/constants/theme";
import { useAppStore } from "../../src/store";
import {
  getPluginDefinition,
  isValidPluginId,
} from "../../src/plugins/registry";
import { AppAlert } from "@/src/services/appAlert";
import { useConfirmedSave } from "../../src/hooks/use-confirmed-save";
import { confirmAction } from "../../src/services/confirmedAction";

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
    genericPluginItems,
    addGenericPluginItem,
    removeGenericPluginItem,
    setPluginActivation,
  } = useAppStore();

  const modalVisibleSheet = useRef<BottomSheetHandle>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  if (!pluginId || !isValidPluginId(pluginId)) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
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

  const handleSaveConfirmation = useConfirmedSave();
    const handleSave = () => {
     void handleSaveConfirmation.run(() => {
    if (primaryField && !form[primaryField.key]?.trim()) return;
    addGenericPluginItem(def.id, form);
    return () => {
    setModalVisible(false);
    };
    });
    };

  const handleDelete = (itemId: string) => {
    AppAlert.alert(`Excluir ${def.itemLabel}`, "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => removeGenericPluginItem(def.id, itemId),
      },
    ]);
  };

  const handleDeactivate = () => {
    AppAlert.alert(
      `Desativar ${def.label}`,
      "O módulo sai da aba Apps, mas seus dados continuam guardados e voltam se você reativar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: () => { void confirmAction("[id].tsx:action:104" + ':' + String(def.id), () => {
          setPluginActivation(def.id, false);
          return () => { router.back(); };
          }); },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={ModuleTextStyles.headerTitle}>{def.label}</Text>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={handleDeactivate} style={styles.iconBtn}>
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {items.length === 0 && (
          <FeedbackEmptyState variant="compact" icon={def.icon as any} title={`Nenhum ${def.itemLabel} ainda.`} />
        )}
        {items.map((item) => (
          <SwipeableActions
            key={item.id}
            onDelete={() => handleDelete(item.id)}
          >
            <TouchableOpacity style={styles.card} activeOpacity={ControlOpacity.pressed}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {(primaryField && item.values[primaryField.key]) ||
                    "Sem título"}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {def.fields
                    .filter(
                      (f) => f.key !== primaryField?.key && item.values[f.key],
                    )
                    .map((f) => `${f.label}: ${item.values[f.key]}`)
                    .join(" · ")}
                </Text>
              </View>
            </TouchableOpacity>
          </SwipeableActions>
        ))}
      </ScrollView>

      <FAB respectBottomInset onPress={openAdd} />

      <BottomSheet
        ref={modalVisibleSheet} draft={form} visible={modalVisible}
        onClose={() => setModalVisible(false)}
        height={620}
        contentOwnsScroll
      >
        <View style={[styles.modalOverlay, { flexShrink: 1 }]}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo {def.itemLabel}</Text>
            <ModalScrollView
              style={{ maxHeight: 360, flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {def.fields.map((field) => (
                <View key={field.key} style={{ marginBottom: Spacing.md }}>
                  {field.primary ? (
                    <RequiredLabel>{field.label}</RequiredLabel>
                  ) : (
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                  )}
                  {field.type === "select" ? (
                    <View style={styles.selectRow}>
                      {(field.options ?? []).map((opt) => {
                        const selected = form[field.key] === opt;
                        return (
                          <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                            key={opt}
                            style={[
                              styles.selectChip,
                              selected && styles.selectChipActive,
                            ]}
                            onPress={() =>
                              setForm((f) => ({ ...f, [field.key]: opt }))
                            }
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
                    <FormTextInput
                      style={styles.input}
                      placeholder={field.placeholder}
                      placeholderTextColor={Colors.placeholder}
                      value={form[field.key] ?? ""}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, [field.key]: v }))
                      }
                      keyboardType={
                        field.type === "number" ? "numeric" : "default"
                      } editable={!(handleSaveConfirmation.locked)}
                    />
                  )}
                </View>
              ))}
            </ModalScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.modalCancel}
                onPress={() => modalVisibleSheet.current?.requestClose()} accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.modalConfirm}
                onPress={handleSave} accessibilityRole="button" disabled={handleSaveConfirmation.saving}
              >
                <Text style={styles.modalConfirmText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.appBackground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 80, gap: Spacing.md },
  emptyText: {
    fontFamily: Typography.semibold,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  card: {
      ...SurfaceStyles.card,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md
  },
  cardTitle: {
    fontFamily: Typography.semibold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  cardSubtitle: {
    fontFamily: Typography.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  fab: {
      ...SurfaceStyles.floating,
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.actionBackground,
    alignItems: "center",
    justifyContent: "center"
  },
  selectRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  ...pluginFormStyles,
});
