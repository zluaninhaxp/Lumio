import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

/**
 * Card visual para a resposta do bot no chat.
 *
 * Substitui o texto concatenado ("✓ Tarefa: ... · Prazo: ... · Tags: ...")
 * por um layout estruturado:
 *  - ícone + tipo (Tarefa/Evento/Prazo) no topo
 *  - título em destaque (bold, primary)
 *  - data em evidência (cor accent para execução, warning para deadline)
 *  - pessoa/atribuição com ícone
 *  - tags como chips coloridos
 *  - contexto/descrição em texto menor e mais apagado
 *
 * Mantém a linguagem visual do app (ver `theme.ts`): cantos arredondados
 * Radius.lg, sombra suave, fontes PlusJakartaSans, paleta Colors.
 */

export type BotCardKind = 'task' | 'event' | 'deadline';

export interface BotCard {
  kind: BotCardKind;
  title: string;
  date?: string;
  dateLabel?: string;
  time?: string;
  assignee?: string;
  tags?: string[];
  eventType?: string;
  context?: string;
}

interface BotMessageCardProps {
  card: BotCard;
}

const KIND_CONFIG: Record<BotCardKind, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string }> = {
  task: { icon: 'checkmark-circle-outline', label: 'Tarefa', color: Colors.accent, bg: Colors.accentLight },
  event: { icon: 'calendar-outline', label: 'Evento', color: Colors.accent, bg: Colors.accentLight },
  deadline: { icon: 'time-outline', label: 'Prazo', color: Colors.warning, bg: '#FEF3C7' },
};

const TAG_COLORS = [
  { bg: '#EBF5FF', text: '#2563EB' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#D1FAE5', text: '#059669' },
  { bg: '#EDE9FE', text: '#7C3AED' },
  { bg: '#FFEDD5', text: '#EA580C' },
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function BotMessageCard({ card }: BotMessageCardProps) {
  const cfg = KIND_CONFIG[card.kind];
  const dateColor = card.kind === 'deadline' ? Colors.warning : Colors.accent;
  // Tags só existem em TAREFAS (eventos não têm visualização de tags no app).
  const showTags = card.kind !== 'event' && card.tags && card.tags.length > 0;

  return (
    <View style={styles.card}>
      {/* Header: ícone + tipo */}
      <View style={styles.cardHeader}>
        <View style={[styles.kindBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={13} color={cfg.color} />
          <Text style={[styles.kindLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Título em destaque */}
      <Text style={styles.title} numberOfLines={3}>{card.title}</Text>

      {/* Contexto/descrição (menor, mais apagado) */}
      {card.context && (
        <Text style={styles.context} numberOfLines={2}>{card.context}</Text>
      )}

      {/* Metadata: data + horário + pessoa */}
      {(card.date || card.assignee) && (
        <View style={styles.metaRow}>
          {card.date && (
            <View style={[styles.dateChip, { backgroundColor: dateColor + '15' }]}>
              <Ionicons name="calendar-outline" size={12} color={dateColor} />
              <Text style={[styles.dateText, { color: dateColor }]}>
                {card.dateLabel || card.date}
                {card.time ? ` · ${card.time}` : ''}
              </Text>
            </View>
          )}
          {card.assignee && (
            <View style={styles.assigneeChip}>
              <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.assigneeText} numberOfLines={1}>{card.assignee}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tags como chips coloridos — SÓ em tarefas/deadlines */}
      {showTags && (
        <View style={styles.tagsRow}>
          {card.tags!.map((tag) => {
            const c = getTagColor(tag);
            return (
              <View key={tag} style={[styles.tagChip, { backgroundColor: c.bg }]}>
                <Text style={[styles.tagText, { color: c.text }]} numberOfLines={1}>{tag}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  kindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  kindLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 21,
    marginBottom: 2,
  },
  context: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
  },
  assigneeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    maxWidth: 120,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  tagChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
  },
});
