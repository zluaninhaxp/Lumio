import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { FAB } from "../components/Calendar/FAB";
import { BottomSheet } from "../components/Calendar/BottomSheet";
import { RequiredLabel } from "../components/RequiredLabel";
import { pluginFormStyles } from "../components/Forms/pluginFormStyles";
import { TaskPeopleSelector } from "../components/Tasks/TaskPeopleSelector";
import { TaskOrderSelector } from "../components/Tasks/TaskOrderSelector";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPluginDefinition } from "../../src/plugins/registry";
import { Colors, FontSize, Radius, Spacing } from "../../src/constants/theme";
import { DeliveryStatus, Entrega, useAppStore } from "../../src/store";
import { clearRelationDraft, saveRelationDraft, setPendingRelation } from "../../src/utils/relationDraft";

const statusLabels: Record<DeliveryStatus, string> = {
  "a caminho": "A caminho",
  entregue: "Entregue",
  cancelada: "Cancelada",
};
const nextDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

export default function EntregasScreen() {
  const router = useRouter();
  const { orderId, returnToDeliveries, createdId, relation } = useLocalSearchParams<{
    orderId?: string;
    returnToDeliveries?: string;
    createdId?: string;
    relation?: "client" | "supplier" | "employee";
  }>();
  const {
    entregas,
    pedidos,
    employeeItems,
    addEntrega,
    updateEntrega,
    removeEntrega,
    setPluginActivation,
    activatedPlugins,
  } = useAppStore();
  const [modalVisible, setModalVisible] = useState(!!orderId);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState(orderId ?? "");
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [address, setAddress] = useState("");
  const [estimatedDate, setEstimatedDate] = useState(nextDate());
  const [freightValue, setFreightValue] = useState("");
  const [createExpense, setCreateExpense] = useState(false);

  useEffect(() => {
    if (returnToDeliveries !== "1" || !createdId || !relation) return;
    const draft = setPendingRelation("deliveries", relation, createdId) as {
      editingId: string | null;
      selectedOrderId: string;
      employeeId?: string;
      address: string;
      estimatedDate: string;
      freightValue: string;
      createExpense: boolean;
    } | null;
    if (draft) {
      setEditingId(draft.editingId);
      setSelectedOrderId(draft.selectedOrderId);
      setEmployeeId(draft.employeeId);
      setAddress(draft.address);
      setEstimatedDate(draft.estimatedDate);
      setFreightValue(draft.freightValue);
      setCreateExpense(draft.createExpense);
      setModalVisible(true);
    }
    clearRelationDraft("deliveries");
    router.setParams({ returnToDeliveries: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToDeliveries, router]);

  const navigateToRelationPlugin = (relation: "client" | "supplier" | "employee") => {
    saveRelationDraft("deliveries", { editingId, selectedOrderId, employeeId, address, estimatedDate, freightValue, createExpense });
    setModalVisible(false);
    const pluginId = relation === "client" ? "clientes" : relation === "supplier" ? "fornecedores" : "equipe";
    const route = activatedPlugins.includes(pluginId)
      ? getPluginDefinition(pluginId)?.route
      : `/plugins/store?highlight=${pluginId}`;
    if (route) setTimeout(() => router.push(`${route}${route.includes("?") ? "&" : "?"}returnToDeliveries=1&relation=${relation}` as any), 240);
  };

  const activeDeliveries = useMemo(
    () => entregas,
    [entregas],
  );
  const orderLabel = (id: string) =>
    `Pedido ${id.slice(-6)}${pedidos.find((item) => item.id === id)?.clientId ? "" : " · avulso"}`;
  const availableOrders = useMemo(
    () => pedidos
      .filter(
        (order) =>
          order.status === "concluido" &&
          (!entregas.some(
            (item) => item.orderId === order.id && item.status !== "cancelada",
          ) || order.id === selectedOrderId),
      )
      .map((order) => ({ id: order.id, label: orderLabel(order.id) })),
    [entregas, pedidos, selectedOrderId],
  );
  const filteredDeliveries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeDeliveries.filter((delivery) => {
      if (!normalized) return true;
      const employee = employeeItems.find((item) => item.id === delivery.employeeId)?.name ?? "";
      return `${orderLabel(delivery.orderId)} ${delivery.address} ${employee} ${statusLabels[delivery.status]}`.toLowerCase().includes(normalized);
    });
  }, [activeDeliveries, employeeItems, query]);
  const openAdd = () => {
    setEditingId(null);
    setSelectedOrderId("");
    setEmployeeId(undefined);
    setAddress("");
    setEstimatedDate(nextDate());
    setFreightValue("");
    setCreateExpense(false);
    setModalVisible(true);
  };
  const openEdit = (delivery: Entrega) => {
    setEditingId(delivery.id);
    setSelectedOrderId(delivery.orderId);
    setEmployeeId(delivery.employeeId);
    setAddress(delivery.address);
    setEstimatedDate(delivery.estimatedDate);
    setFreightValue(delivery.freightValue ? String(delivery.freightValue) : "");
    setCreateExpense(false);
    setModalVisible(true);
  };
  const save = () => {
    if (
      !selectedOrderId ||
      !address.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(estimatedDate)
    )
      return;
    const value = Number(freightValue.replace(",", ".")) || 0;
    if (editingId)
      updateEntrega(editingId, {
        employeeId,
        address: address.trim(),
        estimatedDate,
        freightValue: value || undefined,
      });
    else if (
      !addEntrega(
        {
          orderId: selectedOrderId,
          employeeId,
          address: address.trim(),
          estimatedDate,
          status: "a caminho",
          freightValue: value || undefined,
          createdAt: new Date().toISOString(),
        },
        createExpense,
      )
    ) {
      Alert.alert(
        "Entrega não criada",
        "Este pedido já possui uma entrega ativa.",
      );
      return;
    }
    clearRelationDraft("deliveries");
    setModalVisible(false);
  };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Entregas</Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Desativar Entregas", "Os dados continuam guardados.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Desativar",
                style: "destructive",
                onPress: () => {
                  setPluginActivation("entregas", false);
                  router.back();
                },
              },
            ])
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
          placeholder="Buscar entrega ou pedido"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {filteredDeliveries.length === 0 && (
          <View style={styles.empty}>
            <Ionicons
              name="bicycle-outline"
              size={46}
              color={Colors.textMuted}
            />
            <Text style={styles.emptyText}>{query ? "Nenhuma entrega encontrada." : "Nenhuma entrega cadastrada."}</Text>
            <Text style={styles.hint}>
              Conclua um pedido e gere a entrega pelo módulo Pedidos.
            </Text>
          </View>
        )}
        {filteredDeliveries.map((delivery) => (
          <View key={delivery.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.deliveryIcon}>
                <Ionicons
                  name="bicycle-outline"
                  size={20}
                  color={Colors.accent}
                />
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>
                  {orderLabel(delivery.orderId)}
                </Text>
                <Text style={styles.cardSubtitle}>{delivery.address}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  delivery.status === "entregue" && styles.doneBadge,
                ]}
              >
                <Text style={styles.badgeText}>
                  {statusLabels[delivery.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.deadline}>
              Prazo:{" "}
              {new Date(
                `${delivery.estimatedDate}T00:00:00`,
              ).toLocaleDateString("pt-BR")}
            </Text>
            <Text style={styles.meta}>
              {delivery.employeeId
                ? `Responsável: ${employeeItems.find((item) => item.id === delivery.employeeId)?.name ?? "não encontrado"}`
                : "Sem responsável atribuído"}
            </Text>
            <View style={styles.actions}>
              {delivery.status === "a caminho" && (
                <TouchableOpacity
                  onPress={() =>
                    updateEntrega(delivery.id, { status: "entregue" })
                  }
                >
                  <Text style={styles.conclude}>Marcar entregue</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => openEdit(delivery)}>
                <Text style={styles.action}>Editar</Text>
              </TouchableOpacity>
              {delivery.status === "a caminho" && (
                <TouchableOpacity
                  onPress={() =>
                    updateEntrega(delivery.id, { status: "cancelada" })
                  }
                >
                  <Text style={styles.cancel}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
      <FAB onPress={openAdd} />
      <BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        height={620}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingId ? "Editar entrega" : "Nova entrega"}
              </Text>
              <TaskOrderSelector
                orders={availableOrders}
                selectedId={selectedOrderId}
                onChange={(id) => setSelectedOrderId(id ?? "")}
              />
              <RequiredLabel>Endereço de entrega</RequiredLabel>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Rua, número, complemento"
                placeholderTextColor={Colors.textMuted}
              />
              <RequiredLabel>Prazo estimado (AAAA-MM-DD)</RequiredLabel>
              <TextInput
                style={styles.input}
                value={estimatedDate}
                onChangeText={setEstimatedDate}
                placeholder="2026-08-12"
                placeholderTextColor={Colors.textMuted}
              />
              <View style={styles.peopleSpacing}>
                <TaskPeopleSelector
                  title={null}
                  relations={["employee"]}
                  employeeId={employeeId}
                  onChange={(_, id) => setEmployeeId(id)}
                  onBeforeNavigate={navigateToRelationPlugin}
                />
              </View>
              <Text style={styles.label}>Frete simples (opcional)</Text>
              <TextInput
                style={styles.input}
                value={freightValue}
                onChangeText={setFreightValue}
                keyboardType="decimal-pad"
                placeholder="Valor"
                placeholderTextColor={Colors.textMuted}
              />
              {!editingId && Number(freightValue.replace(",", ".")) > 0 && (
                <TouchableOpacity
                  style={styles.expenseOption}
                  onPress={() => setCreateExpense((value) => !value)}
                >
                  <Ionicons
                    name={createExpense ? "checkbox" : "square-outline"}
                    size={21}
                    color={Colors.accent}
                  />
                  <Text style={styles.expenseText}>
                    Lançar como despesa no Financeiro
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={save}>
                <Text style={styles.saveText}>Salvar entrega</Text>
              </TouchableOpacity>
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
  title: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: Colors.primary,
    fontSize: FontSize.lg,
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 90, gap: Spacing.sm },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: "center" },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  deliveryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMain: { flex: 1 },
  cardTitle: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.md,
  },
  cardSubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#FFF4D6",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  doneBadge: { backgroundColor: Colors.accentLight },
  badgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  deadline: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    marginTop: Spacing.md,
  },
  meta: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  conclude: { color: Colors.accent, fontFamily: "PlusJakartaSans_600SemiBold" },
  action: { color: Colors.primary, fontFamily: "PlusJakartaSans_600SemiBold" },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.35)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: "88%",
  },
  modalTitle: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.lg,
    marginBottom: Spacing.lg,
  },
  label: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  peopleSpacing: { marginTop: Spacing.md },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
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
  chips: { gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  chipTextActive: { color: "#FFF" },
  expenseOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  expenseText: { color: Colors.textSecondary },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  saveText: { color: "#FFF", fontFamily: "PlusJakartaSans_600SemiBold" },
  ...pluginFormStyles,
  cancel: { color: Colors.danger, fontFamily: "PlusJakartaSans_600SemiBold" },
});
