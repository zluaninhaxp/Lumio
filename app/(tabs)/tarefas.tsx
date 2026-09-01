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
import { daysUntil } from '../../src/utils/supplier';
import { FAB } from '../components/Calendar/FAB';
import { BottomSheet } from '../components/Calendar/BottomSheet';
import { TaskForm, type TaskFormData } from '../components/Tasks/TaskForm';
import { TaskDateSelector } from '../components/Tasks/TaskDateSelector';
import { TaskPeopleSelector } from '../components/Tasks/TaskPeopleSelector';
import { useAuth } from '../../src/hooks/useAuth';
import { UserAvatar } from '../components/account/UserAvatar';
import { AccountSheet } from '../components/account/AccountSheet';
import { ChatIndicator } from '../components/ChatIndicator';
import { BottomFade } from '../components/BottomFade';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { clearRelationDraft, getRelationDraft, saveRelationDraft, setPendingRelation } from '../../src/utils/relationDraft';

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
  const router = useRouter();
  const { returnToTasks, createdId, relation } = useLocalSearchParams<{
    returnToTasks?: string;
    createdId?: string;
    relation?: 'client' | 'supplier' | 'employee';
  }>();
  const { currentUser } = useAuth();
  const [accountVisible, setAccountVisible] = useState(false);
  const { tasks, addTask, updateTask, toggleTask, removeTask, taskTags, customTaskTags, addCustomTaskTag, removeCustomTaskTag, transactions, fornecedorItems, estoqueItems, pedidos, clienteItems, orcamentos, refreshOrcamentos, refreshContratos, employeeItems, commissions, activatedPlugins, entregas, atendimentos } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('todas');
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingTaskDraft, setPendingTaskDraft] = useState<TaskFormData | null>(() => getRelationDraft<TaskFormData>('task'));
  const [sheetVisible, setSheetVisible] = useState(false);
  const [priorityPicker, setPriorityPicker] = useState<{
    taskId?: string;
    current: Priority;
  } | null>(null);
  const [datePicker, setDatePicker] = useState<{
    taskId?: string;
    current: string | null;
    currentLabel: string | null;
  } | null>(null);
  const [tagManager, setTagManager] = useState<{ taskId: string; current: string[] } | null>(null);
  const [employeePicker, setEmployeePicker] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newSubtaskTexts, setNewSubtaskTexts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const allTaskTags = useMemo(
    () => [...new Set([...taskTags.map((tag) => tag.label), ...customTaskTags])],
    [taskTags, customTaskTags],
  );

  const supplierSuggestions = useMemo(() => transactions.flatMap((transaction) => {
    if (transaction.amount >= 0 || !transaction.supplierId || !transaction.supplierDueDate || transaction.supplierPaid) return [];
    const days = daysUntil(transaction.supplierDueDate);
    if (days < 0 || days > 2) return [];
    const supplier = fornecedorItems.find((item) => item.id === transaction.supplierId);
    if (!supplier || tasks.some((task) => task.description.includes(transaction.description) && !task.done)) return [];
    return [{ transaction, supplier, days }];
  }), [transactions, fornecedorItems, tasks]);

  const confirmSupplierSuggestion = useCallback((suggestion: (typeof supplierSuggestions)[number]) => {
    addTask({
      description: `Confirmar pagamento para ${suggestion.supplier.name}: ${suggestion.transaction.description}`,
      done: false,
      dueDate: suggestion.transaction.supplierDueDate ?? null,
      dueDateLabel: suggestion.days === 0 ? 'Hoje' : suggestion.days === 1 ? 'Amanhã' : undefined,
      priority: suggestion.days === 0 ? 'alta' : 'media',
      subtasks: [],
      tags: ['Fornecedor', 'Financeiro'],
      createdAt: new Date().toISOString(),
    });
  }, [addTask]);

  const stockSuggestions = useMemo(() => estoqueItems.filter((item) => item.quantity < item.minAlert && !tasks.some((task) => task.description.toLowerCase().includes(item.name.toLowerCase()) && !task.done)), [estoqueItems, tasks]);

  const confirmStockSuggestion = useCallback((item: (typeof stockSuggestions)[number]) => {
    addTask({ description: `Comprar ${item.name}`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Estoque'], createdAt: new Date().toISOString() });
  }, [addTask]);

  const orderFollowUpSuggestions = useMemo(() => pedidos.filter((order) => order.status === 'aberto' && (Date.now() - new Date(order.createdAt).getTime()) >= 3 * 24 * 60 * 60 * 1000 && !tasks.some((task) => task.description.includes(order.id) && !task.done)), [pedidos, tasks]);
  const confirmOrderFollowUp = useCallback((order: (typeof orderFollowUpSuggestions)[number]) => {
    const client = clienteItems.find((item) => item.id === order.clientId);
    addTask({ description: `Fazer follow-up do pedido ${order.id.slice(-6)}${client ? ` com ${client.name}` : ''}`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Clientes', 'Financeiro'], createdAt: new Date().toISOString() });
  }, [addTask, clienteItems]);

  const quoteFollowUpSuggestions = useMemo(() => orcamentos.filter((quote) => quote.status === 'pendente' && (Date.now() - new Date(quote.createdAt).getTime()) >= 3 * 24 * 60 * 60 * 1000 && !tasks.some((task) => task.description.includes(quote.id) && !task.done)), [orcamentos, tasks]);
  const confirmQuoteFollowUp = useCallback((quote: (typeof quoteFollowUpSuggestions)[number]) => {
    const client = clienteItems.find((item) => item.id === quote.clientId);
    addTask({ description: `Fazer follow-up do orçamento ${quote.id.slice(-6)}${client ? ` com ${client.name}` : ''}`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Clientes'], createdAt: new Date().toISOString() });
  }, [addTask, clienteItems]);

  const showCommissionSuggestion = useMemo(() => {
    if (!activatedPlugins.includes('comissoes')) return false;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const hasPending = commissions.some((c) => !c.paid && c.month !== currentMonth);
    if (!hasPending) return false;
    return !tasks.some((task) => /fechar\s+comiss/i.test(task.description) && !task.done);
  }, [activatedPlugins, commissions, tasks]);
  const confirmCommissionSuggestion = useCallback(() => {
    addTask({ description: 'Fechar comissões do mês anterior', done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Financeiro'], createdAt: new Date().toISOString() });
  }, [addTask]);

  const contractSuggestions = useMemo(() => transactions.flatMap((transaction) => {
    if (!transaction.contractId || transaction.amount <= 0 || transaction.confirmed !== false || !transaction.expectedDate) return [];
    const days = daysUntil(transaction.expectedDate);
    if (days > 0 || tasks.some((task) => task.description.includes(transaction.id) && !task.done)) return [];
    const client = clienteItems.find((item) => item.id === transaction.clientId);
    return [{ transaction, client, days }];
  }), [transactions, clienteItems, tasks]);
  const confirmContractSuggestion = useCallback((suggestion: (typeof contractSuggestions)[number]) => {
    addTask({ description: `Cobrar assinatura ${suggestion.client?.name ?? 'do cliente'} (${suggestion.transaction.id})`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: suggestion.days < 0 ? 'Em atraso' : 'Hoje', priority: 'alta', subtasks: [], tags: ['Clientes', 'Financeiro'], createdAt: new Date().toISOString() });
  }, [addTask]);

  const deliverySuggestions = useMemo(() => entregas.flatMap((delivery) => {
    if (delivery.status !== 'a caminho') return [];
    const days = daysUntil(delivery.estimatedDate);
    if (days < 0 || days > 2 || tasks.some((task) => task.description.includes(delivery.id) && !task.done)) return [];
    return [{ delivery, days }];
  }), [entregas, tasks]);
  const confirmDeliverySuggestion = useCallback((delivery: (typeof deliverySuggestions)[number]['delivery']) => {
    addTask({ description: `Acompanhar entrega ${delivery.id.slice(-6)} do pedido ${delivery.orderId.slice(-6)}`, done: false, dueDate: delivery.estimatedDate, dueDateLabel: 'Prazo próximo', priority: 'alta', subtasks: [], tags: ['Entregas'], createdAt: new Date().toISOString(), employeeId: delivery.employeeId });
  }, [addTask]);

  const appointmentSuggestions = useMemo(() => atendimentos.flatMap((appointment) => {
    if (appointment.status !== 'confirmado') return [];
    const days = daysUntil(appointment.date);
    if (days < 0 || days > 2 || tasks.some((task) => task.description.includes(appointment.id) && !task.done)) return [];
    return [{ appointment, days }];
  }), [atendimentos, tasks]);
  const confirmAppointmentSuggestion = useCallback((appointment: (typeof appointmentSuggestions)[number]['appointment']) => {
    const client = clienteItems.find((item) => item.id === appointment.clientId);
    addTask({ description: `Confirmar atendimento ${appointment.id.slice(-6)}${client ? ` com ${client.name}` : ''}`, done: false, dueDate: appointment.date, dueDateLabel: 'Próximo', priority: 'media', subtasks: [], tags: ['Clientes'], createdAt: new Date().toISOString() });
  }, [addTask, clienteItems]);

  useEffect(() => {
    refreshOrcamentos();
    refreshContratos();
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, [refreshOrcamentos, refreshContratos]);

  useEffect(() => {
    if (returnToTasks !== '1' || !createdId || !relation) return;
    const draft = setPendingRelation('task', relation, createdId);
    setPendingTaskDraft((draftState) => draft ? { ...draftState, ...draft } as TaskFormData : draftState);
    setSheetVisible(true);
    router.setParams({ returnToTasks: undefined, createdId: undefined, relation: undefined });
  }, [createdId, relation, returnToTasks, router]);

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
  const taskBeingAssigned = employeePicker ? tasks.find((task) => task.id === employeePicker) : null;

  const handleAddTask = useCallback((data: TaskFormData) => {
    addTask({
      description: data.description,
      done: false,
      dueDate: data.dueDate,
      dueDateLabel: data.dueDateLabel,
      priority: data.priority,
      subtasks: [],
      tags: data.tags,
      clientId: data.clientId,
      supplierId: data.supplierId,
      createdAt: new Date().toISOString(),
      employeeId: data.employeeId,
    });
    setSheetVisible(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [addTask]);

  const handleSaveTask = useCallback((data: TaskFormData) => {
    if (editingTask) {
      updateTask(editingTask.id, data);
      setEditingTask(null);
      clearRelationDraft('task');
      setPendingTaskDraft(null);
      setSheetVisible(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      return;
    }
    clearRelationDraft('task');
    setPendingTaskDraft(null);
    handleAddTask(data);
  }, [editingTask, handleAddTask, updateTask]);

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

  const handleStartEdit = useCallback((task: Task) => {
    closeOpenSwipeable();
    setEditingTask(task);
    setSheetVisible(true);
  }, []);

  const handleSetPriority = useCallback(
    (taskId: string | undefined, priority: Priority) => {
      if (taskId) {
        updateTask(taskId, { priority });
      }
      setPriorityPicker(null);
    },
    [updateTask],
  );

  const handleSetDueDate = useCallback(
    (taskId: string | undefined, dueDate: string | null, label?: string | null) => {
      if (taskId) {
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
    if (!name || allTaskTags.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    addCustomTaskTag(name);
    if (tagManager) {
      updateTask(tagManager.taskId, { tags: [...tagManager.current, name] });
      setTagManager((prev) => (prev ? { ...prev, current: [...prev.current, name] } : null));
    }
    setNewTagName('');
  }, [newTagName, allTaskTags, addCustomTaskTag, updateTask, tagManager]);

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
            Toque no botão + para criar sua primeira tarefa.
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

  const renderLeftActions = (task: Task) => (
    <TouchableOpacity
      style={styles.swipeComplete}
      onPress={() => handleStartEdit(task)}
    >
      <Ionicons name="create-outline" size={20} color="#FFFFFF" />
      <Text style={styles.swipeActionText}>Editar</Text>
    </TouchableOpacity>
  );

  // ─────── Task Card ───────
  const renderTaskCard = ({ item }: { item: Task }) => {
    const isExpanded = expandedTaskId === item.id;
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
         renderLeftActions={() => renderLeftActions(item)}
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
              <View style={styles.taskDescriptionRow}>
                {item.source === 'chat' && <ChatIndicator size={14} />}
                <Text
                  style={[styles.taskText, item.done && styles.taskTextDone]}
                  numberOfLines={isExpanded ? undefined : 2}
                >
                  {item.description}
                </Text>
              </View>

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
                    onPress={() => setDatePicker({ taskId: item.id, current: item.dueDate, currentLabel: item.dueDateLabel ?? null })}
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
                    onPress={() => setDatePicker({ taskId: item.id, current: item.dueDate, currentLabel: item.dueDateLabel ?? null })}
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

                <TouchableOpacity style={styles.taskMetaTag} onPress={() => setEmployeePicker(item.id)}>
                  <Ionicons name="person-outline" size={10} color={item.employeeId || item.clientId || item.supplierId ? Colors.accent : Colors.textSecondary} />
                  <Text style={[styles.taskMetaText, (item.employeeId || item.clientId || item.supplierId) && { color: Colors.accent }]} numberOfLines={1}>
                    {[
                      clienteItems.find((client) => client.id === item.clientId)?.name,
                      fornecedorItems.find((supplier) => supplier.id === item.supplierId)?.name,
                      employeeItems.find((employee) => employee.id === item.employeeId)?.name,
                    ].filter(Boolean).join(', ') || 'Atribuir'}
                  </Text>
                </TouchableOpacity>

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

          {allTaskTags.length === 0 && (
            <Text style={styles.tagEmpty}>Nenhuma tag criada ainda.</Text>
          )}

          <View style={styles.tagGrid}>
            {allTaskTags.map((tag) => {
              const c = getTagColor(tag);
              const active = tagManager?.current.includes(tag) ?? false;
              const canRemove = customTaskTags.includes(tag);
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
                  {canRemove && <TouchableOpacity
                      onPress={() => handleRemoveGlobalTag(tag)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>}
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
                  handleSetPriority(priorityPicker.taskId, p);
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
  const renderDatePicker = () => (
    <Modal
      visible={datePicker !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setDatePicker(null)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setDatePicker(null)}>
        <Pressable style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Data de vencimento</Text>
            <TouchableOpacity
              onPress={() => setDatePicker(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TaskDateSelector
            value={datePicker?.current ?? null}
            label={datePicker?.currentLabel ?? null}
            onChange={(value, label) => {
              if (datePicker) {
                handleSetDueDate(datePicker.taskId, value, label);
              }
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ─────── Loading State ───────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tarefas</Text>
          <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Carregando tarefas...</Text>
        </View>
        <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
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
            <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
          </View>

          {contractSuggestions.length > 0 && <View style={styles.orderSuggestion}><View style={styles.suggestionHeader}><Ionicons name="repeat-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Cobranças em atraso</Text></View>{contractSuggestions.map((suggestion) => <View key={suggestion.transaction.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>Assinatura {suggestion.client?.name ?? 'sem cliente'}</Text><Text style={styles.suggestionMeta}>{suggestion.days < 0 ? `Em atraso há ${Math.abs(suggestion.days)} dias` : 'Vence hoje'}</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmContractSuggestion(suggestion)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {appointmentSuggestions.length > 0 && <View style={styles.orderSuggestion}><View style={styles.suggestionHeader}><Ionicons name="time-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Atendimentos próximos</Text></View>{appointmentSuggestions.map(({ appointment, days }) => <View key={appointment.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>{appointment.service} às {appointment.time}</Text><Text style={styles.suggestionMeta}>{days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`} · confirmar cliente</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmAppointmentSuggestion(appointment)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {deliverySuggestions.length > 0 && <View style={styles.orderSuggestion}><View style={styles.suggestionHeader}><Ionicons name="bicycle-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Entregas perto do prazo</Text></View>{deliverySuggestions.map(({ delivery, days }) => <View key={delivery.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>Pedido {delivery.orderId.slice(-6)} precisa de acompanhamento</Text><Text style={styles.suggestionMeta}>{days === 0 ? 'Prazo hoje' : days === 1 ? 'Prazo amanhã' : `Prazo em ${days} dias`}</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmDeliverySuggestion(delivery)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {supplierSuggestions.length > 0 && <View style={styles.supplierSuggestion}><View style={styles.suggestionHeader}><Ionicons name="alert-circle-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Pagamentos próximos</Text></View>{supplierSuggestions.map((suggestion) => <View key={suggestion.transaction.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>{suggestion.supplier.name}: {suggestion.transaction.description}</Text><Text style={styles.suggestionMeta}>{suggestion.days === 0 ? 'Vence hoje' : suggestion.days === 1 ? 'Vence amanhã' : `Vence em ${suggestion.days} dias`}</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmSupplierSuggestion(suggestion)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {stockSuggestions.length > 0 && <View style={styles.stockSuggestion}><View style={styles.suggestionHeader}><Ionicons name="cube-outline" size={18} color={Colors.danger} /><Text style={styles.suggestionTitle}>Estoque baixo</Text></View>{stockSuggestions.map((item) => <View key={item.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>{item.name}: {item.quantity} {item.unit} (mínimo {item.minAlert})</Text><Text style={styles.suggestionMeta}>Sugestão com a tag Estoque</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmStockSuggestion(item)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {orderFollowUpSuggestions.length > 0 && <View style={styles.orderSuggestion}><View style={styles.suggestionHeader}><Ionicons name="chatbox-ellipses-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Pedidos sem conclusão</Text></View>{orderFollowUpSuggestions.map((order) => <View key={order.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>Pedido {order.id.slice(-6)} está aberto há mais de 3 dias</Text><Text style={styles.suggestionMeta}>Sugestão de follow-up</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmOrderFollowUp(order)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {quoteFollowUpSuggestions.length > 0 && <View style={styles.quoteSuggestion}><View style={styles.suggestionHeader}><Ionicons name="document-text-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Orçamentos sem resposta</Text></View>{quoteFollowUpSuggestions.map((quote) => <View key={quote.id} style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>Orçamento {quote.id.slice(-6)} está pendente há mais de 3 dias</Text><Text style={styles.suggestionMeta}>Sugestão de follow-up</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={() => confirmQuoteFollowUp(quote)}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View>)}</View>}
          {showCommissionSuggestion && <View style={styles.orderSuggestion}><View style={styles.suggestionHeader}><Ionicons name="cash-outline" size={18} color={Colors.warning} /><Text style={styles.suggestionTitle}>Comissões pendentes</Text></View><View style={styles.suggestionRow}><View style={styles.suggestionBody}><Text style={styles.suggestionText}>Há comissões de meses anteriores sem pagamento confirmado</Text><Text style={styles.suggestionMeta}>Feche o mês no módulo Comissões</Text></View><TouchableOpacity style={styles.suggestionButton} onPress={confirmCommissionSuggestion}><Text style={styles.suggestionButtonText}>Criar tarefa</Text></TouchableOpacity></View></View>}

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
            />
          )}

          <BottomFade />

          <FAB onPress={() => setSheetVisible(true)} />

          <BottomSheet visible={sheetVisible} onClose={() => { clearRelationDraft('task'); setPendingTaskDraft(null); setSheetVisible(false); }} height={620}>
            <TaskForm
              key={editingTask?.id ?? (pendingTaskDraft ? `task-draft-${pendingTaskDraft.clientId ?? ''}-${pendingTaskDraft.supplierId ?? ''}-${pendingTaskDraft.employeeId ?? ''}` : 'new-task')}
              initialData={editingTask ?? pendingTaskDraft ?? undefined}
              onSave={handleSaveTask}
              onCancel={() => {
                setEditingTask(null);
                clearRelationDraft('task');
                setPendingTaskDraft(null);
                setSheetVisible(false);
              }}
              onBeforeNavigate={(relation, data) => {
                saveRelationDraft('task', data);
                setPendingTaskDraft(data);
                setEditingTask(null);
                setSheetVisible(false);
                setTimeout(() => {
                  const pluginId = relation === 'client' ? 'clientes' : relation === 'supplier' ? 'fornecedores' : 'equipe';
                  const route = useAppStore.getState().activatedPlugins.includes(pluginId)
                    ? ({ clientes: '/plugins/clientes', fornecedores: '/plugins/fornecedores', equipe: '/plugins/equipe' } as const)[pluginId]
                    : `/plugins/store?highlight=${pluginId}`;
                  router.push(`${route}${route.includes('?') ? '&' : '?'}returnToTasks=1&relation=${relation}` as any);
                }, 240);
              }}
            />
          </BottomSheet>
        </KeyboardAvoidingView>

        {renderTagManager()}
        {renderPriorityPicker()}
        {renderDatePicker()}

        <Modal visible={employeePicker !== null} transparent animationType="fade" onRequestClose={() => setEmployeePicker(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEmployeePicker(null)}>
            <Pressable style={styles.pickerCard}>
              <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>Atribuir tarefa</Text><TouchableOpacity onPress={() => setEmployeePicker(null)}><Ionicons name="close" size={22} color={Colors.textMuted} /></TouchableOpacity></View>
              {taskBeingAssigned && (
                <TaskPeopleSelector
                  clientId={taskBeingAssigned.clientId}
                  supplierId={taskBeingAssigned.supplierId}
                  employeeId={taskBeingAssigned.employeeId}
                  onChange={(relation, id) => updateTask(taskBeingAssigned.id, { [`${relation}Id`]: id })}
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {showTagFilter && (
          <Modal visible transparent animationType="fade">
            <Pressable style={styles.modalOverlay} onPress={() => setShowTagFilter(false)}>
              <Pressable style={styles.tagFilterPopover}>
                <Text style={styles.tagFilterTitle}>Filtrar por tags</Text>
                {allTaskTags.length === 0 ? (
                  <Text style={styles.tagFilterEmpty}>Nenhuma tag disponível.</Text>
                ) : (
                  <View style={styles.tagFilterList}>
                    {allTaskTags.map((tag) => {
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

        <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
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
  supplierSuggestion: {
    marginHorizontal: CONTENT_H,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#FFF8E7',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F5D98A',
  },
  stockSuggestion: {
    marginHorizontal: CONTENT_H,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F2B8B8',
  },
  orderSuggestion: {
    marginHorizontal: CONTENT_H,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#FFF8E7',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F5D98A',
  },
  quoteSuggestion: {
    marginHorizontal: CONTENT_H,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#FFF8E7',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F5D98A',
  },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  suggestionTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', color: Colors.primary, fontSize: FontSize.sm },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  suggestionBody: { flex: 1 },
  suggestionText: { fontFamily: 'PlusJakartaSans_500Medium', color: Colors.primary, fontSize: FontSize.xs },
  suggestionMeta: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 2 },
  suggestionButton: { backgroundColor: Colors.accent, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  suggestionButtonText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs },

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
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
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
  taskDescriptionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
    backgroundColor: Colors.warning,
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
});
