import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ControlOpacity, Colors, Spacing, SurfaceStyles } from "../../../src/constants/theme";

interface FABProps {
  onPress: () => void;
  respectBottomInset?: boolean;
}

export function FAB({ onPress, respectBottomInset = false }: FABProps) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={[styles.fab, respectBottomInset && { bottom: Spacing.xl + insets.bottom, right: Spacing.xl + insets.right }]}
      accessibilityRole="button" accessibilityLabel="Adicionar"
      onPress={onPress}
      activeOpacity={ControlOpacity.pressed}
    >
      <Ionicons name="add" size={28} color={Colors.onAction} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
      ...SurfaceStyles.floating,
    position: "absolute",
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.actionBackground,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20
  },
});
