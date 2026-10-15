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
import { RequiredLabel } from "../../src/components/RequiredLabel";
import { pluginFormStyles } from "../../src/components/Forms/pluginFormStyles";
import { TaskPeopleSelector } from "../../src/components/Tasks/TaskPeopleSelector";
import { TaskOrderSelector } from "../../src/components/Tasks/TaskOrderSelector";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPluginDefinition } from "../../src/plugins/registry";
import { ControlOpacity, Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from "../../src/constants/theme";
import { DeliveryStatus, Entrega, useAppStore } from "../../src/store";
import { clearRelationDraft, saveRelationDraft, setPendingRelation } from "../../src/utils/relationDraft";
import { AppAlert } from "@/src/services/appAlert";
import { useConfirmedSave } from "../../src/hooks/use-confirmed-save";
import { confirmAction } from "../../src/services/confirmedAction";
import { LoadingSpinner } from "../../src/components/loading-spinner";

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
  const modalVisibleSheet = useRef<BottomSheetHandle>(null);
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
  const saveConfirmation = useConfirmedSave();
    const save = () => {
     void saveConfirmation.run(() => {
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
          AppAlert.alert(
            "Entrega não criada",
            "Este pedido já possui uma entrega ativa.", undefined, { variant: 'warning' }
          );
          return;
        }
    return () => {
    clearRelationDraft("deliveries");
    setModalVisible(false);
    };
    });
    };
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={ModuleTextStyles.headerTitle}>Entregas</Text>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          onPress={() =>
            AppAlert.alert("Desativar Entregas", "Os dados continuam guardados.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Desativar",
                style: "destructive",
                onPress: () => { void confirmAction("entregas.tsx:action:209" + ':' + String("entregas"), () => {
                setPluginActivation("entregas", false);
                return () => { router.back(); };
                }); },
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
        <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar entrega ou pedido"
          placeholderTextColor={Colors.placeholder}
          style={styles.searchInput} editable={!(saveConfirmation.locked)}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {filteredDeliveries.length === 0 && (
          <FeedbackEmptyState variant="compact" icon="bicycle-outline" title={query ? "Nenhuma entrega encontrada." : "Nenhuma entrega cadastrada."} description="Conclua um pedido e gere a entrega pelo módulo Pedidos." />
        )}
        {filteredDeliveries.map((delivery) => (
          <SwipeableActions
            key={delivery.id}
            onEdit={() => openEdit(delivery)}
            onDelete={() => { void confirmAction("entregas.tsx:action:246" + ':' + String(delivery.id), () => {
            removeEntrega(delivery.id);
            return () => {  };
            }); }}
          >
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.deliveryIcon}>
                <Ionicons
                  name="bicycle-outline"
                  size={20}
                  color={Colors.accentIcon}
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
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  onPress={() =>
                    { void confirmAction("entregas.tsx:action:288" + ':' + String(delivery.id), () => {
                      updateEntrega(delivery.id, { status: "entregue" });
                      return () => {  };
                      }); }
                  }
                >
                  <Text style={styles.conclude}>Marcar entregue</Text>
                </TouchableOpacity>
              )}
              {delivery.status === "a caminho" && (
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  onPress={() =>
                    { void confirmAction("entregas.tsx:action:297" + ':' + String(delivery.id), () => {
                      updateEntrega(delivery.id, { status: "cancelada" });
                      return () => {  };
                      }); }
                  }
                >
                  <Text style={styles.cancel}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          </SwipeableActions>
        ))}
      </ScrollView>
      <FAB respectBottomInset onPress={openAdd} />
      <BottomSheet
        ref={modalVisibleSheet} draft={{ selectedOrderId, employeeId, address, estimatedDate, freightValue, createExpense }} visible={modalVisible}
        onClose={() => setModalVisible(false)}
        height={620}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View>
              <Text style={styles.modalTitle}>
                {editingId ? "Editar entrega" : "Nova entrega"}
              </Text>
              <TaskOrderSelector
                orders={availableOrders}
                selectedId={selectedOrderId}
                onChange={(id) => setSelectedOrderId(id ?? "")}
              />
              <RequiredLabel>Endereço de entrega</RequiredLabel>
              <FormTextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Rua, número, complemento"
                placeholderTextColor={Colors.placeholder} editable={!(saveConfirmation.locked)}
              />
              <RequiredLabel>Prazo estimado (AAAA-MM-DD)</RequiredLabel>
              <FormTextInput
                style={styles.input}
                value={estimatedDate}
                onChangeText={setEstimatedDate}
                placeholder="2026-08-12"
                placeholderTextColor={Colors.placeholder} editable={!(saveConfirmation.locked)}
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
              <FormTextInput
                style={styles.input}
                value={freightValue}
                onChangeText={setFreightValue}
                keyboardType="decimal-pad"
                placeholder="Valor"
                placeholderTextColor={Colors.placeholder} editable={!(saveConfirmation.locked)}
              />
              {!editingId && Number(freightValue.replace(",", ".")) > 0 && (
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  style={styles.expenseOption}
                  onPress={() => setCreateExpense((value) => !value)}
                >
                  <Ionicons
                    name={createExpense ? "checkbox" : "square-outline"}
                    size={21}
                    color={Colors.accentIcon}
                  />
                  <Text style={styles.expenseText}>
                    Lançar como despesa no Financeiro
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.cancelButton} onPress={() => modalVisibleSheet.current?.requestClose()} accessibilityRole="button">
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.saveButton} onPress={save} accessibilityRole="button" disabled={saveConfirmation.saving}>{saveConfirmation.saving ? <LoadingSpinner color={Colors.onAction} /> : <>
                <Text style={styles.saveText}>Salvar entrega</Text>
              </>}</TouchableOpacity>
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
  card: {
      ...SurfaceStyles.card,
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
    fontFamily: Typography.semibold,
    fontSize: FontSize.md,
  },
  cardSubtitle: { ...ModuleTextStyles.metadata,
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
    fontFamily: Typography.semibold,
  },
  deadline: {
    color: Colors.primary,
    fontFamily: Typography.semibold,
    marginTop: Spacing.md,
  },
  meta: { ...ModuleTextStyles.metadata, color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4 },
  conclude: { color: Colors.accentText, fontFamily: Typography.semibold },
  action: { color: Colors.primary, fontFamily: Typography.semibold },
  fab: {
      ...SurfaceStyles.floating,
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.actionBackground,
    alignItems: "center",
    justifyContent: "center"
  },
  peopleSpacing: { marginTop: Spacing.md },
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
  chips: { gap: Spacing.sm },
  expenseOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  expenseText: { ...ModuleTextStyles.metadata, color: Colors.textSecondary },
  ...pluginFormStyles,
  cancel: { color: Colors.dangerText, fontFamily: Typography.semibold },
});
