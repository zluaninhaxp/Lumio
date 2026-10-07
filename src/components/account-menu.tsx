import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from '../constants/theme';

type Icon = keyof typeof Ionicons.glyphMap;
type RowProps = {
  icon: Icon;
  title: string;
  subtitle?: string;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  iconTreatment?: 'plain' | 'tonal';
  onPress?: () => void;
};

export function AccountRow({ icon, title, subtitle, chevron = true, destructive = false, disabled = false, iconTreatment = 'plain', onPress }: RowProps) {
  const detail = !onPress;
  const tonal = iconTreatment === 'tonal';
  const content = <>
    <View style={[styles.icon, tonal && styles.tonalIcon, tonal && destructive && styles.destructiveIcon]}>
      <Ionicons name={icon} size={tonal ? 22 : 20} color={destructive ? Colors.danger : tonal ? Colors.accent : Colors.ink} />
    </View>
    <View style={styles.copy}>
      <Text style={[styles.title, detail && styles.detailLabel, destructive && styles.destructiveText]}>{title}</Text>
      {!!subtitle && <Text style={[styles.subtitle, detail && styles.detailValue]}>{subtitle}</Text>}
    </View>
    {chevron && onPress && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
  </>;
  return onPress ? <TouchableOpacity
    style={[styles.row, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={.7}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
  >{content}</TouchableOpacity> : <View style={[styles.row, styles.detailRow]}>{content}</View>;
}

export function AccountSection({ title, icon, onEdit, style, children }: {
  title: string;
  icon: Icon;
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return <View style={[styles.section, style]}>
    <View style={styles.head}>
      <View style={styles.sectionIcon}><Ionicons name={icon} size={18} color={Colors.accent} /></View>
      <Text style={styles.heading}>{title}</Text>
      {onEdit && <TouchableOpacity onPress={onEdit} style={styles.edit} accessibilityRole="button" accessibilityLabel={`Editar ${title}`}>
        <Text style={styles.editText}>Editar</Text>
      </TouchableOpacity>}
    </View>
    <View style={styles.surface}>{children}</View>
  </View>;
}

export function BusinessBadge({ name }: { name: string }) {
  return name ? <View style={styles.badge}>
    <Ionicons name="storefront-outline" size={14} color={Colors.accent} />
    <Text style={styles.badgeText}>{name}</Text>
  </View> : null;
}

export function AccountDivider({ tonal = false }: { tonal?: boolean }) {
  return <View style={[styles.divider, tonal && styles.tonalDivider]} />;
}

export const accountSurface: StyleProp<ViewStyle> = {
  ...SurfaceStyles.card,
  borderRadius: Radius.xl,
  paddingHorizontal: Spacing.lg,
};

export const accountLayout = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
    width: '100%',
    maxWidth: 530,
    alignSelf: 'center',
  },
  firstSection: { marginTop: 0 },
});

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailRow: { minHeight: 64 },
  icon: { width: Spacing.xxxl, height: Spacing.xxxl, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tonalIcon: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.accentLight },
  destructiveIcon: { backgroundColor: Colors.dangerLight },
  copy: { flex: 1, minWidth: 0, gap: Spacing.xs },
  title: { fontFamily: Typography.semibold, fontSize: FontSize.sm, lineHeight: 20, color: Colors.ink },
  subtitle: { fontFamily: Typography.regular, fontSize: FontSize.xs, lineHeight: 18, color: Colors.textSecondary },
  detailLabel: { fontFamily: Typography.medium, fontSize: FontSize.xs, lineHeight: 16, color: Colors.textSecondary },
  detailValue: { fontFamily: Typography.medium, fontSize: FontSize.sm, lineHeight: 20, color: Colors.ink },
  destructiveText: { color: Colors.danger },
  disabled: { opacity: .5 },
  section: { marginTop: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 40, marginBottom: Spacing.xs },
  sectionIcon: { width: Spacing.xxl, alignItems: 'center' },
  heading: { flex: 1, color: Colors.ink, fontFamily: Typography.semibold, fontSize: FontSize.sm, lineHeight: 20 },
  surface: { ...SurfaceStyles.card, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg },
  edit: { minHeight: 44, justifyContent: 'center' },
  editText: { color: Colors.accent, fontFamily: Typography.semibold, fontSize: FontSize.xs, lineHeight: 16, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.accentLight, overflow: 'hidden' },
  badge: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.accentLight, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  badgeText: { flexShrink: 1, fontFamily: Typography.semibold, color: Colors.accent, fontSize: FontSize.xs, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: Spacing.xxxl + Spacing.md },
  tonalDivider: { marginLeft: 40 + Spacing.md },
});
