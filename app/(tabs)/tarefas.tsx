import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, Alert, LayoutAnimation, Platform, UIManager, ActivityIndicator,
  Pressable, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Task = ReturnType<typeof useAppStore.getState>['tasks'][number];
type Subtask = Task['subtasks'][number];
type Priority = 'alta' | 'media' | 'baixa';
type FilterKey = 'todas' | 'hoje' | 'importante' | 'concluidas';

const PRIORITY_CONFIG = {
  alta: { label: 'Alta', color: Colors.danger, icon: 'flag' as const },
  media: { label: 'Média', color: Colors.warning, icon: 'flash' as const },
  baixa: { label: 'Baixa', color: Colors.accent, icon: 'arrow-down' as const },
} as const;

const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

const FILTERS: { key: FilterKey; label: string; icon: any }[] = [
  { key: 'todas', label: 'Todas', icon: 'list-outline' },
  { key: 'hoje', label: 'Hoje', icon: 'today-outline' },
  { key: 'importante', label: 'Importante', icon: 'flag-outline' },
  { key: 'concluidas', label: 'Concluídas', icon: 'checkmark-done-outline' },
];

const TAG_COLORS = [
  { bg: '#EBF5FF', text: '#2563EB' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#FCE7F3', text: '#DB2777' },
  { bg: '#D1FAE5', text: '#059669' },
  { bg: '#EDE9FE', text: '#7C3AED' },
  { bg: '#FFEDD5', text: '#EA580C' },
  { bg: '#E0F2FE', text: '#0284C7' },
  { bg: '#FEE2E2', text: '#DC2626' },
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

const CONTENT_H = Spacing.xl;

function formatTaskDate(item: { dueDate: string | null; dueDateLabel?: string | null }): string {
  if (!item.dueDate) return '';
  if (item.dueDateLabel) return item.dueDateLabel;
  return formatDueDate(item.dueDate);
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays < 0) return 'Atrasada';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d.getTime() === now.getTime();
}

function getCalendarDays(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  for (let i = 0; i < firstDow; i++) currentWeek.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

function isSameDate(a: string | null, y: number, m: number, d: number): boolean {
  if (!a) return false;
  const parts = a.split('-');
  return parseInt(parts[0]) === y && parseInt(parts[1]) === m + 1 && parseInt(parts[2]) === d;
}

function isTodayDate(y: number, m: number, d: number): boolean {
  const now = new Date();
  return now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
}

function getDateQuickOptions(): { label: string; value: string | null; icon: any }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - today.getDay()));
  const nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  return [
    { label: 'Hoje', value: fmt(today), icon: 'sunny-outline' },
    { label: 'Amanhã', value: fmt(tomorrow), icon: 'calendar-outline' },
    { label: 'Esta semana', value: fmt(endOfWeek), icon: 'today-outline' },
    { label: 'Próxima semana', value: fmt(nextMonday), icon: 'arrow-forward-outline' },
    { label: 'Sem data', value: null, icon: 'close-circle-outline' },
  ];
}

function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aDate = a.dueDate ? new Date(a.dueDate + 'T00:00:00').getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate + 'T00:00:00').getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    const aP = PRIORITY_WEIGHT[a.priority] ?? 1;
    const bP = PRIORITY_WEIGHT[b.priority] ?? 1;
    return aP - bP;
  });
}

function subtaskProgress(subtasks: Subtask[]): { done: number; total: number } {
  const total = subtasks.length;
  if (total === 0) return { done: 0, total: 0 };
  const done = subtasks.filter((s) => s.done).length;
  return { done, total };
}

export default function TarefasScreen() {
  const { tasks, addTask, updateTask, toggleTask, removeTask, customTaskTags, addCustomTaskTag, removeCustomTaskTag } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('todas');
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('baixa');
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(null);
  const [newTaskDueDateLabel, setNewTaskDueDateLabel] = useState<string | null>(null);
  const [isNewTaskFocused, setIsNewTaskFocused] = useState(false);
  const [priorityPicker, setPriorityPicker] = useState<{
    taskId?: string;
    current: Priority;
    isNewTask?: boolean;
  } | null>(null);
  const [datePicker, setDatePicker] = useState<{
    taskId?: string;
    current: string | null;
    isNewTask?: boolean;
  } | null>(null);
  const [calendarViewYear, setCalendarViewYear] = useState(new Date().getFullYear());
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date().getMonth());
  const [showCalendar, setShowCalendar] = useState(false);
  const [tagManager, setTagManager] = useState<{ taskId: string; current: string[] } | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newSubtaskTexts, setNewSubtaskTexts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const newTaskInputRef = useRef<TextInput>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (datePicker) {
      if (datePicker.current) {
        const d = new Date(datePicker.current + 'T00:00:00');
        setCalendarViewYear(d.getFullYear());
        setCalendarViewMonth(d.getMonth());
      } else {
        const now = new Date();
        setCalendarViewYear(now.getFullYear());
        setCalendarViewMonth(now.getMonth());
      }
    }
  }, [datePicker]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.subtasks.some((s) => s.text.toLowerCase().includes(q)),
      );
    }

    switch (activeFilter) {
      case 'hoje':
        result = result.filter((t) => isToday(t.dueDate));
        break;
      case 'importante':
        result = result.filter((t) => t.priority === 'alta');
        break;
      case 'concluidas':
        result = result.filter((t) => t.done);
        break;
    }

    if (activeTagFilters.length > 0) {
      result = result.filter((t) =>
        activeTagFilters.some((tag) => t.tags.includes(tag)),
      );
    }

    return sortTasks(result);
  }, [tasks, searchQuery, activeFilter, activeTagFilters]);

  const hasNoTasksAtAll = tasks.length === 0;

  const handleAddTask = useCallback(() => {
    const text = newTaskText.trim();
    if (!text) return;
    addTask({
      description: text,
      done: false,
      dueDate: newTaskDueDate,
      dueDateLabel: newTaskDueDateLabel,
      priority: newTaskPriority,
      subtasks: [],
      tags: [],
      createdAt: new Date().toISOString(),
    });
    setNewTaskText('');
    setNewTaskPriority('baixa');
    setNewTaskDueDate(null);
    setNewTaskDueDateLabel(null);
    setIsNewTaskFocused(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [newTaskText, newTaskDueDate, newTaskDueDateLabel, newTaskPriority, addTask]);

  const handleToggle = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      toggleTask(id);
    },
    [toggleTask],
  );

  const handleDelete = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeTask(id);
      if (expandedTaskId === id) setExpandedTaskId(null);
    },
    [removeTask, expandedTaskId],
  );

  const handleStartEdit = useCallback((id: string, description: string) => {
    setEditingTaskId(id);
    setEditText(description);
  }, []);

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (editText.trim()) {
        updateTask(id, { description: editText.trim() });
      }
      setEditingTaskId(null);
      setEditText('');
    },
    [editText, updateTask],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
    setEditText('');
  }, []);

  const handleSetPriority = useCallback(
    (taskId: string | undefined, priority: Priority, isNewTask: boolean) => {
      if (isNewTask || !taskId) {
        setNewTaskPriority(priority);
      } else {
        updateTask(taskId, { priority });
      }
      setPriorityPicker(null);
    },
    [updateTask],
  );

  const handleSetDueDate = useCallback(
    (taskId: string | undefined, dueDate: string | null, isNewTask: boolean, label?: string | null) => {
      if (isNewTask || !taskId) {
        setNewTaskDueDate(dueDate);
        setNewTaskDueDateLabel(label ?? null);
      } else {
        updateTask(taskId, { dueDate, dueDateLabel: label ?? null });
      }
      setDatePicker(null);
    },
    [updateTask],
  );

  const getFreshSubtasks = useCallback((taskId: string): Subtask[] => {
    const task = useAppStore.getState().tasks.find((t) => t.id === taskId);
    return task?.subtasks ?? [];
  }, []);

  const handleToggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      const subtasks = getFreshSubtasks(taskId);
      const updated = subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
      updateTask(taskId, { subtasks: updated });
    },
    [updateTask, getFreshSubtasks],
  );

  const handleRemoveSubtask = useCallback(
    (taskId: string, subtaskId: string) => {
      const subtasks = getFreshSubtasks(taskId);
      updateTask(taskId, { subtasks: subtasks.filter((s) => s.id !== subtaskId) });
    },
    [updateTask, getFreshSubtasks],
  );

  const handleAddSubtask = useCallback(
    (taskId: string) => {
      const text = (newSubtaskTexts[taskId] ?? '').trim();
      if (!text) return;
      const subtasks = getFreshSubtasks(taskId);
      const newSub: Subtask = { id: Date.now().toString(), text, done: false };
      updateTask(taskId, { subtasks: [...subtasks, newSub] });
      setNewSubtaskTexts((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
    },
    [newSubtaskTexts, updateTask, getFreshSubtasks],
  );

  const closeOpenSwipeable = useCallback(() => {
    swipeableRefs.current.forEach((ref) => {
      try { ref.close(); } catch (_) {}
    });
  }, []);

  const handleToggleExpand = useCallback(
    (taskId: string) => {
      closeOpenSwipeable();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
    },
    [closeOpenSwipeable],
  );

  const handleToggleTag = useCallback(
    (taskId: string, tag: string) => {
      const task = useAppStore.getState().tasks.find((t) => t.id === taskId);
      if (!task) return;
      const hasTag = task.tags.includes(tag);
      updateTask(taskId, {
        tags: hasTag ? task.tags.filter((t) => t !== tag) : [...task.tags, tag],
      });
      setTagManager((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          current: hasTag ? prev.current.filter((t) => t !== tag) : [...prev.current, tag],
        };
      });
    },
    [updateTask],
  );

  const handleCreateTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name || customTaskTags.includes(name)) return;
    addCustomTaskTag(name);
    if (tagManager) {
      updateTask(tagManager.taskId, { tags: [...tagManager.current, name] });
      setTagManager((prev) => (prev ? { ...prev, current: [...prev.current, name] } : null));
    }
    setNewTagName('');
  }, [newTagName, customTaskTags, addCustomTaskTag, updateTask, tagManager]);

  const handleRemoveGlobalTag = useCallback(
    (tag: string) => {
      removeCustomTaskTag(tag);
      if (tagManager) {
        setTagManager((prev) =>
          prev ? { ...prev, current: prev.current.filter((t) => t !== tag) } : null,
        );
      }
    },
    [removeCustomTaskTag, tagManager],
  );

  // ─────── Quick Add Bar ───────
  const renderQuickAddBar = () => (
    <View style={[styles.quickAddContainer, isNewTaskFocused && styles.quickAddContainerFocused]}>
      <View style={styles.quickAddRow}>
        <View style={styles.quickAddIconWrap}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.textMuted} />
        </View>
        <TextInput
          ref={newTaskInputRef}
          style={styles.quickAddInput}
          placeholder={isNewTaskFocused ? '' : 'O que você precisa fazer?'}
          placeholderTextColor={Colors.textMuted}
          value={newTaskText}
          onChangeText={(t) => {
            setNewTaskText(t);
            if (t.length > 0) setIsNewTaskFocused(true);
          }}
          onFocus={() => setIsNewTaskFocused(true)}
          onBlur={() => {
            if (newTaskText.length === 0) setIsNewTaskFocused(false);
          }}
          onSubmitEditing={handleAddTask}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {newTaskText.length > 0 && (
          <TouchableOpacity
            onPress={handleAddTask}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.quickAddSubmit}
          >
            <Ionicons name="arrow-up-circle" size={26} color={Colors.accent} />
          </TouchableOpacity>
        )}
        {isNewTaskFocused && newTaskText.length > 0 && (
          <TouchableOpacity
            style={styles.quickAddCancel}
            onPress={() => {
              setNewTaskText('');
              setNewTaskPriority('baixa');
              setNewTaskDueDate(null);
              setNewTaskDueDateLabel(null);
              setIsNewTaskFocused(false);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isNewTaskFocused && newTaskText.length > 0 && (
        <View style={styles.quickAddMeta}>
          <TouchableOpacity
            style={styles.metaBadge}
            onPress={() => setPriorityPicker({ current: newTaskPriority, isNewTask: true })}
          >
            <Ionicons
              name={PRIORITY_CONFIG[newTaskPriority].icon}
              size={12}
              color={PRIORITY_CONFIG[newTaskPriority].color}
            />
            <Text style={[styles.metaBadgeText, { color: PRIORITY_CONFIG[newTaskPriority].color }]}>
              {PRIORITY_CONFIG[newTaskPriority].label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metaBadge}
            onPress={() => setDatePicker({ current: newTaskDueDate, isNewTask: true })}
          >
            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaBadgeText}>
              {newTaskDueDateLabel ?? (newTaskDueDate ? formatDueDate(newTaskDueDate) : 'Prazo')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ─────── Empty State ───────
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      {hasNoTasksAtAll && !searchQuery ? (
        <>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="checkbox-outline" size={36} color={Colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma tarefa ainda</Text>
          <Text style={styles.emptySubtitle}>
            Use o campo acima para criar sua primeira tarefa.
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="search-outline" size={40} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
          <Text style={styles.emptyTitle}>Nenhum resultado</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? `Nenhuma tarefa encontrada para "${searchQuery}".`
              : 'Nenhuma tarefa corresponde ao filtro selecionado.'}
          </Text>
          {(searchQuery || activeFilter !== 'todas') && (
            <TouchableOpacity
              style={styles.clearFilterBtn}
              onPress={() => {
                setSearchQuery('');
                setActiveFilter('todas');
              }}
            >
              <Text style={styles.clearFilterBtnText}>Limpar filtros</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  // ─────── Swipe Actions ───────
  const renderRightActions = (taskId: string) => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => { closeOpenSwipeable(); handleDelete(taskId); }}
    >
      <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>Excluir</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (taskId: string, task: Task) => (
    <TouchableOpacity
      style={[styles.swipeComplete, task.done && styles.swipeCompleteUndo]}
      onPress={() => { closeOpenSwipeable(); handleToggle(taskId); }}
    >
      <Ionicons name={task.done ? 'arrow-undo' : 'checkmark-circle'} size={20} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>{task.done ? 'Reabrir' : 'Concluir'}</Text>
    </TouchableOpacity>
  );

  // ─────── Task Card ───────
  const renderTaskCard = ({ item }: { item: Task }) => {
    const isExpanded = expandedTaskId === item.id;
    const isEditing = editingTaskId === item.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = item.dueDate && !item.done && new Date(item.dueDate + 'T00:00:00') < today;
    const progress = subtaskProgress(item.subtasks);

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
          else swipeableRefs.current.delete(item.id);
        }}
        renderRightActions={() => renderRightActions(item.id)}
        renderLeftActions={() => renderLeftActions(item.id, item)}
        onSwipeableWillOpen={() => {
          swipeableRefs.current.forEach((r, key) => {
            if (key !== item.id) r.close();
          });
        }}
        overshootRight={false}
        overshootLeft={false}
        friction={2}
      >
        <TouchableOpacity
          style={[styles.taskCard, item.done && styles.taskCardDone]}
          activeOpacity={0.7}
          onLongPress={() => {
            Alert.alert('Excluir tarefa', `"${item.description}" será removida.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Excluir', style: 'destructive', onPress: () => handleDelete(item.id) },
            ]);
          }}
        >
          <View style={styles.taskMainRow}>
            <TouchableOpacity
              style={[styles.checkbox, item.done && styles.checkboxDone]}
              onPress={() => handleToggle(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {item.done && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.taskBody}
              activeOpacity={1}
              onPress={() => handleToggleExpand(item.id)}
            >
              {isEditing ? (
                <TextInput
                  style={styles.inlineEditInput}
                  value={editText}
                  onChangeText={setEditText}
                  onSubmitEditing={() => handleSaveEdit(item.id)}
                  onBlur={handleCancelEdit}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                />
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    if (!item.done) handleStartEdit(item.id, item.description);
                  }}
                  activeOpacity={1}
                >
                  <Text
                    style={[styles.taskText, item.done && styles.taskTextDone]}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {item.description}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.taskMetaRow}>
                <TouchableOpacity
                  style={styles.taskMetaTag}
                  onPress={() => setPriorityPicker({ taskId: item.id, current: item.priority })}
                >
                  <Ionicons
                    name={PRIORITY_CONFIG[item.priority].icon}
                    size={10}
                    color={PRIORITY_CONFIG[item.priority].color}
                  />
                  <Text style={[styles.taskMetaText, { color: PRIORITY_CONFIG[item.priority].color }]}>
                    {PRIORITY_CONFIG[item.priority].label}
                  </Text>
                </TouchableOpacity>

                {item.dueDate && (
                  <TouchableOpacity
                    style={[styles.taskMetaTag, isOverdue && styles.taskMetaTagOverdue]}
                    onPress={() => setDatePicker({ taskId: item.id, current: item.dueDate })}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={10}
                      color={isOverdue ? Colors.danger : Colors.textSecondary}
                    />
                    <Text style={[styles.taskMetaText, { color: isOverdue ? Colors.danger : Colors.textSecondary }]}>
                      {formatTaskDate(item)}
                    </Text>
                  </TouchableOpacity>
                )}

                {!item.dueDate && (
                  <TouchableOpacity
                    style={styles.taskMetaTag}
                    onPress={() => setDatePicker({ taskId: item.id, current: item.dueDate })}
                  >
                    <Ionicons name="calendar-outline" size={10} color={Colors.textSecondary} />
                    <Text style={styles.taskMetaText}>Prazo</Text>
                  </TouchableOpacity>
                )}

                {item.tags.map((tag) => {
                  const c = getTagColor(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, { backgroundColor: c.bg }]}
                      onPress={() => setTagManager({ taskId: item.id, current: item.tags })}
                    >
                      <Text style={[styles.tagChipText, { color: c.text }]} numberOfLines={1}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.tagChipAdd}
                  onPress={() => setTagManager({ taskId: item.id, current: item.tags })}
                >
                  <Ionicons name="add" size={12} color={Colors.textMuted} />
                </TouchableOpacity>

                {progress.total > 0 && (
                  <TouchableOpacity
                    style={styles.taskMetaTag}
                    onPress={() => handleToggleExpand(item.id)}
                  >
                    <Ionicons name="list-outline" size={10} color={Colors.textSecondary} />
                    <Text style={styles.taskMetaText}>{progress.done}/{progress.total}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleToggleExpand(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.chevronBtn}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {isExpanded && (
            <View style={styles.accordion}>
              {item.subtasks.length > 0 && (
                <View style={styles.subtaskList}>
                  <View style={styles.subtaskProgressRow}>
                    <View style={styles.subtaskProgressBarTrack}>
                      <View
                        style={[
                          styles.subtaskProgressBarFill,
                          { width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' },
                        ]}
                      />
                    </View>
                    <Text style={styles.subtaskProgressText}>
                      {progress.done}/{progress.total}
                    </Text>
                  </View>
                  {item.subtasks.map((sub) => (
                    <View key={sub.id} style={styles.subtaskItem}>
                      <TouchableOpacity
                        style={[styles.subtaskCheck, sub.done && styles.subtaskCheckDone]}
                        onPress={() => handleToggleSubtask(item.id, sub.id)}
                      >
                        {sub.done && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
                      </TouchableOpacity>
                      <Text style={[styles.subtaskText, sub.done && styles.subtaskTextDone]} numberOfLines={2}>
                        {sub.text}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveSubtask(item.id, sub.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.addSubtaskRow}>
                <Ionicons name="add" size={15} color={Colors.textMuted} style={{ marginRight: Spacing.sm }} />
                <TextInput
                  style={styles.addSubtaskInput}
                  placeholder="Adicionar subtarefa..."
                  placeholderTextColor={Colors.textMuted}
                  value={newSubtaskTexts[item.id] ?? ''}
                  onChangeText={(t) => setNewSubtaskTexts((prev) => ({ ...prev, [item.id]: t }))}
                  onSubmitEditing={() => handleAddSubtask(item.id)}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  // ─────── Tag Manager Modal ───────
  const renderTagManager = () => (
    <Modal visible={tagManager !== null} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setTagManager(null)}>
        <Pressable style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Tags</Text>
            <TouchableOpacity
              onPress={() => setTagManager(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {customTaskTags.length === 0 && (
            <Text style={styles.tagEmpty}>Nenhuma tag criada ainda.</Text>
          )}

          <View style={styles.tagGrid}>
            {customTaskTags.map((tag) => {
              const c = getTagColor(tag);
              const active = tagManager?.current.includes(tag) ?? false;
              return (
                <View key={tag} style={styles.tagRow}>
                  <TouchableOpacity
                    style={[
                      styles.tagToggleChip,
                      { borderColor: active ? c.text : Colors.border, backgroundColor: active ? c.bg : 'transparent' },
                    ]}
                    onPress={() => {
                      if (tagManager) handleToggleTag(tagManager.taskId, tag);
                    }}
                  >
                    <Text style={[styles.tagToggleText, { color: active ? c.text : Colors.textSecondary }]}>
                      {tag}
                    </Text>
                    {active && <Ionicons name="checkmark" size={14} color={c.text} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveGlobalTag(tag)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={styles.tagDivider} />
          <View style={styles.tagAddRow}>
            <TextInput
              style={styles.tagAddInput}
              placeholder="Nova tag..."
              placeholderTextColor={Colors.textMuted}
              value={newTagName}
              onChangeText={setNewTagName}
              onSubmitEditing={handleCreateTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.tagAddBtn} onPress={handleCreateTag}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ─────── Priority Picker Modal ───────
  const renderPriorityPicker = () => (
    <Modal visible={priorityPicker !== null} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setPriorityPicker(null)}>
        <Pressable style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Prioridade</Text>
            <TouchableOpacity
              onPress={() => setPriorityPicker(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.pickerOption, priorityPicker?.current === p && styles.pickerOptionActive]}
              onPress={() => {
                if (priorityPicker) {
                  handleSetPriority(priorityPicker.taskId, p, priorityPicker.isNewTask ?? false);
                }
              }}
            >
              <View style={[styles.pickerIconCircle, { backgroundColor: PRIORITY_CONFIG[p].color + '18' }]}>
                <Ionicons name={PRIORITY_CONFIG[p].icon} size={20} color={PRIORITY_CONFIG[p].color} />
              </View>
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <Text style={styles.pickerOptionLabel}>{PRIORITY_CONFIG[p].label}</Text>
                <Text style={styles.pickerOptionDesc}>
                  {p === 'alta' ? 'Ação imediata necessária' : p === 'media' ? 'Planejar em breve' : 'Pode esperar'}
                </Text>
              </View>
              {priorityPicker?.current === p && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ─────── Date Picker Modal ───────
  const renderDatePicker = () => {
    const options = getDateQuickOptions();
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const weeks = getCalendarDays(calendarViewYear, calendarViewMonth);
    const selectedDate = datePicker?.current ?? null;
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    const goToPrevMonth = () => {
      if (calendarViewMonth === 0) {
        setCalendarViewYear((y) => y - 1);
        setCalendarViewMonth(11);
      } else {
        setCalendarViewMonth((m) => m - 1);
      }
    };

    const goToNextMonth = () => {
      if (calendarViewMonth === 11) {
        setCalendarViewYear((y) => y + 1);
        setCalendarViewMonth(0);
      } else {
        setCalendarViewMonth((m) => m + 1);
      }
    };

    const handleCalendarDateSelect = (day: number) => {
      const m = String(calendarViewMonth + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      const dateStr = `${calendarViewYear}-${m}-${d}`;
      if (datePicker) {
        handleSetDueDate(datePicker.taskId, dateStr, datePicker.isNewTask ?? false);
        setShowCalendar(false);
      }
    };

    return (
      <Modal
        visible={datePicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePicker(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setDatePicker(null); setShowCalendar(false); }}>
          <Pressable style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Data de vencimento</Text>
              <TouchableOpacity
                onPress={() => { setDatePicker(null); setShowCalendar(false); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {options.map((opt, idx) => {
              const isSelected = (selectedDate ?? null) === (opt.value ?? null);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.pickerOption, isSelected && styles.pickerOptionActive]}
                  onPress={() => {
                    if (datePicker) {
                      const periodLabels = ['Esta semana', 'Próxima semana'];
                      const label = periodLabels.includes(opt.label) ? opt.label : null;
                      handleSetDueDate(datePicker.taskId, opt.value, datePicker.isNewTask ?? false, label);
                      setShowCalendar(false);
                    }
                  }}
                >
                  <View style={[styles.pickerIconCircle, isSelected && { backgroundColor: Colors.accentLight }]}>
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={isSelected ? Colors.accent : Colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.pickerOptionLabel, { marginLeft: Spacing.md, flex: 1 }]}>
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={styles.dateDivider} />

            {/* Collapsible calendar trigger */}
            <TouchableOpacity
              style={styles.calendarTrigger}
              onPress={() => setShowCalendar((v) => !v)}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={selectedDate ? Colors.accent : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.calendarTriggerText,
                  selectedDate && styles.calendarTriggerTextActive,
                ]}
              >
                {selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Escolher data específica'}
              </Text>
              <Ionicons
                name={showCalendar ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textMuted}
              />
            </TouchableOpacity>

            {showCalendar && (
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={goToPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.calendarMonthLabel}>
                    {monthNames[calendarViewMonth]} {calendarViewYear}
                  </Text>
                  <TouchableOpacity onPress={goToNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.calendarWeekDays}>
                  {weekDays.map((wd, i) => (
                    <View key={i} style={styles.calendarWeekDayCell}>
                      <Text style={styles.calendarWeekDayText}>{wd}</Text>
                    </View>
                  ))}
                </View>

                {weeks.map((week, wi) => (
                  <View key={wi} style={styles.calendarWeek}>
                    {week.map((day, di) => {
                      if (day === null) {
                        return <View key={di} style={styles.calendarDayCell} />;
                      }
                      const dateStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSel = isSameDate(selectedDate, calendarViewYear, calendarViewMonth, day);
                      const isTdy = isTodayDate(calendarViewYear, calendarViewMonth, day);

                      return (
                        <TouchableOpacity
                          key={di}
                          style={[
                            styles.calendarDayCell,
                            isSel && styles.calendarDaySelected,
                            isTdy && !isSel && styles.calendarDayToday,
                          ]}
                          onPress={() => handleCalendarDateSelect(day)}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              isSel && styles.calendarDayTextSelected,
                              isTdy && !isSel && styles.calendarDayTextToday,
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // ─────── Loading State ───────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tarefas</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>OJ</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Carregando tarefas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────── Main Render ───────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topSection}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tarefas</Text>
            {filteredTasks.length > 0 && (
              <Text style={styles.taskCount}>
                {filteredTasks.filter((t) => !t.done).length} pendente
                {filteredTasks.filter((t) => !t.done).length !== 1 ? 's' : ''}
              </Text>
            )}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>OJ</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={17} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar tarefas..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {!hasNoTasksAtAll && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              keyboardShouldPersistTaps="handled"
            >
              {FILTERS.slice(0, 3).map((f) => {
                const isActive = activeFilter === f.key;
                let chipCount = 0;
                if (f.key === 'todas') chipCount = tasks.length;
                else if (f.key === 'hoje') chipCount = tasks.filter((t) => isToday(t.dueDate)).length;
                else if (f.key === 'importante') chipCount = tasks.filter((t) => t.priority === 'alta').length;

                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => {
                      setActiveFilter(f.key);
                      setExpandedTaskId(null);
                    }}
                  >
                    <Ionicons
                      name={isActive ? f.icon.replace('-outline', '') : f.icon}
                      size={14}
                      color={isActive ? '#FFFFFF' : Colors.textSecondary}
                    />
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                    {chipCount > 0 && (
                      <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                        <Text style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}>
                          {chipCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[
                  styles.filterChip,
                  (showTagFilter || activeTagFilters.length > 0) && styles.filterChipTagActive,
                ]}
                onPress={() => setShowTagFilter((v) => !v)}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={14}
                  color={activeTagFilters.length > 0 ? Colors.accent : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    activeTagFilters.length > 0 && { color: Colors.accent },
                  ]}
                >
                  {activeTagFilters.length > 0
                    ? `${activeTagFilters.length} tag${activeTagFilters.length > 1 ? 's' : ''}`
                    : 'Tags'}
                </Text>
                {activeTagFilters.length > 0 && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setActiveTagFilters([]);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={14} color={Colors.accent} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {FILTERS.slice(3).map((f) => {
                const isActive = activeFilter === f.key;
                const chipCount = tasks.filter((t) => t.done).length;

                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => {
                      setActiveFilter(f.key);
                      setExpandedTaskId(null);
                    }}
                  >
                    <Ionicons
                      name={isActive ? f.icon.replace('-outline', '') : f.icon}
                      size={14}
                      color={isActive ? '#FFFFFF' : Colors.textSecondary}
                    />
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {f.label}
                    </Text>
                    {chipCount > 0 && (
                      <View style={[styles.filterChipBadge, isActive && styles.filterChipBadgeActive]}>
                        <Text style={[styles.filterChipBadgeText, isActive && styles.filterChipBadgeTextActive]}>
                          {chipCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {filteredTasks.length === 0 ? (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: CONTENT_H }}
              keyboardShouldPersistTaps="handled"
            >
              {renderQuickAddBar()}
              <View style={{ height: Spacing.sm }} />
              {renderEmptyState()}
            </ScrollView>
          ) : (
            <FlatList
              data={filteredTasks}
              renderItem={renderTaskCard}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={closeOpenSwipeable}
              ListHeaderComponent={
                <>{renderQuickAddBar()}</>
              }
            />
          )}
        </KeyboardAvoidingView>

        {renderTagManager()}
        {renderPriorityPicker()}
        {renderDatePicker()}

        {showTagFilter && (
          <Modal visible transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setShowTagFilter(false)}>
              <Pressable style={styles.tagFilterPopover}>
                <Text style={styles.tagFilterTitle}>Filtrar por tags</Text>
                {customTaskTags.length === 0 ? (
                  <Text style={styles.tagFilterEmpty}>Nenhuma tag disponível.</Text>
                ) : (
                  <View style={styles.tagFilterList}>
                    {customTaskTags.map((tag) => {
                      const c = getTagColor(tag);
                      const active = activeTagFilters.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagFilterChip,
                            { borderColor: active ? c.text : Colors.border, backgroundColor: active ? c.bg : Colors.bgCard },
                          ]}
                          onPress={() => {
                            setActiveTagFilters((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                            );
                          }}
                        >
                          <Text style={[styles.tagFilterChipText, { color: active ? c.text : Colors.textSecondary }]}>
                            {tag}
                          </Text>
                          {active && <Ionicons name="checkmark" size={14} color={c.text} style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {activeTagFilters.length > 0 && (
                  <TouchableOpacity
                    style={styles.tagFilterClear}
                    onPress={() => setActiveTagFilters([])}
                  >
                    <Text style={styles.tagFilterClearText}>Limpar filtros</Text>
                  </TouchableOpacity>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  topSection: {
    backgroundColor: Colors.bg,
    zIndex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_H,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl,
    color: Colors.primary,
    flex: 1,
  },
  taskCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginRight: Spacing.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    marginHorizontal: CONTENT_H,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 44,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    paddingVertical: 0,
  },

  // Filters
  filterRow: {
    paddingHorizontal: CONTENT_H,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipTagActive: {
    borderColor: Colors.accent + '60',
    backgroundColor: Colors.accentLight,
  },
  filterChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  filterChipTextActive: { color: '#FFFFFF' },
  filterChipBadge: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterChipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  filterChipBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
  },
  filterChipBadgeTextActive: { color: '#FFFFFF' },

  // Quick Add
  quickAddWrapper: {
    paddingBottom: Spacing.sm,
  },
  quickAddContainer: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  quickAddContainerFocused: {
    borderColor: Colors.accent + '40',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAddIconWrap: {
    paddingLeft: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  quickAddInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: 0,
    paddingRight: Spacing.xs,
  },
  quickAddSubmit: {
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  quickAddCancel: {
    paddingRight: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  quickAddMeta: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    gap: 5,
  },
  metaBadgeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // List
  listContent: {
    paddingHorizontal: CONTENT_H,
    paddingTop: Spacing.sm,
    paddingBottom: 120,
  },

  // Task card
  taskCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskCardDone: { opacity: 0.55 },
  taskMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 21,
  },
  taskTextDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  taskMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm + 2,
  },
  taskMetaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.sm + 1,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 3,
  },
  taskMetaTagOverdue: {
    backgroundColor: Colors.dangerLight,
  },
  taskMetaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: Colors.textSecondary,
  },
  chevronBtn: {
    marginLeft: Spacing.sm,
    marginTop: 2,
    paddingLeft: Spacing.xs,
  },

  inlineEditInput: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    lineHeight: 21,
  },

  // Accordion
  accordion: {
    marginTop: Spacing.md + 2,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  subtaskProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  subtaskProgressBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  subtaskProgressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
  },
  subtaskProgressText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
  },

  subtaskList: {
    marginBottom: Spacing.sm,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm - 1,
    gap: Spacing.sm,
  },
  subtaskCheck: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskCheckDone: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  subtaskText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    lineHeight: 19,
  },
  subtaskTextDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },

  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  addSubtaskInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    paddingVertical: Spacing.xs - 1,
  },

  accordionActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  accordionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  accordionActionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Tag chips on cards
  tagChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  tagChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
  },
  tagChipAdd: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Swipe
  swipeDelete: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  swipeComplete: {
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  swipeCompleteUndo: { backgroundColor: Colors.warning },
  swipeActionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearFilterBtn: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm + 1,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  clearFilterBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    width: '88%',
    maxWidth: 380,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  pickerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  pickerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  pickerOptionActive: {
    backgroundColor: Colors.accentLight,
  },
  pickerOptionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  pickerOptionDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Date divider
  dateDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },

  // Tag manager
  tagEmpty: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  tagGrid: {
    gap: Spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tagToggleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  tagToggleText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
  },
  tagDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  tagAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tagAddInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 1,
  },
  tagAddBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tag filter popover
  tagFilterPopover: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '80%',
    maxWidth: 320,
    maxHeight: 400,
  },
  tagFilterTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  tagFilterEmpty: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  tagFilterList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tagFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  tagFilterChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
  },
  tagFilterClear: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  tagFilterClearText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.danger,
  },

  // Calendar trigger
  calendarTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    gap: Spacing.sm,
  },
  calendarTriggerText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  calendarTriggerTextActive: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: Colors.primary,
  },

  // Calendar
  calendarContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calendarMonthLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  calendarWeekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  calendarWeekDayText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
  },
  calendarWeek: {
    flexDirection: 'row',
  },
  calendarDayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  calendarDayText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  calendarDayToday: {
    backgroundColor: Colors.bg,
  },
  calendarDayTextToday: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: Colors.accent,
  },
  calendarDaySelected: {
    backgroundColor: Colors.accent,
  },
  calendarDayTextSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
