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
import { FAB } from "../components/Calendar/FAB";
import { BottomSheet, type BottomSheetHandle } from "../components/Calendar/BottomSheet";
import { SwipeableActions } from "../components/SwipeableActions";
import { RequiredLabel } from "../components/RequiredLabel";
import { pluginFormStyles } from "../components/Forms/pluginFormStyles";
import { TaskPeopleSelector } from "../components/Tasks/TaskPeopleSelector";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getPluginDefinition } from "../../src/plugins/registry";
import { ControlOpacity, Colors, FontSize, Radius, Spacing, SurfaceStyles } from "../../src/constants/theme";
import { ContractPeriod, Contrato, useAppStore } from "../../src/store";
import { clearRelationDraft, saveRelationDraft, setPendingRelation } from "../../src/utils/relationDraft";
import { AppAlert } from "@/src/services/appAlert";

const periodLabels: Record<ContractPeriod, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};
const today = () => new Date().toISOString().split("T")[0];
const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export default function ContratosScreen() {
  const router = useRouter();
  const { returnToContracts, createdId, relation } = useLocalSearchParams<{
    returnToContracts?: string;
    createdId?: string;
    relation?: "client" | "supplier" | "employee";
  }>();
  const {
    contratos,
    clienteItems,
    transactions,
    addContrato,
    updateContrato,
    removeContrato,
    refreshContratos,
    markTransactionReceived,
    setPluginActivation,
    activatedPlugins,
  } = useAppStore();
  const modalVisibleSheet = useRef<BottomSheetHandle>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [value, setValue] = useState("");
  const [period, setPeriod] = useState<ContractPeriod>("mensal");
  const [startDate, setStartDate] = useState(today());

  useEffect(() => {
    if (returnToContracts !== "1" || !createdId || !relation) return;
    const draft = setPendingRelation("contracts", relation, createdId) as {
      editingId: string | null;
      clientId: string;
      value: string;
      period: ContractPeriod;
      startDate: string;
    } | null;
    if (draft) {
      setEditingId(draft.editingId);
      setClientId(draft.clientId);
      setValue(draft.value);
      setPeriod(draft.period);
      setStartDate(draft.startDate);
      setModalVisible(true);
    }
    clearRelationDraft("contracts");
    router.setParams({ returnToContracts: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToContracts, router]);

  const navigateToRelationPlugin = (relation: "client" | "supplier" | "employee") => {
    saveRelationDraft("contracts", { editingId, clientId, value, period, startDate });
    setModalVisible(false);
    const pluginId = relation === "client" ? "clientes" : relation === "supplier" ? "fornecedores" : "equipe";
    const route = activatedPlugins.includes(pluginId)
      ? getPluginDefinition(pluginId)?.route
      : `/plugins/store?highlight=${pluginId}`;
    if (route) setTimeout(() => router.push(`${route}${route.includes("?") ? "&" : "?"}returnToContracts=1&relation=${relation}` as any), 240);
  };

  useEffect(() => {
    refreshContratos();
  }, [refreshContratos]);
  const overdue = useMemo(
    () =>
      new Set(
        transactions
          .filter(
            (transaction) =>
              transaction.contractId &&
              transaction.confirmed === false &&
              transaction.expectedDate &&
              transaction.expectedDate < today(),
          )
          .map((transaction) => transaction.contractId),
      ),
    [transactions],
  );
  const filteredContracts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return contratos.filter((contract) => {
      if (!normalized) return true;
      const client = (clienteItems.find((item) => item.id === contract.clientId)?.name ?? "").toLowerCase();
      return `${contract.id} ${client} ${periodLabels[contract.period]} ${contract.status}`.toLowerCase().includes(normalized);
    });
  }, [contratos, query, clienteItems]);

  const openAdd = () => {
    setEditingId(null);
    setClientId("");
    setValue("");
    setPeriod("mensal");
    setStartDate(today());
    setModalVisible(true);
  };
  const openEdit = (contract: Contrato) => {
    setEditingId(contract.id);
    setClientId(contract.clientId);
    setValue(String(contract.value));
    setPeriod(contract.period);
    setStartDate(contract.startDate);
    setModalVisible(true);
  };
  const save = () => {
    const numericValue = Number(value.replace(",", "."));
    if (
      !clientId ||
      numericValue <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    )
      return;
    if (editingId)
      updateContrato(editingId, {
        clientId,
        value: numericValue,
        period,
        startDate,
      });
    else if (
      !addContrato({
        clientId,
        value: numericValue,
        period,
        startDate,
        status: "ativo",
        createdAt: new Date().toISOString(),
      })
    ) {
      AppAlert.alert("Contrato não criado", "Selecione um cliente válido.", undefined, { variant: 'warning' });
      return;
    }
    refreshContratos();
    clearRelationDraft("contracts");
    setModalVisible(false);
  };
  const clientName = (id: string) =>
    clienteItems.find((client) => client.id === id)?.name ??
    "Cliente não encontrado";
  const predictedFor = (id: string) =>
    transactions.filter(
      (transaction) =>
        transaction.contractId === id && transaction.confirmed === false,
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Contratos / Assinaturas</Text>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          onPress={() =>
            AppAlert.alert(
              "Desativar Contratos",
              "Os dados continuam guardados.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Desativar",
                  style: "destructive",
                  onPress: () => {
                    setPluginActivation("contratos", false);
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
        <Ionicons name="search-outline" size={18} color={Colors.iconMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar contrato ou cliente"
          placeholderTextColor={Colors.placeholder}
          style={styles.searchInput}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {filteredContracts.length === 0 && (
          <View style={styles.empty}>
            <Ionicons
              name="document-lock-outline"
              size={48}
              color={Colors.decorativeMuted}
            />
            <Text style={styles.emptyText}>{query ? "Nenhum contrato encontrado." : "Nenhum contrato cadastrado."}</Text>
          </View>
        )}
        {filteredContracts.map((contract) => {
          const isActive = contract.status === "ativo";
          const pending = isActive ? predictedFor(contract.id) : [];
          const isOverdue = isActive && overdue.has(contract.id);
          return (
            <SwipeableActions
              key={contract.id}
              onEdit={() => openEdit(contract)}
              onDelete={() =>
                AppAlert.alert(
                  "Excluir contrato",
                  "As receitas previstas também serão removidas.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Excluir",
                      style: "destructive",
                      onPress: () => removeContrato(contract.id),
                    },
                  ],
                )
              }
            >
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name="repeat-outline"
                    size={20}
                    color={Colors.accentIcon}
                  />
                </View>
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>
                    {clientName(contract.clientId)}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {money(contract.value)} · {periodLabels[contract.period]}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    contract.status === "cancelado" && styles.cancelledBadge,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {contract.status === "ativo" ? "Ativo" : "Cancelado"}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>
                Próxima cobrança:{" "}
                {new Date(
                  `${contract.nextBillingDate}T00:00:00`,
                ).toLocaleDateString("pt-BR")}
              </Text>
              {isOverdue && (
                <Text style={styles.overdue}>
                  Pendência: cobrança não confirmada
                </Text>
              )}
              {pending.length > 0 && (
                <View style={styles.receivables}>
                  <Text style={styles.receivablesTitle}>
                    Receitas previstas
                  </Text>
                  {pending.map((transaction) => (
                    <View key={transaction.id} style={styles.receivableRow}>
                      <Text style={styles.receivableText}>
                        {transaction.expectedDate} · {money(transaction.amount)}
                      </Text>
                      <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                        onPress={() =>
                          markTransactionReceived(transaction.id, true)
                        }
                      >
                        <Text style={styles.receiveText}>Marcar recebida</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.actions}>
                {contract.status === "ativo" && (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                    onPress={() =>
                      updateContrato(contract.id, { status: "cancelado" })
                    }
                  >
                    <Text style={styles.cancel}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            </SwipeableActions>
          );
        })}
      </ScrollView>
      <FAB respectBottomInset onPress={openAdd} />
      <BottomSheet
        ref={modalVisibleSheet} draft={{ clientId, value, period, startDate }} visible={modalVisible}
        onClose={() => setModalVisible(false)}
        height={620}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View>
              <Text style={styles.modalTitle}>
                {editingId ? "Editar contrato" : "Novo contrato"}
              </Text>
              <TaskPeopleSelector
                title={null}
                relations={["client"]}
                clientId={clientId}
                onChange={(_, id) => setClientId(id ?? "")}
                onBeforeNavigate={navigateToRelationPlugin}
              />
              <RequiredLabel>Valor por ciclo</RequiredLabel>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder="R$ 0,00"
                placeholderTextColor={Colors.placeholder}
              />
              <Text style={styles.label}>Periodicidade</Text>
              <View style={styles.periodRow}>
                {(Object.keys(periodLabels) as ContractPeriod[]).map((item) => (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                    key={item}
                    style={[styles.chip, period === item && styles.chipActive]}
                    onPress={() => setPeriod(item)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        period === item && styles.chipTextActive,
                      ]}
                    >
                      {periodLabels[item]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <RequiredLabel>Data de início (AAAA-MM-DD)</RequiredLabel>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-08-11"
                placeholderTextColor={Colors.placeholder}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.cancelButton} onPress={() => modalVisibleSheet.current?.requestClose()}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.saveButton} onPress={save}>
                <Text style={styles.saveText}>Salvar contrato</Text>
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
  title: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.lg,
    flex: 1,
    textAlign: "center",
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 90, gap: Spacing.md },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  card: {
      ...SurfaceStyles.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  iconCircle: {
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
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  cancelledBadge: { backgroundColor: Colors.dangerLight },
  badgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  meta: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },
  overdue: {
    color: Colors.warningText,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  receivables: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  receivablesTitle: {
    color: Colors.primary,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  receivableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    gap: Spacing.sm,
  },
  receivableText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    flex: 1,
  },
  receiveText: {
    color: Colors.accentText,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  action: { color: Colors.primary, fontFamily: "PlusJakartaSans_600SemiBold" },
  delete: { color: Colors.dangerText, fontFamily: "PlusJakartaSans_600SemiBold" },
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
  overlay: {
      ...SurfaceStyles.backdrop,
    flex: 1,
    justifyContent: "flex-end",
  },
  modal: {
      ...SurfaceStyles.overlay,
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
  input: {
      ...SurfaceStyles.control,
    height: 46,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    color: Colors.primary,
  },
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
  searchInput: { flex: 1, height: 44, color: Colors.primary },
  chips: { gap: Spacing.sm },
  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
      ...SurfaceStyles.filter,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  chipTextActive: { color: Colors.onAction },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  saveButton: {
    backgroundColor: Colors.actionBackground,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelButton: {
      ...SurfaceStyles.filter,
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  saveText: { color: Colors.onAction, fontFamily: "PlusJakartaSans_600SemiBold" },
  ...pluginFormStyles,
  cancel: { color: Colors.warningText, fontFamily: "PlusJakartaSans_600SemiBold" },
});
