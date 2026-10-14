import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryColors, Colors, ControlOpacity, FontSize, Radius, Spacing, SurfaceStyles, TextStyles, Typography } from '../../constants/theme';

export interface ModuleSuggestion {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
  description: string;
  tone: 'danger' | 'warning' | 'neutral';
  onCreate: () => void;
}

const tones = {
  danger: { foreground: Colors.dangerText, background: Colors.dangerLight },
  warning: { foreground: Colors.warningText, background: CategoryColors.amber.bg },
  neutral: { foreground: Colors.accentText, background: Colors.accentLight },
};

export function ModuleSuggestions({ suggestions, onDismiss }: {
  suggestions: ModuleSuggestion[];
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!suggestions.length) return null;
  const visible = expanded ? suggestions : suggestions.slice(0, 1);

  return <View style={styles.section}>
    <View style={styles.header}>
      <Ionicons name="sparkles-outline" size={21} color={Colors.accentIcon} />
      <Text style={styles.heading} accessibilityRole="header">Sugestões dos módulos</Text>
      {suggestions.length > 1 && <TouchableOpacity
        activeOpacity={ControlOpacity.pressed}
        style={styles.more}
        hitSlop={{ top: 4, bottom: 4 }}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Mostrar menos sugestões dos módulos' : `Ver todas as ${suggestions.length} sugestões dos módulos`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
      >
        <Text style={styles.actionText}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={16} color={Colors.accentIcon} />
      </TouchableOpacity>}
    </View>
    {visible.map(suggestion => {
      const tone = tones[suggestion.tone];
      return <View key={suggestion.id} style={styles.card}>
        <View style={[styles.iconSurface, { backgroundColor: tone.background }]}>
          <Ionicons name={suggestion.icon} size={27} color={tone.foreground} />
        </View>
        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={[styles.badge, { backgroundColor: tone.background }]}>
              <Text style={[styles.badgeText, { color: tone.foreground }]}>{suggestion.label}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Dispensar sugestão: ${suggestion.title}`}
              activeOpacity={ControlOpacity.pressed}
              style={styles.dismiss}
              hitSlop={12}
              onPress={() => onDismiss(suggestion.id)}
            >
              <Ionicons name="close" size={19} color={Colors.iconMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{suggestion.title}</Text>
          <Text style={styles.description}>{suggestion.description}</Text>
          <TouchableOpacity
            activeOpacity={ControlOpacity.pressed}
            style={styles.create}
            accessibilityRole="button"
            accessibilityLabel={`Criar tarefa: ${suggestion.title}`}
            onPress={suggestion.onCreate}
          >
            <Text style={styles.actionText}>Criar tarefa</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.accentIcon} />
          </TouchableOpacity>
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  section: { paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  heading: { ...TextStyles.cardTitle, flex: 1, minWidth: 0, fontSize: FontSize.sm },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  actionText: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: Colors.accentText },
  card: { ...SurfaceStyles.card, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconSurface: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, marginTop: Spacing.xs },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.xs },
  badge: { alignSelf: 'flex-start', flexShrink: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontFamily: Typography.medium, fontSize: FontSize.xs },
  dismiss: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  title: { ...TextStyles.cardTitle, marginTop: 2 },
  description: { ...TextStyles.metadata, marginTop: 2 },
  create: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.accentLight, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, marginTop: Spacing.xs },
});
