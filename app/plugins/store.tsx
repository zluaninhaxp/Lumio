import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from "../../src/constants/theme";
import { useAppStore } from "../../src/store";
import {
  PLUGIN_LIST,
  canActivatePlugin,
  getPluginDefinition,
  PluginId,
} from "../../src/plugins/registry";
import { AppAlert } from "@/src/services/appAlert";

export default function PluginStoreScreen() {
  const router = useRouter();
  const {
    highlight,
    returnToFinance,
    returnToTasks,
    returnToCalendar,
    returnToQuotes,
    returnToContracts,
    returnToDeliveries,
    returnToSales,
    returnToStock,
    relation,
  } = useLocalSearchParams<{
    highlight?: PluginId;
    returnToFinance?: string;
    returnToTasks?: string;
    returnToCalendar?: string;
    returnToQuotes?: string;
    returnToContracts?: string;
    returnToDeliveries?: string;
    returnToSales?: string;
    returnToStock?: string;
    relation?: "client" | "supplier" | "employee";
  }>();
  const { activatedPlugins, setPluginActivation } = useAppStore();
  const orderedPlugins = [...PLUGIN_LIST].sort((a, b) => {
    const aActive = activatedPlugins.includes(a.id);
    const bActive = activatedPlugins.includes(b.id);
    return Number(bActive) - Number(aActive);
  });

  const tryActivate = (pluginId: PluginId) => {
    const check = canActivatePlugin(pluginId, activatedPlugins);
    if (!check.ok) {
      const labels = check.missing.map(
        (id) => getPluginDefinition(id)?.label ?? id,
      );
      AppAlert.alert(
        "Dependência necessária",
        `Para ativar Comissões você precisa ter ${labels.join(" e ")} ativados primeiro. Comissões usa funcionários cadastrados e pedidos concluídos para calcular o valor devido.`,
        [{ text: "Entendi" }], { variant: 'warning' }
      );
      return;
    }
    setPluginActivation(pluginId, true);
    const route = getPluginDefinition(pluginId)?.route;
    if (route) {
      const returnParams =
        ((relation &&
        (returnToFinance === "1" ||
          returnToTasks === "1" ||
          returnToCalendar === "1" ||
          returnToQuotes === "1" ||
          returnToContracts === "1" ||
          returnToDeliveries === "1" ||
          returnToSales === "1")) || returnToStock === "1")
          ? `?${returnToFinance === "1" ? "returnToFinance" : returnToTasks === "1" ? "returnToTasks" : returnToCalendar === "1" ? "returnToCalendar" : returnToQuotes === "1" ? "returnToQuotes" : returnToContracts === "1" ? "returnToContracts" : returnToDeliveries === "1" ? "returnToDeliveries" : returnToSales === "1" ? "returnToSales" : "returnToStock"}=1${relation ? `&relation=${relation}` : ""}`
          : "";
      router.push(`${route}${returnParams}` as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loja de módulos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.subtitle}>
          Ative módulos extras a qualquer momento. Você pode desativar depois
          sem perder os dados já cadastrados.
        </Text>

        {orderedPlugins.map((def) => {
          const isActive = activatedPlugins.includes(def.id);
          const check = canActivatePlugin(def.id, activatedPlugins);
          const blocked = !isActive && !check.ok;
          return (
            <View
              key={def.id}
              style={[
                styles.card,
                highlight === def.id && styles.cardHighlighted,
              ]}
            >
              <View style={styles.cardIcon}>
                <Ionicons
                  name={def.icon as any}
                  size={22}
                  color={Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{def.label}</Text>
                <Text style={styles.cardDescription}>{def.description}</Text>
                {blocked && (
                  <Text style={styles.dependencyNote}>
                    Requer{" "}
                    {check.missing
                      .map((id) => getPluginDefinition(id)?.label ?? id)
                      .join(" e ")}{" "}
                    ativados.
                  </Text>
                )}
              </View>
              {isActive ? (
                <TouchableOpacity
                  style={styles.activeTag}
                  onPress={() => router.push(def.route as any)}
                  activeOpacity={ControlOpacity.pressed}
                >
                  <Ionicons name="checkmark" size={14} color={Colors.accentIcon} />
                  <Text style={styles.activeTagText}>Já ativo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.activateBtn,
                    blocked && styles.activateBtnDisabled,
                  ]}
                  onPress={() => tryActivate(def.id)}
                  activeOpacity={ControlOpacity.pressed}
                >
                  <Text style={styles.activateBtnText}>Ativar</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
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
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  card: {
      ...SurfaceStyles.card,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm
  },
  cardHighlighted: {
    borderWidth: 2,
    borderColor: Colors.accentIcon,
    backgroundColor: Colors.accentLight,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.mintBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  cardDescription: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dependencyNote: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: FontSize.xs,
    color: Colors.warningText,
    marginTop: 4,
  },
  activateBtn: {
    backgroundColor: Colors.actionBackground,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
  activateBtnDisabled: { backgroundColor: Colors.textDisabled },
  activateBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
    color: Colors.onAction,
  },
  activeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  activeTagText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.xs,
    color: Colors.accentText,
  },
});
