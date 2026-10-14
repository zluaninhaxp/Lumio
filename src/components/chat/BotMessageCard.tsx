import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, CategoryColors, Spacing, Radius, FontSize, SurfaceStyles, ControlOpacity } from '../../constants/theme';

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
 * Radius.lg, superfície branca, fontes PlusJakartaSans, paleta Colors.
 */

export type BotCardKind = 'task' | 'event' | 'deadline' | 'finance' | 'client' | 'supplier' | 'employee' | 'stock' | 'catalog' | 'module';

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
  /** Campos financeiros (kind === 'finance'). */
  direction?: 'expense' | 'income';
  amount?: number;
  pending?: boolean;
  category?: string;
  counterparty?: string;
  /** Personaliza o selo quando o card apresenta um módulo do Lumio. */
  badgeLabel?: string;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
}

interface BotMessageCardProps {
  card: BotCard;
  onExpansionChange?: () => void;
}

const KIND_CONFIG: Record<BotCardKind, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string }> = {
  task: { icon: 'checkmark-circle-outline', label: 'Tarefa', color: Colors.accentText, bg: Colors.accentLight },
  event: { icon: 'calendar-outline', label: 'Evento', color: Colors.accentText, bg: Colors.accentLight },
  deadline: { icon: 'time-outline', label: 'Prazo', color: Colors.warningText, bg: '#FEF3C7' },
  finance: { icon: 'wallet-outline', label: 'Financeiro', color: Colors.accentText, bg: Colors.accentLight },
  client: { icon: 'person-outline', label: 'Cliente cadastrado', color: Colors.accentText, bg: Colors.accentLight },
  supplier: { icon: 'briefcase-outline', label: 'Fornecedor cadastrado', color: Colors.accentText, bg: Colors.accentLight },
  employee: { icon: 'people-outline', label: 'Funcionário cadastrado', color: Colors.accentText, bg: Colors.accentLight },
  stock: { icon: 'cube-outline', label: 'Item no estoque', color: Colors.accentText, bg: Colors.accentLight },
  catalog: { icon: 'pricetags-outline', label: 'Item no catálogo', color: Colors.accentText, bg: Colors.accentLight },
  module: { icon: 'apps-outline', label: 'Módulo', color: Colors.accentText, bg: Colors.accentLight },
};

function formatAmount(value: number): string {
  return `R$ ${Math.abs(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const TAG_COLORS = [
  CategoryColors.blue,
  CategoryColors.amber,
  CategoryColors.pink,
  CategoryColors.green,
  CategoryColors.purple,
  CategoryColors.orange,
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/** Measure the unclamped text at the same width; visible line events differ by platform. */
function MeasuredCardText({ text, lines, expanded, id, measurementKey, style, onOverflow, onGeometry }: {
  text: string; lines: number; expanded: boolean; id: string; measurementKey: string;
  style: StyleProp<TextStyle>; onOverflow: (id: string, overflow: boolean) => void;
  onGeometry: (id: string, kind: 'visible' | 'full', height: number) => void;
}) {
  return <View style={styles.textViewport} onLayout={expanded ? undefined : event => onGeometry(id, 'visible', event.nativeEvent.layout.height)}>
    <Text style={style} numberOfLines={expanded ? undefined : lines} selectable={expanded}>{text}</Text>
    <View key={measurementKey} style={styles.measurement} pointerEvents="none" accessible={false}
      onLayout={event => onGeometry(id, 'full', event.nativeEvent.layout.height)}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={style} onTextLayout={event => onOverflow(id, event.nativeEvent.lines.length > lines)}>{text}</Text>
    </View>
  </View>;
}

export function BotMessageCard({ card, onExpansionChange }: BotMessageCardProps) {
  const { width, fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(0);
  const contentKey = JSON.stringify(card);
  const measurementKey = `${contentKey}:${width}:${cardWidth}:${fontScale}`;
  const activeMeasurement = useRef(measurementKey);
  activeMeasurement.current = measurementKey;
  const geometry = useRef<{ key: string; fields: Record<string, { visible?: number; full?: number }> }>({ key: measurementKey, fields: {} });
  const [expansion, setExpansion] = useState({ key: contentKey, expanded: false });
  const [measurement, setMeasurement] = useState<{ key: string; fields: Record<string, boolean> }>({ key: measurementKey, fields: {} });
  const expanded = expansion.key === contentKey && expansion.expanded;
  const hasOverflow = measurement.key === measurementKey && Object.values(measurement.fields).some(Boolean);
  const reportOverflow = useCallback((id: string, overflow: boolean) => {
    if (activeMeasurement.current !== measurementKey) return;
    setMeasurement(previous => {
      const fields = previous.key === measurementKey ? previous.fields : {};
      if (previous.key === measurementKey && fields[id] === overflow) return previous;
      return { key: measurementKey, fields: { ...fields, [id]: overflow } };
    });
  }, [measurementKey]);
  // Web does not emit native line metrics. Compare actual unclamped/clamped heights.
  const reportGeometry = useCallback((id: string, kind: 'visible' | 'full', height: number) => {
    if (activeMeasurement.current !== measurementKey) return;
    if (geometry.current.key !== measurementKey) geometry.current = { key: measurementKey, fields: {} };
    const field = geometry.current.fields[id] ?? {};
    field[kind] = height;
    geometry.current.fields[id] = field;
    if (field.visible !== undefined && field.full !== undefined) reportOverflow(id, field.full > field.visible + 0.5);
  }, [measurementKey, reportOverflow]);
  const measuredText = (id: string, text: string, lines: number, style: StyleProp<TextStyle>) => (
    <MeasuredCardText key={`${measurementKey}:${id}`} id={id} text={text} lines={lines} style={style} expanded={expanded}
      measurementKey={measurementKey} onOverflow={reportOverflow} onGeometry={reportGeometry} />
  );
  const cfg = KIND_CONFIG[card.kind];
  const badgeIcon = card.badgeIcon ?? cfg.icon;
  const badgeLabel = card.badgeLabel ?? cfg.label;
  const dateColor = card.kind === 'deadline' ? Colors.warningText : Colors.accentText;
  // Tags em TAREFAS e FINANÇAS (categoria como chip); eventos não têm.
  const showTags = card.kind !== 'event' && card.tags && card.tags.length > 0;
  const financeTags = card.kind === 'finance' && card.category ? [card.category] : card.tags;

  return (
    <View style={styles.card} onLayout={event => setCardWidth(event.nativeEvent.layout.width)}>
      {/* Header: ícone + tipo */}
      <View style={styles.cardHeader}>
        <View style={[styles.kindBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={badgeIcon} size={13} color={cfg.color} />
          <Text style={[styles.kindLabel, { color: cfg.color }]}>{badgeLabel}</Text>
        </View>
      </View>

      {/* Título em destaque */}
      {measuredText('title', card.title, 3, styles.title)}

      {/* Contexto/descrição (menor, mais apagado) */}
      {card.context && (
        measuredText('context', card.context, 2, styles.context)
      )}

      {/* Metadata: data + horário + pessoa */}
      {(card.date || card.assignee || card.counterparty) && (
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
          {(card.assignee || card.counterparty) && (
            <View style={styles.assigneeChip}>
              <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
              {measuredText('person', card.assignee || card.counterparty || '', 1, styles.assigneeText)}
            </View>
          )}
        </View>
      )}

      {/* Valor financeiro — valor em destaque + status pendente */}
      {card.kind === 'finance' && card.amount !== undefined && (
        <View style={styles.metaRow}>
          <Text style={[styles.amountText, card.direction === 'income' ? styles.amountIn : styles.amountOut]}>
            {card.direction === 'income' ? '+' : '−'} {formatAmount(card.amount)}
          </Text>
          {card.pending && (
            <View style={styles.pendingChip}>
              <Ionicons name="time-outline" size={11} color={Colors.warningIcon} />
              <Text style={styles.pendingText}>{card.direction === 'income' ? 'a receber' : 'a pagar'}</Text>
            </View>
          )}
        </View>
      )}

      {/* Tags como chips coloridos — SÓ em tarefas/deadlines/finanças */}
      {card.kind !== 'event' && showTags && (
        <View style={styles.tagsRow}>
          {(financeTags ?? card.tags!).map((tag, index) => {
            const c = getTagColor(tag);
            return (
              <View key={tag} style={[styles.tagChip, { backgroundColor: c.bg }]}>
                {measuredText(`tag:${index}`, tag, 1, [styles.tagText, { color: c.text }])}
              </View>
            );
          })}
        </View>
      )}
      {(hasOverflow || expanded) && <TouchableOpacity style={styles.expandButton} activeOpacity={ControlOpacity.pressed}
        onPress={() => { onExpansionChange?.(); setExpansion({ key: contentKey, expanded: !expanded }); }}
        accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Recolher conteúdo do registro' : 'Ver conteúdo completo do registro'}>
        <Text style={styles.expandText}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
      </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  textViewport: { flexShrink: 1, minWidth: 0 },
  measurement: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  expandButton: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingVertical: Spacing.sm },
  expandText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accentText },
  card: {
    ...SurfaceStyles.message,
    borderRadius: Radius.lg,
    borderTopLeftRadius: Radius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  kindBadge: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  kindLabel: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.ink,
    lineHeight: 21,
    marginBottom: 2,
  },
  context: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  dateText: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
  },
  assigneeChip: {
    maxWidth: '100%',
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full
  },
  assigneeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    maxWidth: 120,
  },
  amountText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.md,
  },
  amountIn: { color: Colors.accentText },
  amountOut: { color: Colors.primary },
  pendingChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: '#FEF3C7',
  },
  pendingText: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.warningText,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  tagChip: {
    maxWidth: '100%',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tagText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
  },
});
