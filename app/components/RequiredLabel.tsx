import { Text, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { Colors, FontSize } from "../../src/constants/theme";

export function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <FormLabel>
      {children} <Text style={styles.required}>*</Text>
    </FormLabel>
  );
}

export function FormLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  required: {
    color: Colors.danger,
  },
});
