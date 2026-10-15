import { ActivityIndicator } from 'react-native';
import { FeedbackEmptyState } from '../../src/components/empty-state';
import { ModuleTextStyles } from '../../src/components/module-text-styles';
import { FormTextInput } from '../../src/components/form-text-input';
import { ModalScrollView } from '../../src/components/modal-scroll-view';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FAB } from "../../src/components/Calendar/FAB";
import { BottomSheet, type BottomSheetHandle } from "../../src/components/Calendar/BottomSheet";
import { SwipeableActions } from "../../src/components/SwipeableActions";
import { FormLabel, RequiredLabel } from "../../src/components/RequiredLabel";
import { pluginFormStyles } from "../../src/components/Forms/pluginFormStyles";
import { TaskPeopleSelector } from "../../src/components/Tasks/TaskPeopleSelector";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPluginDefinition } from "../../src/plugins/registry";
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles, Typography } from "../../src/constants/theme";
import { clearRelationDraft, saveRelationDraft, setPendingRelation } from "../../src/utils/relationDraft";
import { DocumentItemPicker } from "../../src/components/DocumentItemPicker";
import {
  OrderItem,
  Orcamento,
  QuoteStatus,
  useAppStore,
} from "../../src/store";
import { AppAlert } from "@/src/services/appAlert";
import { AppFeedback } from '@/src/components/app-feedback';
import { useConfirmedSave } from "../../src/hooks/use-confirmed-save";
import { confirmAction } from "../../src/services/confirmedAction";

type DraftItem = OrderItem;
const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
const emptyItem = (): DraftItem => ({
  id: `${Date.now()}-${Math.random()}`,
  name: "",
  quantity: 1,
  unitPrice: 0,
});
const FORM_SHEET_MAX_HEIGHT = Dimensions.get("window").height * 0.8;
const SHEET_CHROME_HEIGHT = Spacing.md + 4 + Spacing.lg + Spacing.xxxl;
const defaultValidity = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
};

export default function OrcamentosScreen() {
  const router = useRouter();
  const { returnToQuotes, createdId, relation } = useLocalSearchParams<{
    returnToQuotes?: string;
    createdId?: string;
    relation?: "client" | "supplier" | "employee";
  }>();
  const {
    orcamentos,
    clienteItems,
    addOrcamento,
    updateOrcamento,
    removeOrcamento,
    approveOrcamento,
    refreshOrcamentos,
    activatedPlugins,
    setPluginActivation,
    catalogItems,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const modalVisibleSheet = useRef<BottomSheetHandle>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | undefined>();
  const [validUntil, setValidUntil] = useState(defaultValidity());
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [formBodyHeight, setFormBodyHeight] = useState(0);
  const [formFooterHeight, setFormFooterHeight] = useState(0);
  useEffect(() => {
    refreshOrcamentos();
  }, [refreshOrcamentos]);
  useEffect(() => {
    if (returnToQuotes !== "1" || !createdId || !relation) return;
    const draft = setPendingRelation("quotes", relation, createdId) as {
      editingId: string | null;
      clientId?: string;
      validUntil: string;
      items: DraftItem[];
    } | null;
    if (draft) {
      setEditingId(draft.editingId);
      setClientId(draft.clientId);
      setValidUntil(draft.validUntil);
      setItems(draft.items);
      setFormBodyHeight(0);
      setFormFooterHeight(0);
      setModalVisible(true);
    }
    clearRelationDraft("quotes");
    router.setParams({ returnToQuotes: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToQuotes, router]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orcamentos.filter(
      (quote) =>
        !q ||
        quote.id.toLowerCase().includes(q) ||
        quote.items.some((item) => item.name.toLowerCase().includes(q)) ||
        clienteItems
          .find((client) => client.id === quote.clientId)
          ?.name.toLowerCase()
          .includes(q),
    );
  }, [orcamentos, query, clienteItems]);
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const formSheetHeight = formBodyHeight > 0 && formFooterHeight > 0
    ? Math.min(FORM_SHEET_MAX_HEIGHT, formBodyHeight + formFooterHeight + SHEET_CHROME_HEIGHT)
    : undefined;
  const formSheetBounded = formSheetHeight !== undefined;
  const navigateToRelationPlugin = (relation: "client" | "supplier" | "employee") => {
    saveRelationDraft("quotes", { editingId, clientId, validUntil, items });
    setModalVisible(false);
    const pluginId = relation === "client" ? "clientes" : relation === "supplier" ? "fornecedores" : "equipe";
    const route = activatedPlugins.includes(pluginId)
      ? getPluginDefinition(pluginId)?.route
      : `/plugins/store?highlight=${pluginId}`;
    if (route) setTimeout(() => router.push(`${route}${route.includes("?") ? "&" : "?"}returnToQuotes=1&relation=${relation}` as any), 240);
  };
  const statusLabel: Record<QuoteStatus, string> = {
    pendente: "Pendente",
    aprovado: "Aprovado",
    recusado: "Recusado",
    expirado: "Expirado",
  };
  const openAdd = () => {
    setEditingId(null);
    setClientId(undefined);
    setValidUntil(defaultValidity());
    setItems([emptyItem()]);
    setFormBodyHeight(0);
    setFormFooterHeight(0);
    setModalVisible(true);
  };
  const openEdit = (quote: Orcamento) => {
    setEditingId(quote.id);
    setClientId(quote.clientId);
    setValidUntil(quote.validUntil);
    setItems(quote.items.map((item) => ({ ...item })));
    setFormBodyHeight(0);
    setFormFooterHeight(0);
    setModalVisible(true);
  };
  const updateItem = (id: string, updates: Partial<DraftItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  const saveConfirmation = useConfirmedSave();
    const save = () => {
     void saveConfirmation.run(() => {
    const validItems = items
          .filter((item) => item.name.trim() && item.quantity > 0)
          .map((item) => ({ ...item, name: item.name.trim() }));
    if (!validItems.length || !validUntil.trim()) return;
    const current = editingId
          ? orcamentos.find((quote) => quote.id === editingId)
          : undefined;
    if (current && current.status !== "pendente") {
          AppAlert.alert(
            "Orçamento encerrado",
            "Orçamentos aprovados, recusados ou expirados não podem ser editados.", undefined, { variant: 'warning' }
          );
          return;
        }
    const payload = {
          clientId,
          items: validItems,
          total: validItems.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          ),
          validUntil: validUntil.trim(),
          status: current?.status ?? ("pendente" as QuoteStatus),
          createdAt: current?.createdAt ?? new Date().toISOString(),
        };
    if (editingId) updateOrcamento(editingId, payload);
        else addOrcamento(payload);
    return () => {
    clearRelationDraft("quotes");
    setModalVisible(false);
    };
    });
    };
  const approve = (id: string) => { void confirmAction('quote-approve:' + id, () => {
   const orderId = approveOrcamento(id);
   if (!orderId) { AppAlert.alert('Orçamento não aprovado', 'Ele pode já ter sido convertido, estar expirado ou não estar pendente.', undefined, { variant: 'warning' }); return; }
   return () => AppFeedback.show('Orçamento aprovado', 'Pedido ' + orderId.slice(-6) + ' criado. Conclua o pedido em Pedidos / Vendas para gerar a receita.');
  }); };
  const clientName = (id?: string) =>
    id ? clienteItems.find((client) => client.id === id)?.name : undefined;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={ModuleTextStyles.headerTitle}>Orçamentos</Text>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          onPress={() =>
            AppAlert.alert(
              "Desativar Orçamentos",
              "O módulo sai da aba Apps, mas os dados continuam guardados.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Desativar",
                  style: "destructive",
                  onPress: () => { void confirmAction("orcamentos.tsx:action:232" + ':' + String("orcamentos"), () => {
                  setPluginActivation("orcamentos", false);
                  return () => { router.back(); };
                  }); },
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
        <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar orçamento"
          placeholderTextColor={Colors.placeholder}
          style={styles.searchInput} editable={!(saveConfirmation.locked)}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {visible.length === 0 && (
          <FeedbackEmptyState variant="compact" icon="document-text-outline" title={query
                ? "Nenhum orçamento encontrado."
                : "Nenhum orçamento cadastrado ainda."} />
        )}
        {visible.map((quote) => (
          <SwipeableActions
            key={quote.id}
            onEdit={() => openEdit(quote)}
            onDelete={() => { void confirmAction("orcamentos.tsx:action:269" + ':' + String(quote.id), () => {
            removeOrcamento(quote.id);
            return () => {  };
            }); }}
          >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={Colors.accentIcon}
                />
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>
                  Orçamento {quote.id.slice(-6)}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {clientName(quote.clientId) || "Cliente não vinculado"} ·
                  válido até {quote.validUntil}
                </Text>
              </View>
              <View
                style={[
                  styles.status,
                  quote.status === "aprovado" && styles.statusDone,
                  (quote.status === "recusado" ||
                    quote.status === "expirado") &&
                    styles.statusBad,
                ]}
              >
                <Text style={styles.statusText}>
                  {statusLabel[quote.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.itemsText}>
              {quote.items
                .map((item) => `${item.quantity}x ${item.name}`)
                .join(" · ")}
            </Text>
            <View style={styles.footer}>
              <Text style={styles.total}>{money(quote.total)}</Text>
              <View style={styles.actions}>
                {quote.status === "pendente" && (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => approve(quote.id)}>
                    <Text style={styles.approveText}>Aprovar</Text>
                  </TouchableOpacity>
                )}
                {quote.status === "pendente" && (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                    onPress={() =>
                      updateOrcamento(quote.id, { status: "recusado" })
                    }
                  >
                    <Text style={styles.rejectText}>Recusar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {quote.orderId && (
              <Text style={styles.linked}>
                Convertido no pedido {quote.orderId.slice(-6)}
              </Text>
            )}
          </View>
          </SwipeableActions>
        ))}
      </ScrollView>
      <FAB respectBottomInset onPress={openAdd} />
      <BottomSheet
        ref={modalVisibleSheet} draft={{ clientId, validUntil, items }} visible={modalVisible}
        onClose={() => setModalVisible(false)}
        minHeight={0}
        maxHeight={FORM_SHEET_MAX_HEIGHT}
        sheetHeight={formSheetHeight}
      >
        <View style={[styles.modalOverlay, formSheetBounded && styles.formSheetOverlay]}>
          <View style={[styles.modalCard, formSheetBounded && styles.formSheetCard]}>
              <ModalScrollView
                style={[styles.formScroll, formSheetBounded && styles.formScrollBounded]}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_, height) => setFormBodyHeight((current) => current === height ? current : height)}
              >
              <Text style={styles.modalTitle}>
                {editingId ? "Editar orçamento" : "Novo orçamento"}
              </Text>
              <TaskPeopleSelector
                title={null}
                relations={["client"]}
                clientId={clientId}
                onChange={(_, id) => setClientId(id)}
                onBeforeNavigate={navigateToRelationPlugin}
              />
              <RequiredLabel>Validade (AAAA-MM-DD)</RequiredLabel>
              <FormTextInput
                style={styles.input}
                value={validUntil}
                onChangeText={setValidUntil}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={Colors.placeholder} editable={!(saveConfirmation.locked)}
              />
                <Text style={styles.label}>Itens propostos</Text>
                {items.map((item, index) => (
                  <View key={item.id} style={styles.itemForm}>
                    <RequiredLabel>Item {index + 1}</RequiredLabel>
                    <DocumentItemPicker item={item} catalogItems={catalogItems} onChange={(updates) => updateItem(item.id, updates)} />
                  <View style={styles.numberRow}>
                    <View style={{ flex: 1 }}>
                      <RequiredLabel>Quantidade</RequiredLabel>
                      <FormTextInput
                        style={styles.numberInput}
                        value={String(item.quantity)}
                        onChangeText={(value) =>
                          updateItem(item.id, { quantity: Number(value) || 0 })
                        }
                        placeholder="Qtd."
                        placeholderTextColor={Colors.placeholder}
                        keyboardType="decimal-pad" editable={!(saveConfirmation.locked)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormLabel>Valor unitário (opcional)</FormLabel>
                      <FormTextInput
                        style={styles.numberInput}
                        value={String(item.unitPrice || "")}
                        onChangeText={(value) =>
                          updateItem(item.id, {
                            unitPrice: Number(value.replace(",", ".")) || 0,
                          })
                        }
                        placeholder="Valor"
                        placeholderTextColor={Colors.placeholder}
                        keyboardType="decimal-pad" editable={!(saveConfirmation.locked)}
                      />
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.addItem}
                onPress={() => setItems((current) => [...current, emptyItem()])}
              >
                <Text style={styles.actionText}>+ Adicionar item</Text>
              </TouchableOpacity>
            </ModalScrollView>
            <View
              style={styles.formFooter}
              onLayout={(event) => setFormFooterHeight(event.nativeEvent.layout.height)}
            >
              <Text style={styles.totalPreview}>Total: {money(total)}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  style={styles.modalCancel}
                  onPress={() => modalVisibleSheet.current?.requestClose()} accessibilityRole="button"
                >
                  <Text style={styles.cancelLabel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.modalConfirm} onPress={save} accessibilityRole="button" disabled={saveConfirmation.saving}>{saveConfirmation.saving ? <ActivityIndicator color={Colors.onAction} /> : <>
                  <Text style={styles.confirmLabel}>Salvar</Text>
                </>}</TouchableOpacity>
              </View>
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
  cardMain: { flex: 1 },
  cardTitle: {
    color: Colors.primary,
    fontFamily: Typography.semibold,
    fontSize: FontSize.md,
  },
  cardSubtitle: { ...ModuleTextStyles.metadata,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  status: {
    backgroundColor: "#FFF4D6",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  statusDone: { backgroundColor: Colors.accentLight },
  statusBad: { backgroundColor: Colors.dangerLight },
  statusText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontFamily: Typography.semibold,
  },
  itemsText: { ...ModuleTextStyles.metadata, color: Colors.textSecondary, marginTop: Spacing.md },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  total: {
    color: Colors.accentText,
    fontFamily: Typography.bold,
    fontSize: FontSize.md,
  },
  approveText: {
    color: Colors.accentText,
    fontFamily: Typography.semibold,
  },
  rejectText: {
    color: Colors.dangerText,
    fontFamily: Typography.semibold,
  },
  actionText: {
    color: Colors.accentText,
    fontFamily: Typography.semibold,
  },
  linked: { ...ModuleTextStyles.metadata,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
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
  formScroll: { flexShrink: 1 },
  formScrollBounded: { flex: 1, minHeight: 0 },
  formSheetOverlay: { flex: 1, flexShrink: 1, minHeight: 0 },
  formSheetCard: { flex: 1, flexShrink: 1, minHeight: 0 },
  chips: { flexDirection: "row", gap: Spacing.sm, paddingVertical: Spacing.sm },
  itemForm: {
      ...SurfaceStyles.control,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  numberRow: { flexDirection: "row", gap: Spacing.sm },
  numberInput: { ...ModuleTextStyles.search,
      ...SurfaceStyles.control,
    flex: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: Colors.primary,
  },
  addItem: { paddingVertical: Spacing.md },
  totalPreview: {
    textAlign: "right",
    color: Colors.primary,
    fontFamily: Typography.bold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
  },
  formFooter: {
    flexShrink: 0,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.semibold,
    fontSize: FontSize.sm,
  },
  confirmLabel: {
    color: Colors.onAction,
    fontFamily: Typography.semibold,
    fontSize: FontSize.sm,
  },
  ...pluginFormStyles,
});
