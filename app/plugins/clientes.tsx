import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FAB } from "../components/Calendar/FAB";
import { BottomSheet, type BottomSheetHandle } from "../components/Calendar/BottomSheet";
import { SwipeableActions } from "../components/SwipeableActions";
import { FormLabel, RequiredLabel } from "../components/RequiredLabel";
import { pluginFormStyles } from "../components/Forms/pluginFormStyles";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from "../../src/constants/theme";
import { useAppStore, ClienteItem } from "../../src/store";
import { AppAlert } from "@/src/services/appAlert";

const EMPTY_FORM = { name: "", contact: "", notes: "" };
const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export default function ClientesScreen() {
  const router = useRouter();
  const { returnToFinance, returnToTasks, returnToCalendar, returnToQuotes, returnToContracts, returnToDeliveries, returnToSales, relation } =
    useLocalSearchParams<{
      returnToFinance?: string;
      returnToTasks?: string;
      returnToCalendar?: string;
      returnToQuotes?: string;
      returnToContracts?: string;
      returnToDeliveries?: string;
      returnToSales?: string;
      relation?: string;
    }>();
  const {
    clienteItems,
    transactions,
    addClienteItem,
    updateClienteItem,
    removeClienteItem,
    setPluginActivation,
  } = useAppStore();
  const [query, setQuery] = useState("");
  const modalVisibleSheet = useRef<BottomSheetHandle>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clienteItems.filter(
      (client) =>
        !normalized ||
        `${client.name} ${client.contact}`.toLowerCase().includes(normalized),
    );
  }, [clienteItems, query]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };
  const openEdit = (item: ClienteItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, contact: item.contact, notes: item.notes });
    setModalVisible(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      notes: form.notes.trim(),
      createdAt: editingId
        ? (clienteItems.find((item) => item.id === editingId)?.createdAt ??
          new Date().toISOString())
        : new Date().toISOString(),
    };
    let createdId: string | null = null;
    if (editingId) {
      if (!updateClienteItem(editingId, payload)) {
        AppAlert.alert("Nome já cadastrado", "Já existe um cliente com esse nome.", undefined, { variant: 'warning' });
        return;
      }
    } else {
      createdId = addClienteItem(payload);
      if (!createdId) {
        AppAlert.alert("Nome já cadastrado", "Já existe um cliente com esse nome.", undefined, { variant: 'warning' });
        return;
      }
    }
    setModalVisible(false);
    if (
      !editingId &&
      createdId &&
      returnToFinance === "1" &&
      relation === "client"
    ) {
      router.dismissTo({
        pathname: "/(tabs)/financeiro",
        params: { returnToFinance: "1", createdId, relation: "client" },
      });
    } else if (
      !editingId &&
      createdId &&
      (returnToTasks === "1" || returnToCalendar === "1") &&
      relation === "client"
    ) {
      router.dismissTo({
        pathname:
          returnToTasks === "1" ? "/(tabs)/tarefas" : "/(tabs)/calendario",
        params: {
          [returnToTasks === "1" ? "returnToTasks" : "returnToCalendar"]: "1",
          createdId,
          relation: "client",
        },
      });
    } else if (!editingId && createdId && returnToQuotes === "1" && relation === "client") {
      router.dismissTo({ pathname: "/plugins/orcamentos", params: { returnToQuotes: "1", createdId, relation: "client" } });
    } else if (!editingId && createdId && returnToContracts === "1" && relation === "client") {
      router.dismissTo({ pathname: "/plugins/contratos", params: { returnToContracts: "1", createdId, relation: "client" } });
    } else if (!editingId && createdId && returnToDeliveries === "1" && relation === "client") {
      router.dismissTo({ pathname: "/plugins/entregas", params: { returnToDeliveries: "1", createdId, relation: "client" } });
    } else if (!editingId && createdId && returnToSales === "1" && relation === "client") {
      router.dismissTo({ pathname: "/plugins/vendas", params: { returnToSales: "1", createdId, relation: "client" } });
    }
  };
  const handleDelete = (id: string) =>
    AppAlert.alert(
      "Excluir cliente",
      "As receitas vinculadas ficam sem cliente, mas não são excluídas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => removeClienteItem(id),
        },
      ],
    );
  const handleDeactivate = () =>
    AppAlert.alert(
      "Desativar Clientes",
      "O módulo sai da aba Apps, mas os dados continuam guardados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: () => {
            setPluginActivation("clientes", false);
            router.back();
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clientes</Text>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={handleDeactivate} style={styles.iconBtn}>
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
          placeholder="Buscar cliente"
          placeholderTextColor={Colors.placeholder}
          style={styles.searchInput}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {filteredClients.length === 0 && (
          <View style={styles.empty}>
            <Ionicons
              name="people-outline"
              size={48}
              color={Colors.decorativeMuted}
            />
            <Text style={styles.emptyText}>
              {query
                ? "Nenhum cliente encontrado."
                : "Nenhum cliente cadastrado ainda."}
            </Text>
          </View>
        )}
        {filteredClients.map((client) => {
          const history = transactions.filter(
            (transaction) =>
              transaction.clientId === client.id &&
              transaction.amount > 0 &&
              transaction.confirmed !== false,
          );
          const total = history.reduce(
            (sum, transaction) => sum + transaction.amount,
            0,
          );
          const hasPendingNote = /pend[eê]ncia|aberto|deve/i.test(client.notes);
          const hasOverdueContract = transactions.some(
            (transaction) =>
              transaction.clientId === client.id &&
              transaction.contractId &&
              transaction.amount > 0 &&
              transaction.confirmed === false &&
              !!transaction.expectedDate &&
              transaction.expectedDate < new Date().toISOString().split("T")[0],
          );
          const expanded = expandedId === client.id;
          return (
            <SwipeableActions
              key={client.id}
              onEdit={() => openEdit(client)}
              onDelete={() => handleDelete(client.id)}
            >
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setExpandedId(expanded ? null : client.id)}
                activeOpacity={ControlOpacity.pressed}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {client.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{client.name}</Text>
                  <Text style={styles.cardSubtitle}>
                    {client.contact || "Sem contato informado"}
                  </Text>
                </View>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={Colors.iconMuted}
                />
              </TouchableOpacity>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {history.length} receita(s) vinculada(s)
                </Text>
                <Text style={styles.total}>{money(total)}</Text>
              </View>
              {hasPendingNote && (
                <Text style={styles.pendingText}>
                  Pendência mencionada nas observações
                </Text>
              )}
              {hasOverdueContract && (
                <Text style={styles.pendingText}>
                  Pendência de assinatura vencida
                </Text>
              )}
              {expanded && (
                <View style={styles.details}>
                  {!!client.notes && (
                    <Text style={styles.notes}>
                      Observações: {client.notes}
                    </Text>
                  )}
                  <Text style={styles.historyTitle}>Histórico de receitas</Text>
                  {history.length === 0 ? (
                    <Text style={styles.muted}>Nenhuma receita vinculada.</Text>
                  ) : (
                    history.map((transaction) => (
                      <View key={transaction.id} style={styles.historyRow}>
                        <Text style={styles.muted}>
                          {transaction.date} · {transaction.description}
                        </Text>
                        <Text style={styles.historyAmount}>
                          {money(transaction.amount)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
            </SwipeableActions>
          );
        })}
      </ScrollView>
      <FAB respectBottomInset onPress={openAdd} />
      <BottomSheet
        ref={modalVisibleSheet} draft={form} visible={modalVisible}
        onClose={() => setModalVisible(false)}
        height={620}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingId ? "Editar cliente" : "Novo cliente"}
            </Text>
            <RequiredLabel>Nome</RequiredLabel>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor={Colors.placeholder}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              autoFocus
            />
            <FormLabel>Contato (opcional)</FormLabel>
            <TextInput
              style={styles.input}
              placeholder="Contato (telefone ou e-mail)"
              placeholderTextColor={Colors.placeholder}
              value={form.contact}
              onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))}
            />
            <FormLabel>Observações (opcional)</FormLabel>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Observações"
              placeholderTextColor={Colors.placeholder}
              value={form.notes}
              onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.modalCancel}
                onPress={() => modalVisibleSheet.current?.requestClose()}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={styles.modalConfirm}
                onPress={handleSave}
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
  headerTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.lg,
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
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: "PlusJakartaSans_400Regular",
    color: Colors.primary,
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 80, gap: Spacing.md },
  emptyText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  card: {
      ...SurfaceStyles.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "PlusJakartaSans_700Bold", color: Colors.accentText },
  cardMain: { flex: 1 },
  cardTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  cardSubtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  summaryLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  total: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.sm,
    color: Colors.accentText,
  },
  pendingText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: FontSize.xs,
    color: Colors.warningText,
    marginTop: Spacing.xs,
  },
  details: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  notes: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  historyTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: Colors.primary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    gap: Spacing.sm,
  },
  historyAmount: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: Colors.accentText,
    fontSize: FontSize.sm,
  },
  muted: { color: Colors.textMuted, fontSize: FontSize.sm, flex: 1 },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  actionText: {
    color: Colors.accentText,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  deleteText: {
    color: Colors.dangerText,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
  modalOverlay: {
      ...SurfaceStyles.backdrop,
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
      ...SurfaceStyles.overlay,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  modalTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  input: {
      ...SurfaceStyles.control,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancel: {
      ...SurfaceStyles.filter,
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  modalCancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  modalConfirm: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.actionBackground,
    alignItems: "center",
  },
  modalConfirmText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.md,
    color: Colors.onAction,
  },
  ...pluginFormStyles,
});
