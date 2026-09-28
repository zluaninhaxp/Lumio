import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  TextInput,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FAB } from "../components/Calendar/FAB";
import { BottomSheet } from "../components/Calendar/BottomSheet";
import { SwipeableActions } from "../components/SwipeableActions";
import { FormLabel, RequiredLabel } from "../components/RequiredLabel";
import { pluginFormStyles } from "../components/Forms/pluginFormStyles";
import { TaskPeopleSelector } from "../components/Tasks/TaskPeopleSelector";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors, Spacing, Radius, FontSize } from "../../src/constants/theme";
import { OrderItem, OrderStatus, Pedido, useAppStore } from "../../src/store";
import { getPluginDefinition } from "../../src/plugins/registry";
import { clearRelationDraft, saveRelationDraft, setPendingRelation } from "../../src/utils/relationDraft";
import { DocumentItemPicker } from "../../src/components/DocumentItemPicker";

type DraftItem = Omit<OrderItem, "id" | "unitPrice"> & { id: string; unitPrice: number | string; addToCatalog?: boolean };
const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
const parsePrice = (value: number | string) => Number(String(value).replace(",", "."));
const todayLabel = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const emptyItem = (): DraftItem => ({
  id: `${Date.now()}-${Math.random()}`,
  name: "",
  quantity: 1,
  unitPrice: "",
  addToCatalog: false,
});
const FORM_SHEET_MAX_HEIGHT = Dimensions.get("window").height * 0.8;
const SHEET_CHROME_HEIGHT = Spacing.md + 4 + Spacing.lg + Spacing.xxxl;

export default function VendasScreen() {
  const router = useRouter();
  const { returnToSales, createdId, relation } = useLocalSearchParams<{
    returnToSales?: string;
    createdId?: string;
    relation?: "client" | "supplier" | "employee";
  }>();
  const {
    pedidos,
    clienteItems,
    catalogItems,
    addCatalogItem,
    addVenda,
    updatePedido,
    removePedido,
    setPluginActivation,
    activatedPlugins,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | undefined>();
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [status, setStatus] = useState<OrderStatus>("aberto");
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [formBodyHeight, setFormBodyHeight] = useState(0);
  const [formFooterHeight, setFormFooterHeight] = useState(0);
  const formScrollRef = useRef<ScrollView>(null);

  const formSheetHeight = formBodyHeight > 0 && formFooterHeight > 0
    ? Math.min(FORM_SHEET_MAX_HEIGHT, formBodyHeight + formFooterHeight + SHEET_CHROME_HEIGHT)
    : undefined;
  const formSheetBounded = formSheetHeight !== undefined;

  useEffect(() => {
    if (returnToSales !== "1" || !createdId || !relation) return;
    const draft = setPendingRelation("sales", relation, createdId) as {
      editingId: string | null;
      clientId?: string;
      employeeId?: string;
      items: DraftItem[];
      status: OrderStatus;
    } | null;
    if (draft) {
      setEditingId(draft.editingId);
      setClientId(draft.clientId);
      setEmployeeId(draft.employeeId);
      setItems(draft.items);
      setStatus(draft.status);
      setFormBodyHeight(0);
      setFormFooterHeight(0);
      setModalVisible(true);
    }
    clearRelationDraft("sales");
    router.setParams({ returnToSales: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToSales, router]);

  const navigateToRelationPlugin = (relation: "client" | "supplier" | "employee", close: () => void) => {
    saveRelationDraft("sales", { editingId, clientId, employeeId, items, status });
    close();
    const pluginId = relation === "client" ? "clientes" : relation === "supplier" ? "fornecedores" : "equipe";
    const route = activatedPlugins.includes(pluginId)
      ? getPluginDefinition(pluginId)?.route
      : `/plugins/store?highlight=${pluginId}`;
    if (route) setTimeout(() => router.push(`${route}${route.includes("?") ? "&" : "?"}returnToSales=1&relation=${relation}` as any), 240);
  };

  const visibleOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pedidos.filter(
      (order) =>
        !normalized ||
        order.id.toLowerCase().includes(normalized) ||
        order.items.some((item) =>
          item.name.toLowerCase().includes(normalized),
        ) ||
        clienteItems
          .find((client) => client.id === order.clientId)
          ?.name.toLowerCase()
          .includes(normalized),
    );
  }, [pedidos, query, clienteItems]);

  const total = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (parsePrice(item.unitPrice) || 0),
    0,
  );
  const openAdd = () => {
    setEditingId(null);
    setClientId(undefined);
    setEmployeeId(undefined);
    setItems([emptyItem()]);
    setStatus("concluido");
    setFormBodyHeight(0);
    setFormFooterHeight(0);
    setModalVisible(true);
  };
  const openEdit = (order: Pedido) => {
    setEditingId(order.id);
    setClientId(order.clientId);
    setEmployeeId(order.employeeId);
    setItems(order.items.map((item) => ({ ...item })));
    setStatus(order.status);
    setFormBodyHeight(0);
    setFormFooterHeight(0);
    setModalVisible(true);
  };
  const updateItem = (id: string, updates: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  const addDraftItem = () => {
    Keyboard.dismiss();
    setFocusedItemId(null);
    const item = emptyItem();
    setItems((current) => [...current, item]);
    setTimeout(() => formScrollRef.current?.scrollToEnd({ animated: true }), 80);
  };
  const saveOrder = () => {
    const validItems = items
      .filter(
        (item) =>
          item.name.trim() &&
          Number(item.quantity) > 0 &&
           String(item.unitPrice).trim() !== "" && Number.isFinite(parsePrice(item.unitPrice)) && parsePrice(item.unitPrice) >= 0,
      )
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        quantity: Number(item.quantity),
         unitPrice: parsePrice(item.unitPrice),
      }));
    if (validItems.length === 0) return;
    const orderTotal = validItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const current = editingId
      ? pedidos.find((order) => order.id === editingId)
      : undefined;
    const payload = {
      clientId,
      employeeId,
       items: validItems.map(({ addToCatalog, ...item }) => {
         if (!addToCatalog || item.catalogItemId) return item;
         const catalogItemId = addCatalogItem({
           name: item.name,
           kind: "produto",
           unitPrice: item.unitPrice,
           unit: "un",
           controlStock: false,
           needsReview: true,
         });
         return { ...item, catalogItemId };
       }),
      total: orderTotal,
      status: "concluido" as const,
      date: current?.date ?? todayLabel(),
      createdAt: current?.createdAt ?? new Date().toISOString(),
    };
    const saved = editingId
      ? (updatePedido(editingId, payload) ? editingId : null)
      : addVenda(payload);
    if (!saved) {
      Alert.alert(
        "Venda não registrada",
        "A quantidade disponível no estoque controlado não é suficiente.",
      );
      return;
    }
    clearRelationDraft("sales");
    setModalVisible(false);
  };
  const cancel = (id: string) => {
    if (!updatePedido(id, { status: "cancelado" }))
      Alert.alert("Não foi possível cancelar a venda.");
  };
  const clientName = (id?: string) =>
    id ? clienteItems.find((client) => client.id === id)?.name : undefined;
  const statusLabel: Record<OrderStatus, string> = {
    aberto: "Pendente",
    concluido: "Realizada",
    cancelado: "Cancelada",
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendas</Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              "Desativar Vendas",
              "O módulo sai da aba Apps, mas os dados continuam guardados.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Desativar",
                  style: "destructive",
                  onPress: () => {
                    setPluginActivation("vendas", false);
                    router.back();
                  },
                },
              ],
            )
          }
          style={styles.iconBtn}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar venda ou item"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {visibleOrders.length === 0 && (
          <View style={styles.empty}>
            <Ionicons
              name="receipt-outline"
              size={46}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyText}>
              {query
                ? "Nenhuma venda encontrada."
                : "Nenhuma venda cadastrada ainda."}
            </Text>
          </View>
        )}
        {visibleOrders.map((order) => (
          <SwipeableActions
            key={order.id}
            onEdit={() => openEdit(order)}
            onDelete={() => { if (!removePedido(order.id)) Alert.alert('Venda vinculada', 'Há entregas ou comissões pagas vinculadas. O histórico foi preservado.'); }}
          >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.orderIcon}>
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color={Colors.accent}
                />
              </View>
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>
                    Venda {order.id.slice(-6)}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {order.date}
                  {clientName(order.clientId)
                    ? ` · ${clientName(order.clientId)}`
                    : " · Venda avulsa"}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  order.status === "concluido" && styles.statusDone,
                  order.status === "cancelado" && styles.statusCanceled,
                ]}
              >
                <Text style={styles.statusText}>
                  {statusLabel[order.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.itemSummary}>
              {order.items
                .map((item) => `${item.quantity}x ${item.name}`)
                .join(" · ")}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.total}>{money(order.total)}</Text>
              <View style={styles.actions}>
                {order.status !== "cancelado" && (
                  <TouchableOpacity onPress={() => cancel(order.id)}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          </SwipeableActions>
        ))}
      </ScrollView>
      <FAB onPress={openAdd} />
      <BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        minHeight={0}
        maxHeight={FORM_SHEET_MAX_HEIGHT}
        sheetHeight={formSheetHeight}
      >
        <View style={[styles.modalOverlay, formSheetBounded && styles.formSheetOverlay]}>
          <View style={[styles.modalCard, formSheetBounded && styles.formSheetCard]}>
            <ScrollView
              ref={formScrollRef}
              style={[styles.formScroll, formSheetBounded && styles.formScrollBounded]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              onContentSizeChange={(_, height) => setFormBodyHeight((current) => current === height ? current : height)}
            >
              <Text style={styles.modalTitle}>
                {editingId ? "Editar venda" : "Nova venda"}
              </Text>
              <TaskPeopleSelector
                title={null}
                relations={["client", "employee"]}
                clientId={clientId}
                employeeId={employeeId}
                onChange={(relation, id) => {
                  if (relation === "client") setClientId(id);
                  if (relation === "employee") setEmployeeId(id);
                }}
                onBeforeNavigate={(relation) => navigateToRelationPlugin(relation, () => setModalVisible(false))}
              />
              <Text style={styles.label}>Itens vendidos</Text>
              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemForm,
                    focusedItemId === item.id && styles.itemFormFocused,
                  ]}
                >
                  <RequiredLabel>Item {index + 1}</RequiredLabel>
                  <DocumentItemPicker item={item} catalogItems={catalogItems} onChange={(updates) => updateItem(item.id, updates)} />
                  {!item.catalogItemId && (
                    <TouchableOpacity
                      style={styles.stockCheckboxRow}
                      onPress={() => updateItem(item.id, { addToCatalog: !item.addToCatalog })}
                    >
                      <View style={[styles.checkbox, item.addToCatalog && styles.checkboxActive]}>
                        {item.addToCatalog && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                      </View>
                      <Text style={styles.stockCheckboxLabel}>Vincular este item ao Catálogo</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.numberRow}>
                    <View style={{ flex: 1 }}>
                      <RequiredLabel>Quantidade</RequiredLabel>
                      <TextInput
                        style={styles.numberInput}
                        value={String(item.quantity)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onChangeText={(value) =>
                          updateItem(item.id, {
                            quantity: Number(value.replace(",", ".")) || 0,
                          })
                        }
                        placeholder="Qtd."
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <RequiredLabel>Preço unitário</RequiredLabel>
                      <TextInput
                        style={styles.numberInput}
                        value={String(item.unitPrice)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onChangeText={(value) =>
                          updateItem(item.id, {
                              unitPrice: value,
                              stockItemId: undefined,
                          })
                        }
                        placeholder="Preço"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={addDraftItem}
              >
                <Ionicons name="add" size={17} color={Colors.accent} />
                <Text style={styles.actionText}>Adicionar item</Text>
              </TouchableOpacity>
            </ScrollView>
              <View
                style={styles.formFooter}
                onLayout={(event) => setFormFooterHeight(event.nativeEvent.layout.height)}
              >
              <Text style={styles.totalPreview}>Total: {money(total)}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={saveOrder}>
                  <Text style={styles.modalConfirmText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconBtn: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, height: 44, color: Colors.primary },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 80, gap: Spacing.md },
  emptyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  orderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMain: { flex: 1 },
  cardTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: Colors.primary,
    fontSize: FontSize.md,
  },
  cardSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: "#FFF4D6",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  statusDone: { backgroundColor: Colors.accentLight },
  statusCanceled: { backgroundColor: Colors.dangerLight },
  statusText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  itemSummary: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  total: {
    color: Colors.accent,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.md,
  },
  actions: { flexDirection: "row", gap: Spacing.md },
  concludeText: {
    color: Colors.accent,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
  },
  actionText: {
    color: Colors.accent,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
  },
  cancelText: {
    color: Colors.danger,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    paddingBottom: 40,
    gap: Spacing.md,
    maxHeight: "90%",
  },
  modalTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: Colors.primary,
    fontSize: FontSize.xl,
    marginBottom: Spacing.md,
  },
  formScroll: { flexShrink: 1 },
  formScrollBounded: { flex: 1 },
  formSheetOverlay: { flex: 1 },
  formSheetCard: { flex: 1 },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  chipTextActive: { color: "#FFFFFF" },
  itemForm: {
    position: "relative",
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  itemFormFocused: {},
  itemSearchWrap: {},
  itemNameInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: Colors.primary,
  },
  itemNameInputActive: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  numberRow: { flexDirection: "row", gap: Spacing.sm },
  numberInput: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: Colors.primary,
  },
  stockSuggestions: {
    backgroundColor: Colors.bgCard,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    overflow: "hidden",
    zIndex: 20,
  },
  stockSuggestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stockSuggestionName: {
    flex: 1,
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
  },
  stockSuggestionPrice: {
    color: Colors.accent,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.xs,
  },
  stockCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgCard,
  },
  checkboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  stockCheckboxLabel: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
  },
  addItemButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  totalPreview: {
    textAlign: "right",
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
  },
  formFooter: {
    flexShrink: 0,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalCancel: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  modalConfirm: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  ...pluginFormStyles,
});
