import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from '../constants/theme';

type Feedback = { title: string; message?: string };
const listeners = new Set<(feedback: Feedback) => void>();
export const AppFeedback = {
  show(title: string, message?: string) { listeners.forEach(listener => listener({ title, message })); },
};

/** Non-blocking success feedback, using the existing Finance snackbar surface. */
export function AppFeedbackHost() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => { listeners.add(setFeedback); return () => { listeners.delete(setFeedback); }; }, []);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(null), 5000); return () => clearTimeout(timer); }, [feedback]);
  if (!feedback) return null;
  return <View pointerEvents="box-none" style={[styles.position, { bottom: insets.bottom + Spacing.xl }]}>
    <Pressable onPress={() => setFeedback(null)} style={styles.bar} accessibilityRole="button" accessibilityLabel={`${feedback.title}. ${feedback.message ?? ''}. Fechar aviso`} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
      <View style={styles.content}><Text style={styles.title}>{feedback.title}</Text>{!!feedback.message && <Text style={styles.message}>{feedback.message}</Text>}</View>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  position: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, zIndex: 100 },
  bar: { ...SurfaceStyles.floating, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  content: { flex: 1, gap: Spacing.xs },
  title: { fontFamily: Typography.medium, fontSize: FontSize.sm, color: Colors.bgCard },
  message: { fontFamily: Typography.regular, fontSize: FontSize.sm, color: Colors.bgCard },
});
