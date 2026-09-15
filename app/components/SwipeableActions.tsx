import { useCallback, useRef, type ReactNode } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "../../src/constants/theme";

let openSwipeable: Swipeable | null = null;

type SwipeableActionsProps = {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function SwipeableActions({ children, onEdit, onDelete }: SwipeableActionsProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleOpen = useCallback(() => {
    if (openSwipeable && openSwipeable !== swipeableRef.current) openSwipeable.close();
    openSwipeable = swipeableRef.current;
  }, []);

  const close = useCallback(() => {
    swipeableRef.current?.close();
    if (openSwipeable === swipeableRef.current) openSwipeable = null;
  }, []);

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={onEdit ? () => (
        <TouchableOpacity style={styles.editAction} onPress={() => { close(); onEdit(); }}>
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
      ) : undefined}
      renderRightActions={onDelete ? () => (
        <TouchableOpacity style={styles.deleteAction} onPress={() => { close(); onDelete(); }}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      ) : undefined}
      onSwipeableWillOpen={handleOpen}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
    >
      <View>{children}</View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  editAction: {
    backgroundColor: Colors.warning,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  deleteAction: {
    backgroundColor: Colors.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  actionText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
});
