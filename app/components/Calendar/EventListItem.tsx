import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import type { CalendarEvent } from '../../../src/store';
import { ChatIndicator } from '../ChatIndicator';

interface EventListItemProps {
  item: CalendarEvent;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCancel?: (id: string) => void;
  completingId: string | null;
  onCompleteStart: (id: string) => void;
  onCompleteEnd: (id: string) => void;
}

export function EventListItem({
  item,
  onToggle,
  onDelete,
  onCancel,
  completingId,
  onCompleteStart,
  onCompleteEnd,
}: EventListItemProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const isCompleting = completingId === item.id;

  useEffect(() => {
    if (!isCompleting && item.done) {
      opacity.setValue(0.5);
    } else if (!isCompleting && !item.done) {
      opacity.setValue(1);
    }
  }, [isCompleting, item.done, opacity]);

  const handleToggle = useCallback(() => {
    if (item.type === 'task' || item.id.startsWith('appointment:')) {
      onCompleteStart(item.id);
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ]).start(() => {
        onToggle(item.id);
        onCompleteEnd(item.id);
      });
    }
  }, [item, onToggle, onCompleteStart, onCompleteEnd, opacity]);

  const handleDelete = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete(item.id);
    });
  }, [item.id, onDelete, opacity]);

  const isTask = item.type === 'task';
  // Deadline (prazo) é uma tarefa com `deadline: true` — representação
  // visual distinta de compromisso pontual (seção 21). Eventos antigos
  // sem `deadline` continuam com checkbox normal.
  const isDeadline = isTask && item.deadline === true;
  // Evento derivado de tarefa (source='task') — checkbox sincroniza com a
  // tarefa vinculada; não é editável/deletável como evento independente.
  const isTaskDerived = isTask && item.source === 'task';

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.row}>
        {isTask || item.id.startsWith('appointment:') ? (
          <TouchableOpacity
            style={[styles.checkbox, item.done && styles.checkboxDone, isDeadline && styles.checkboxDeadline]}
            onPress={handleToggle}
            activeOpacity={0.7}
          >
            {item.done && <Ionicons name="checkmark" size={14} color="#FFF" />}
            {!item.done && isDeadline && <Ionicons name="time-outline" size={12} color={Colors.warning} />}
          </TouchableOpacity>
        ) : (
          <View style={[styles.eventBar, { backgroundColor: Colors.accent }]} />
        )}

        <View style={styles.info}>
          {item.time && (
            <Text style={styles.time}>
              {item.time}
              {item.type === 'event' && (
                <Text style={styles.typeBadge}> · Evento</Text>
              )}
              {isDeadline && (
                <Text style={styles.deadlineBadge}> · Prazo</Text>
              )}
              {isTaskDerived && !isDeadline && (
                <Text style={styles.typeBadge}> · Tarefa</Text>
              )}
            </Text>
          )}
          {!item.time && isDeadline && (
            <Text style={styles.time}>
              <Text style={styles.deadlineBadge}>Prazo</Text>
            </Text>
          )}
          <View style={styles.descriptionRow}>
            {(item.source === 'chat' || item.origin === 'chat') && <ChatIndicator size={14} />}
            <Text
              style={[
                styles.description,
                item.done && styles.descriptionDone,
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          </View>
        </View>

        {item.id.startsWith('appointment:') && onCancel && <TouchableOpacity onPress={() => onCancel(item.id)} style={styles.deleteBtn}><Ionicons name="close-circle-outline" size={16} color={Colors.warning} /></TouchableOpacity>}
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkboxDeadline: { borderColor: Colors.warning },
  deadlineBadge: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.warning,
  },
  eventBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  info: { flex: 1, gap: 2 },
  descriptionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  time: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  typeBadge: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  descriptionDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
});
