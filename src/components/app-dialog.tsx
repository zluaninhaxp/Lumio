import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, DialogTokens, SurfaceStyles, Typography } from '../constants/theme';

export type DialogAction = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => unknown;
};
export type AppDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  error?: string | null;
  actions: DialogAction[];
  onCancel: () => void;
  variant?: 'default' | 'warning' | 'destructive';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
};

/** Extracted from onboarding, including its native fade and safe-area offsets. */
export function AppDialog({ visible, title, message, error, actions, onCancel, variant = 'default', icon, loading = false }: AppDialogProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [cardHeight, setCardHeight] = useState(0);
  const pressed = useRef(false);
  const titleRef = useRef<Text>(null);
  useEffect(() => { if (visible && !loading) pressed.current = false; }, [visible, loading, error]);
  const cancel = () => { if (!loading && !pressed.current) onCancel(); };
  const ordered = [...actions.filter(action => action.style !== 'cancel'), ...actions.filter(action => action.style === 'cancel')];
  const destructive = variant === 'destructive';
  const card = <View onLayout={event => setCardHeight(event.nativeEvent.layout.height)} style={[styles.card, { marginTop: insets.top / 2, marginBottom: insets.bottom / 2 }]} accessibilityRole="alert" accessibilityViewIsModal>
          <View style={[styles.icon, destructive && { backgroundColor: Colors.dangerLight }]}>
            <Ionicons name={icon ?? (destructive ? 'trash-outline' : variant === 'warning' ? 'alert-circle-outline' : 'help-circle-outline')} size={25} color={destructive ? Colors.danger : DialogTokens.icon} />
          </View>
          <Text ref={titleRef} accessibilityRole="header" style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          {!!error && <Text style={styles.message}>{error}</Text>}
          {ordered.map((action, index) => {
            const secondary = action.style === 'cancel';
            return <TouchableOpacity key={index} style={[secondary ? styles.secondary : styles.primary, !message && !error && index === 0 && { marginTop: 22 }, action.style === 'destructive' && { backgroundColor: Colors.danger }]}
              disabled={loading} accessibilityRole="button" accessibilityLabel={action.text ?? 'OK'} accessibilityState={{ disabled: loading, busy: loading }}
              activeOpacity={secondary ? 0.75 : 0.85} onPress={() => {
                if (pressed.current || loading) return;
                pressed.current = true;
                action.onPress?.();
              }}>
              <Text style={secondary ? styles.secondaryText : styles.primaryText}>{action.text ?? 'OK'}</Text>
            </TouchableOpacity>;
          })}
        </View>;
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel} onShow={() => {
    if (Platform.OS === 'web') return;
    const handle = findNodeHandle(titleRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Fechar confirmação" accessibilityRole="button" />
      {cardHeight > height - insets.top - insets.bottom - 48
        ? <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bounces={false}>{card}</ScrollView>
        : card}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: DialogTokens.backdrop },
  scroll: { flexGrow: 0, width: '100%', maxWidth: DialogTokens.maxWidth, overflow: 'visible' },
  scrollContent: { overflow: 'visible' },
  card: { ...SurfaceStyles.overlay, width: '100%', maxWidth: DialogTokens.maxWidth, alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 18, borderRadius: DialogTokens.radius },
  icon: { width: 54, height: 54, marginBottom: 16, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentLight },
  title: { fontFamily: Typography.bold, fontSize: 19, lineHeight: 26, textAlign: 'center', color: Colors.ink },
  message: { marginTop: 9, marginBottom: 22, fontFamily: Typography.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', color: DialogTokens.message },
  primary: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: Colors.accent },
  primaryText: { fontFamily: Typography.bold, fontSize: 15, lineHeight: 20, color: Colors.bgCard, textAlign: 'center' },
  secondary: { width: '100%', minHeight: 46, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: Typography.semibold, fontSize: 14, lineHeight: 20, color: DialogTokens.secondary, textAlign: 'center' },
});
