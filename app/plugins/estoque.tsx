import { FeedbackEmptyState } from '../../src/components/empty-state';
import { ModuleTextStyles } from '../../src/components/module-text-styles';
import { FormTextInput } from '../../src/components/form-text-input';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FAB } from "../../src/components/Calendar/FAB";
import { BottomSheet, type BottomSheetHandle } from "../../src/components/Calendar/BottomSheet";
import { SwipeableActions } from "../../src/components/SwipeableActions";
import { FormLabel, RequiredLabel } from "../../src/components/RequiredLabel";
import { pluginFormStyles } from "../../src/components/Forms/pluginFormStyles";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ControlOpacity, Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from "../../src/constants/theme";
import { EstoqueItem, useAppStore } from "../../src/store";
import { CatalogItemSelector } from "../../src/components/CatalogItemSelector";
import { clearRelationDraft, getRelationDraft, saveRelationDraft } from "../../src/utils/relationDraft";
import { AppAlert } from "@/src/services/appAlert";
import { useConfirmedSave } from "../../src/hooks/use-confirmed-save";
import { confirmAction } from "../../src/services/confirmedAction";

const EMPTY_FORM = { catalogItemId: "", quantity: "", minAlert: "" };
const EMPTY_MOVEMENT = { amount: "", reason: "" };
const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export default function EstoqueScreen() {
  const router = useRouter();
  const { returnToStock, createdId } = useLocalSearchParams<{ returnToStock?: string; createdId?: string }>();
  const {
    estoqueItems,
    catalogItems,
    stockMovements,
    addEstoqueItemFromCatalog,
    updateEstoqueItem,
    removeEstoqueItem,
    moveEstoqueItem,
    setPluginActivation,
    activatedPlugins,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const formVisibleSheet = useRef<BottomSheetHandle>(null);
  const [formVisible, setFormVisible] = useState(false);
  const movementVisibleSheet = useRef<BottomSheetHandle>(null);
  const [movementVisible, setMovementVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movementItem, setMovementItem] = useState<EstoqueItem | null>(null);
  const [movementType, setMovementType] = useState<"entrada" | "saida">(
    "entrada",
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [movement, setMovement] = useState(EMPTY_MOVEMENT);

  useEffect(() => {
    if (returnToStock !== "1" || !createdId) return;
    const draft = getRelationDraft<{ editingId: string | null; form: typeof EMPTY_FORM }>("stock");
    if (draft) setEditingId(draft.editingId);
    setForm({ ...(draft?.form ?? EMPTY_FORM), catalogItemId: createdId });
    setFormVisible(true);
    clearRelationDraft("stock");
    router.setParams({ returnToStock: undefined, createdId: undefined });
  }, [createdId, returnToStock, router]);

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    return estoqueItems.filter(
      (item) =>
        !text || `${item.name} ${item.unit}`.toLowerCase().includes(text),
    );
  }, [estoqueItems, query]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openCatalog = () => {
    saveRelationDraft("stock", { editingId, form });
    setFormVisible(false);
    const route = activatedPlugins.includes("catalogo")
      ? "/plugins/catalogo"
      : "/plugins/store?highlight=catalogo";
    router.push(`${route}${route.includes("?") ? "&" : "?"}returnToStock=1` as any);
  };

  const openEdit = (item: EstoqueItem) => {
    setEditingId(item.id);
    setForm({
      catalogItemId: catalogItems.find((catalog) => catalog.stockItemId === item.id)?.id ?? "",
      quantity: String(item.quantity),
      minAlert: String(item.minAlert),
    });
    setFormVisible(true);
  };

  const saveItemConfirmation = useConfirmedSave();
    const saveItem = () => {
     void saveItemConfirmation.run(() => {
    const quantity = Math.max(0, Number(form.quantity) || 0);
    const minAlert = Math.max(0, Number(form.minAlert) || 0);
    if (!form.catalogItemId) return;
    if (editingId) {
          const current = estoqueItems.find((item) => item.id === editingId);
          if (!current) return;
          updateEstoqueItem(editingId, { ...current, quantity, minAlert });
        } else if (!addEstoqueItemFromCatalog(form.catalogItemId, quantity, minAlert)) return;
    return () => {
    setFormVisible(false);
    };
    });
    };

  const openMovement = (item: EstoqueItem, type: "entrada" | "saida") => {
    setMovementItem(item);
    setMovementType(type);
    setMovement(EMPTY_MOVEMENT);
    setMovementVisible(true);
  };

  const saveMovementConfirmation = useConfirmedSave();
    const saveMovement = () => {
     void saveMovementConfirmation.run(() => {
    if (!movementItem) return;
    const amount = Number(movement.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const delta = movementType === "entrada" ? amount : -amount;
    if (!moveEstoqueItem(movementItem.id, delta, movement.reason)) {
          AppAlert.alert(
            "Movimento não realizado",
            "A saída não pode deixar o estoque negativo.", undefined, { variant: 'warning' }
          );
          return;
        }
    return () => {
    setMovementVisible(false);
    };
    });
    };

  const deleteItem = (id: string) =>
    AppAlert.alert("Excluir item", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => { void confirmAction("estoque.tsx:action:153" + ':' + String(id), () => {
        if (!removeEstoqueItem(id)) AppAlert.alert('Item vinculado', 'Pedidos ou movimentos dependem deste item. O histórico foi preservado.', undefined, { variant: 'warning' });
        return () => {  };
        }); },
      },
    ]);

  const deactivate = () =>
    AppAlert.alert(
      "Desativar Estoque",
      "O módulo sai da aba Apps, mas os dados continuam guardados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: () => { void confirmAction("estoque.tsx:action:166" + ':' + String("estoque"), () => {
          setPluginActivation("estoque", false);
          return () => { router.back(); };
          }); },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={ModuleTextStyles.headerTitle}>Estoque</Text>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={deactivate} style={styles.iconButton}>
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar item"
          placeholderTextColor={Colors.placeholder}
          style={styles.searchInput} editable={!(saveItemConfirmation.locked || saveMovementConfirmation.locked)}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {filteredItems.length === 0 && (
          <FeedbackEmptyState variant="compact" icon="cube-outline" title={query
                ? "Nenhum item encontrado."
                : "Nenhum item no estoque ainda."} />
        )}
        {filteredItems.map((item) => {
          const controlsStock = item.controlStock !== false;
          const isLow = controlsStock && item.quantity < item.minAlert;
          const movements = stockMovements
            .filter((entry) => entry.itemId === item.id)
            .slice(0, 3);
          return (
            <SwipeableActions
              key={item.id}
              onEdit={() => openEdit(item)}
              onDelete={() => deleteItem(item.id)}
            >
            <View style={styles.card}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.cardHeader}
                onPress={() => openEdit(item)}
              >
                <View
                  style={[styles.iconCircle, isLow && styles.iconCircleLow]}
                >
                  <Ionicons
                    name="cube-outline"
                    size={19}
                    color={isLow ? Colors.dangerIcon : Colors.accentIcon}
                  />
                </View>
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    {controlsStock
                      ? `${item.quantity} ${item.unit} · mínimo ${item.minAlert} ${item.unit}`
                      : "Somente catálogo e preços"}
                  </Text>
                  <Text style={styles.cardPrice}>{money(item.unitPrice ?? 0)} por unidade</Text>
                </View>
                {isLow && (
                  <View style={styles.alertBadge}>
                    <Ionicons
                      name="alert-circle"
                      size={14}
                      color={Colors.dangerIcon}
                    />
                    <Text style={styles.alertText}>Baixo</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.actionRow}>
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  style={styles.movementButton}
                  onPress={() => openMovement(item, "entrada")}
                >
                  <Ionicons name="add" size={16} color={Colors.accentIcon} />
                  <Text style={styles.entryText}>Entrada</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  style={styles.movementButton}
                  onPress={() => openMovement(item, "saida")}
                >
                  <Ionicons name="remove" size={16} color={Colors.dangerIcon} />
                  <Text style={styles.exitText}>Saída</Text>
                </TouchableOpacity>
              </View>
              {movements.length > 0 && (
                <View style={styles.history}>
                  <Text style={styles.historyTitle}>Últimos movimentos</Text>
                  {movements.map((entry) => (
                    <Text key={entry.id} style={styles.historyText}>
                      {entry.quantity > 0 ? "+" : ""}
                      {entry.quantity} {item.unit} · {entry.reason}
                    </Text>
                  ))}
                </View>
              )}
            </View>
            </SwipeableActions>
          );
        })}
      </ScrollView>

      <FAB respectBottomInset onPress={openAdd} />

      <BottomSheet
        ref={formVisibleSheet} draft={form} visible={formVisible}
        onClose={() => setFormVisible(false)}
        height={620}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingId ? "Editar item" : "Novo item"}
            </Text>
            <RequiredLabel>Produto do catálogo</RequiredLabel>
            <CatalogItemSelector
              selectedId={form.catalogItemId || undefined}
              items={catalogItems.filter((catalog) => catalog.kind === "produto" && (!catalog.stockItemId || catalog.stockItemId === editingId))}
              onChange={(id) => setForm((current) => ({ ...current, catalogItemId: id ?? "" }))}
              onBeforeNavigate={openCatalog}
            />
            <FormLabel>Quantidade atual (opcional)</FormLabel>
            <FormTextInput
              style={styles.input}
              placeholder="Quantidade atual"
              placeholderTextColor={Colors.placeholder}
              value={form.quantity}
              onChangeText={(quantity) =>
                setForm((current) => ({ ...current, quantity }))
              }
              keyboardType="decimal-pad" editable={!(saveItemConfirmation.locked || saveMovementConfirmation.locked)}
            />
            <FormLabel>Quantidade mínima para alerta (opcional)</FormLabel>
            <FormTextInput
              style={styles.input}
              placeholder="Quantidade mínima para alerta"
              placeholderTextColor={Colors.placeholder}
              value={form.minAlert}
              onChangeText={(minAlert) =>
                setForm((current) => ({ ...current, minAlert }))
              }
              keyboardType="decimal-pad" editable={!(saveItemConfirmation.locked || saveMovementConfirmation.locked)}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.modalCancel}
                onPress={() => formVisibleSheet.current?.requestClose()} accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.modalConfirm} onPress={saveItem} accessibilityRole="button" disabled={saveItemConfirmation.saving}>
                <Text style={styles.modalConfirmText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        ref={movementVisibleSheet} draft={{ movement, movementType }} visible={movementVisible}
        onClose={() => setMovementVisible(false)}
        height={420}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {movementType === "entrada"
                ? "Entrada de estoque"
                : "Saída de estoque"}
            </Text>
            <Text style={styles.modalSubtitle}>{movementItem?.name}</Text>
            <FormTextInput
              style={styles.amountInput}
              placeholder="Quantidade"
              placeholderTextColor={Colors.placeholder}
              value={movement.amount}
              onChangeText={(amount) =>
                setMovement((current) => ({ ...current, amount }))
              }
              keyboardType="decimal-pad"
              autoFocus focusStyle={{ color: Colors.accentText }} editable={!(saveItemConfirmation.locked || saveMovementConfirmation.locked)}
            />
            <FormTextInput
              style={styles.input}
              placeholder="Motivo (opcional)"
              placeholderTextColor={Colors.placeholder}
              value={movement.reason}
              onChangeText={(reason) =>
                setMovement((current) => ({ ...current, reason }))
              } editable={!(saveItemConfirmation.locked || saveMovementConfirmation.locked)}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.modalCancel}
                onPress={() => movementVisibleSheet.current?.requestClose()} accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={[
                  styles.modalConfirm,
                  movementType === "saida" && styles.exitConfirm,
                ]}
                onPress={saveMovement} accessibilityRole="button" disabled={saveMovementConfirmation.saving}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
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
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
      ...SurfaceStyles.control,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full
  },
  searchInput: { ...ModuleTextStyles.search, flex: 1, minHeight: 44, color: Colors.primary },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  card: {
      ...SurfaceStyles.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleLow: { backgroundColor: Colors.dangerLight },
  cardMain: { flex: 1 },
  cardTitle: {
    fontFamily: Typography.semibold,
    color: Colors.primary,
    fontSize: FontSize.md,
  },
  cardSubtitle: { ...ModuleTextStyles.metadata,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  cardPrice: {
    color: Colors.accentText,
    fontSize: FontSize.sm,
    fontFamily: Typography.semibold,
    marginTop: 2,
  },
  alertBadge: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  alertText: {
    color: Colors.dangerText,
    fontFamily: Typography.semibold,
    fontSize: FontSize.xs,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  movementButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.mintBackground,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  entryText: {
    color: Colors.accentText,
    fontFamily: Typography.semibold,
    fontSize: FontSize.xs,
  },
  exitText: {
    color: Colors.dangerText,
    fontFamily: Typography.semibold,
    fontSize: FontSize.xs,
  },
  deleteButton: { marginLeft: "auto", padding: Spacing.sm },
  history: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  historyTitle: { ...ModuleTextStyles.metadata,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginBottom: Spacing.xs,
  },
  historyText: { ...ModuleTextStyles.metadata,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    paddingVertical: 2,
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
  modalSubtitle: { ...ModuleTextStyles.metadata, color: Colors.textSecondary },
  catalogChoices: { gap: Spacing.sm, maxHeight: 112 },
  catalogChoice: {
      ...SurfaceStyles.filter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm
  },
  catalogChoiceActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.accentIcon },
  catalogChoiceName: { color: Colors.primary, fontFamily: Typography.semibold },
  catalogChoiceUnit: { color: Colors.textSecondary, fontSize: FontSize.xs },
  catalogChoiceTextActive: { color: Colors.onAction },
  catalogHint: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  toggleCopy: { flex: 1, gap: 2 },
  toggleTitle: {
    color: Colors.primary,
    fontFamily: Typography.semibold,
  },
  toggleDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
  },
  amountInput: {
    fontFamily: Typography.bold,
    fontSize: FontSize.display,
    textAlign: "center",
    color: Colors.primary,
    paddingVertical: Spacing.sm,
  },
  exitConfirm: { backgroundColor: Colors.dangerActionBackground },
  ...pluginFormStyles,
});
