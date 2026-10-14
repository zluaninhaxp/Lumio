import { ModuleSuggestions, type ModuleSuggestion } from '../components/Tasks/ModuleSuggestions';
import { useDismissedTaskSuggestions } from '../../src/hooks/use-dismissed-task-suggestions';
import { useSystemReducedMotion } from '../../src/hooks/use-system-reduced-motion';
import { HorizontalOptions } from '../../src/components/horizontal-options';
import { FeedbackEmptyState } from '../../src/components/empty-state';
import { ModalKeyboardViewport } from '../../src/components/modal-keyboard-viewport';
import { ModalScrollView } from '../../src/components/modal-scroll-view';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Modal, LayoutAnimation, Platform, UIManager, ActivityIndicator,
  Pressable, ScrollView, KeyboardAvoidingView, Keyboard,
  type NativeMethods,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, CategoryColors, Colors, Spacing, Radius, FontSize, SurfaceStyles } from '../../src/constants/theme';
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
import { AppAlert } from "@/src/services/appAlert";
import { useConfirmedSave } from "../../src/hooks/use-confirmed-save";
import { confirmAction } from "../../src/services/confirmedAction";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Task = ReturnType<typeof useAppStore.getState>['tasks'][number];
type Subtask = Task['subtasks'][number];
type Priority = 'alta' | 'media' | 'baixa';
type FilterKey = 'todas' | 'hoje' | 'importante' | 'concluidas';

const PRIORITY_CONFIG = {
  alta: { label: 'Alta', color: Colors.dangerText, tint: Colors.danger + '18', icon: 'flag' as const },
  media: { label: 'Média', color: Colors.warningText, tint: Colors.warning + '18', icon: 'flash' as const },
  baixa: { label: 'Baixa', color: Colors.accentText, tint: Colors.accent + '18', icon: 'arrow-down' as const },
} as const;

const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

const FILTERS: { key: FilterKey; label: string; icon: any }[] = [
  { key: 'todas', label: 'Todas', icon: 'list-outline' },
  { key: 'hoje', label: 'Hoje', icon: 'today-outline' },
  { key: 'importante', label: 'Importante', icon: 'flag-outline' },
  { key: 'concluidas', label: 'Concluídas', icon: 'checkmark-done-outline' },
];

const TAG_COLORS = [
  CategoryColors.blue,
  CategoryColors.amber,
  CategoryColors.pink,
  CategoryColors.green,
  CategoryColors.purple,
  CategoryColors.orange,
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

function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)));
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
  const { dismissedIds, dismiss: dismissSuggestion, ready: suggestionsReady } = useDismissedTaskSuggestions(currentUser?.id);
  const reducedMotion = useSystemReducedMotion();
  const taskListRef = useRef<FlatList<Task>>(null);
  const emptyListRef = useRef<ScrollView>(null);
  const suggestionsHeight = useRef(0);
  const contentHeight = useRef(0);
  const anchorRequested = useRef(false);
  const suggestionsAnchorRef = useRef<View>(null);
  const scrollOffset = useRef(0);
  const anchorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (anchorTimer.current) clearTimeout(anchorTimer.current); }, []);
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

  const confirmSupplierSuggestion = useCallback((suggestion: (typeof supplierSuggestions)[number]) => { void confirmAction("tarefas.tsx:confirmSupplierSuggestion:193", () => {
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
  return () => {  };
  }); }, [addTask]);

  const stockSuggestions = useMemo(() => estoqueItems.filter((item) => item.quantity < item.minAlert && !tasks.some((task) => task.description.toLowerCase().includes(item.name.toLowerCase()) && !task.done)), [estoqueItems, tasks]);

  const confirmStockSuggestion = useCallback((item: (typeof stockSuggestions)[number]) => { void confirmAction("tarefas.tsx:confirmStockSuggestion:208", () => {
  addTask({ description: `Comprar ${item.name}`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Estoque'], createdAt: new Date().toISOString() });
  return () => {  };
  }); }, [addTask]);

  const orderFollowUpSuggestions = useMemo(() => pedidos.filter((order) => order.status === 'aberto' && (Date.now() - new Date(order.createdAt).getTime()) >= 3 * 24 * 60 * 60 * 1000 && !tasks.some((task) => task.description.includes(order.id) && !task.done)), [pedidos, tasks]);
  const confirmOrderFollowUp = useCallback((order: (typeof orderFollowUpSuggestions)[number]) => { void confirmAction("tarefas.tsx:confirmOrderFollowUp:213", () => {
  const client = clienteItems.find((item) => item.id === order.clientId);
  addTask({ description: `Fazer follow-up do pedido ${order.id.slice(-6)}${client ? ` com ${client.name}` : ''}`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Clientes', 'Financeiro'], createdAt: new Date().toISOString() });
  return () => {  };
  }); }, [addTask, clienteItems]);

  const quoteFollowUpSuggestions = useMemo(() => orcamentos.filter((quote) => quote.status === 'pendente' && (Date.now() - new Date(quote.createdAt).getTime()) >= 3 * 24 * 60 * 60 * 1000 && !tasks.some((task) => task.description.includes(quote.id) && !task.done)), [orcamentos, tasks]);
  const confirmQuoteFollowUp = useCallback((quote: (typeof quoteFollowUpSuggestions)[number]) => { void confirmAction("tarefas.tsx:confirmQuoteFollowUp:219", () => {
  const client = clienteItems.find((item) => item.id === quote.clientId);
  addTask({ description: `Fazer follow-up do orçamento ${quote.id.slice(-6)}${client ? ` com ${client.name}` : ''}`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Clientes'], createdAt: new Date().toISOString() });
  return () => {  };
  }); }, [addTask, clienteItems]);

  const showCommissionSuggestion = useMemo(() => {
    if (!activatedPlugins.includes('comissoes')) return false;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const hasPending = commissions.some((c) => !c.paid && c.month !== currentMonth);
    if (!hasPending) return false;
    return !tasks.some((task) => /fechar\s+comiss/i.test(task.description) && !task.done);
  }, [activatedPlugins, commissions, tasks]);
  const confirmCommissionSuggestion = useCallback(() => { void confirmAction("tarefas.tsx:confirmCommissionSuggestion:232", () => {
  addTask({ description: 'Fechar comissões do mês anterior', done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: 'Hoje', priority: 'media', subtasks: [], tags: ['Financeiro'], createdAt: new Date().toISOString() });
  return () => {  };
  }); }, [addTask]);

  const contractSuggestions = useMemo(() => transactions.flatMap((transaction) => {
    if (!transaction.contractId || transaction.amount <= 0 || transaction.confirmed !== false || !transaction.expectedDate) return [];
    const days = daysUntil(transaction.expectedDate);
    if (days > 0 || tasks.some((task) => task.description.includes(transaction.id) && !task.done)) return [];
    const client = clienteItems.find((item) => item.id === transaction.clientId);
    return [{ transaction, client, days }];
  }), [transactions, clienteItems, tasks]);
  const confirmContractSuggestion = useCallback((suggestion: (typeof contractSuggestions)[number]) => { void confirmAction("tarefas.tsx:confirmContractSuggestion:243", () => {
  addTask({ description: `Cobrar assinatura ${suggestion.client?.name ?? 'do cliente'} (${suggestion.transaction.id})`, done: false, dueDate: new Date().toISOString().split('T')[0], dueDateLabel: suggestion.days < 0 ? 'Em atraso' : 'Hoje', priority: 'alta', subtasks: [], tags: ['Clientes', 'Financeiro'], createdAt: new Date().toISOString() });
  return () => {  };
  }); }, [addTask]);

  const pendingCommissionMonths = new Set(
    commissions
      .filter(item => !item.paid && item.month < new Date().toISOString().slice(0, 7))
      .map(item => item.month),
  ).size;

  const deliverySuggestions = useMemo(() => entregas.flatMap((delivery) => {
    if (delivery.status !== 'a caminho') return [];
    const days = daysUntil(delivery.estimatedDate);
    if (days < 0 || days > 2 || tasks.some((task) => task.description.includes(delivery.id) && !task.done)) return [];
    return [{ delivery, days }];
  }), [entregas, tasks]);
  const confirmDeliverySuggestion = useCallback((delivery: (typeof deliverySuggestions)[number]['delivery']) => { void confirmAction("tarefas.tsx:confirmDeliverySuggestion:259", () => {
  addTask({ description: `Acompanhar entrega ${delivery.id.slice(-6)} do pedido ${delivery.orderId.slice(-6)}`, done: false, dueDate: delivery.estimatedDate, dueDateLabel: 'Prazo próximo', priority: 'alta', subtasks: [], tags: ['Entregas'], createdAt: new Date().toISOString(), employeeId: delivery.employeeId });
  return () => {  };
  }); }, [addTask]);

  const appointmentSuggestions = useMemo(() => atendimentos.flatMap((appointment) => {
    if (appointment.status !== 'confirmado') return [];
    const days = daysUntil(appointment.date);
    if (days < 0 || days > 2 || tasks.some((task) => task.description.includes(appointment.id) && !task.done)) return [];
    return [{ appointment, days }];
  }), [atendimentos, tasks]);
  const confirmAppointmentSuggestion = useCallback((appointment: (typeof appointmentSuggestions)[number]['appointment']) => { void confirmAction("tarefas.tsx:confirmAppointmentSuggestion:269", () => {
  const client = clienteItems.find((item) => item.id === appointment.clientId);
  addTask({ description: `Confirmar atendimento ${appointment.id.slice(-6)}${client ? ` com ${client.name}` : ''}`, done: false, dueDate: appointment.date, dueDateLabel: 'Próximo', priority: 'media', subtasks: [], tags: ['Clientes'], createdAt: new Date().toISOString() });
  return () => {  };
  }); }, [addTask, clienteItems]);

  // Keep the existing eligibility rules and creation callbacks; adapt only presentation.
  const moduleSuggestions = useMemo<ModuleSuggestion[]>(() => [
    ...contractSuggestions.map(suggestion => ({
      id: `contract:${suggestion.transaction.id}:${suggestion.transaction.expectedDate}`,
      icon: 'repeat-outline' as const, label: suggestion.days < 0 ? 'Cobrança atrasada' : 'Cobrança hoje',
      title: suggestion.client?.name ?? `Assinatura #${suggestion.transaction.contractId?.slice(-6)}`,
      description: suggestion.days < 0 ? `Em atraso há ${Math.abs(suggestion.days)} dias` : 'Vence hoje',
      tone: 'warning' as const, onCreate: () => confirmContractSuggestion(suggestion),
    })),
    ...appointmentSuggestions.map(({ appointment, days }) => ({
      id: `appointment:${appointment.id}:${appointment.date}:${appointment.time}`,
      icon: 'calendar-outline' as const, label: 'Atendimento próximo', title: appointment.service,
      description: `${days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : 'Em ' + days + ' dias'} às ${appointment.time}`,
      tone: 'neutral' as const, onCreate: () => confirmAppointmentSuggestion(appointment),
    })),
    ...deliverySuggestions.map(({ delivery, days }) => ({
      id: `delivery:${delivery.id}:${delivery.estimatedDate}`,
      icon: 'bicycle-outline' as const, label: 'Entrega perto do prazo', title: `Pedido #${delivery.orderId.slice(-6)}`,
      description: days === 0 ? 'Prazo hoje' : days === 1 ? 'Prazo amanhã' : `Prazo em ${days} dias`,
      tone: 'warning' as const, onCreate: () => confirmDeliverySuggestion(delivery),
    })),
    ...supplierSuggestions.map(suggestion => ({
      id: `supplier:${suggestion.transaction.id}:${suggestion.transaction.supplierDueDate}`,
      icon: 'briefcase-outline' as const, label: 'Pagamento próximo', title: suggestion.supplier.name,
      description: suggestion.days === 0 ? 'Vence hoje' : suggestion.days === 1 ? 'Vence amanhã' : `Vence em ${suggestion.days} dias`,
      tone: 'warning' as const, onCreate: () => confirmSupplierSuggestion(suggestion),
    })),
    ...stockSuggestions.map(item => ({
      id: `stock:${item.id}:${item.quantity}:${item.minAlert}`,
      icon: 'cube-outline' as const, label: 'Estoque baixo', title: item.name,
      description: `${item.quantity} unidades (mínimo ${item.minAlert})`,
      tone: 'danger' as const, onCreate: () => confirmStockSuggestion(item),
    })),
    ...orderFollowUpSuggestions.map(order => ({
      id: `order:${order.id}:${order.createdAt}`,
      icon: 'receipt-outline' as const, label: 'Pedido sem conclusão',
      title: `Pedido #${order.id.slice(-6)} · ${clienteItems.find(client => client.id === order.clientId)?.name ?? 'Cliente não informado'}`,
      description: `Aberto há ${daysSince(order.createdAt)} dias`,
      tone: 'warning' as const, onCreate: () => confirmOrderFollowUp(order),
    })),
    ...quoteFollowUpSuggestions.map(quote => ({
      id: `quote:${quote.id}:${quote.createdAt}`,
      icon: 'document-text-outline' as const, label: 'Orçamento sem resposta',
      title: `Orçamento #${quote.id.slice(-6)} · ${clienteItems.find(client => client.id === quote.clientId)?.name ?? 'Cliente não informado'}`,
      description: `Sem resposta há ${daysSince(quote.createdAt)} dias`,
      tone: 'warning' as const, onCreate: () => confirmQuoteFollowUp(quote),
    })),
    ...(showCommissionSuggestion ? [{
      id: `commissions:${commissions.filter(item => !item.paid).map(item => item.id + ':' + item.month).sort().join(',')}`,
      icon: 'cash-outline' as const, label: 'Comissões pendentes', title: 'Fechamento de comissões',
      description: `${pendingCommissionMonths} ${pendingCommissionMonths === 1 ? 'mês pendente' : 'meses pendentes'}`,
      tone: 'warning' as const, onCreate: confirmCommissionSuggestion,
    }] : []),
  ], [contractSuggestions, appointmentSuggestions, deliverySuggestions, supplierSuggestions, stockSuggestions, orderFollowUpSuggestions, quoteFollowUpSuggestions, showCommissionSuggestion, commissions, clienteItems, confirmContractSuggestion, confirmAppointmentSuggestion, confirmDeliverySuggestion, confirmSupplierSuggestion, confirmStockSuggestion, confirmOrderFollowUp, confirmQuoteFollowUp, confirmCommissionSuggestion]);
  const visibleSuggestions = suggestionsReady ? moduleSuggestions.filter(item => !dismissedIds.has(item.id)) : [];
  const hasModuleSuggestions = visibleSuggestions.length > 0;

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
  useEffect(() => { anchorRequested.current = false; }, [activeFilter, activeTagFilters, searchQuery]);
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
  }, [addTask]);

  const taskSave = useConfirmedSave();
    const handleSaveTask = useCallback((data: TaskFormData) => {
       return taskSave.run(() => {
       if (editingTask) updateTask(editingTask.id, data);
       else handleAddTask(data);
       return () => { setEditingTask(null); clearRelationDraft('task'); setPendingTaskDraft(null); setSheetVisible(false); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); };
       });
      }, [editingTask, handleAddTask, updateTask]);

  const handleToggle = useCallback(
    (id: string) => { void confirmAction("tarefas.tsx:handleToggle:409" + ':' + id, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      toggleTask(id);
      return () => {  };
      }); },
    [toggleTask],
  );

  const handleDelete = useCallback(
    (id: string) => { void confirmAction("tarefas.tsx:handleDelete:417" + ':' + id, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeTask(id);
      if (expandedTaskId === id) setExpandedTaskId(null);
      return () => {  };
      }); },
    [removeTask, expandedTaskId],
  );

  const handleStartEdit = useCallback((task: Task) => {
    closeOpenSwipeable();
    setEditingTask(task);
    setSheetVisible(true);
  }, []);

  const handleSetPriority = useCallback(
    (taskId: string | undefined, priority: Priority) => { void confirmAction("tarefas.tsx:handleSetPriority:432" + ':' + taskId, () => {
      if (taskId) {
              updateTask(taskId, { priority });
            }
      return () => { setPriorityPicker(null); };
      }); },
    [updateTask],
  );

  const handleSetDueDate = useCallback(
    (taskId: string | undefined, dueDate: string | null, label?: string | null) => { void confirmAction("tarefas.tsx:handleSetDueDate:442" + ':' + taskId, () => {
      if (taskId) {
              updateTask(taskId, { dueDate, dueDateLabel: label ?? null });
            }
      return () => { setDatePicker(null); };
      }); },
    [updateTask],
  );

  const getFreshSubtasks = useCallback((taskId: string): Subtask[] => {
    const task = useAppStore.getState().tasks.find((t) => t.id === taskId);
    return task?.subtasks ?? [];
  }, []);

  const handleToggleSubtask = useCallback(
    (taskId: string, subtaskId: string) => { void confirmAction("tarefas.tsx:handleToggleSubtask:457" + ':' + taskId, () => {
      const subtasks = getFreshSubtasks(taskId);
      const updated = subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
      updateTask(taskId, { subtasks: updated });
      return () => {  };
      }); },
    [updateTask, getFreshSubtasks],
  );

  const handleRemoveSubtask = useCallback(
    (taskId: string, subtaskId: string) => { void confirmAction("tarefas.tsx:handleRemoveSubtask:466" + ':' + taskId, () => {
      const subtasks = getFreshSubtasks(taskId);
      updateTask(taskId, { subtasks: subtasks.filter((s) => s.id !== subtaskId) });
      return () => {  };
      }); },
    [updateTask, getFreshSubtasks],
  );

  const handleAddSubtask = useCallback(
    (taskId: string) => { void confirmAction("tarefas.tsx:handleAddSubtask:474" + ':' + taskId, () => {
      const text = (newSubtaskTexts[taskId] ?? '').trim();
      if (!text) return;
      const subtasks = getFreshSubtasks(taskId);
      const newSub: Subtask = { id: Date.now().toString(), text, done: false };
      updateTask(taskId, { subtasks: [...subtasks, newSub] });
      return () => { setNewSubtaskTexts((prev) => {
              const copy = { ...prev };
              delete copy[taskId];
              return copy;
            }); };
      }); },
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
    (taskId: string, tag: string) => { void confirmAction("tarefas.tsx:handleToggleTag:505" + ':' + taskId, () => {
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
      return () => {  };
      }); },
    [updateTask],
  );

  const handleCreateTag = useCallback(() => { void confirmAction("tarefas.tsx:handleCreateTag:523" + ':' + String(name), () => {
  const name = newTagName.trim();
  if (!name || allTaskTags.some((tag) => tag.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
  addCustomTaskTag(name);
  if (tagManager) {
        updateTask(tagManager.taskId, { tags: [...tagManager.current, name] });
        setTagManager((prev) => (prev ? { ...prev, current: [...prev.current, name] } : null));
      }
  return () => { setNewTagName(''); };
  }); }, [newTagName, allTaskTags, addCustomTaskTag, updateTask, tagManager]);

  const handleRemoveGlobalTag = useCallback(
    (tag: string) => { void confirmAction("tarefas.tsx:handleRemoveGlobalTag:535" + ':' + String(tag), () => {
      removeCustomTaskTag(tag);
      if (tagManager) {
              setTagManager((prev) =>
                prev ? { ...prev, current: prev.current.filter((t) => t !== tag) } : null,
              );
            }
      return () => {  };
      }); },
    [removeCustomTaskTag, tagManager],
  );

  // ─────── Empty State ───────
  const renderEmptyState = () => (
    <FeedbackEmptyState
      variant={hasNoTasksAtAll && !searchQuery ? 'spacious' : 'compact'}
      icon={hasNoTasksAtAll && !searchQuery ? 'checkbox-outline' : 'search-outline'}
      title={hasNoTasksAtAll && !searchQuery ? 'Nenhuma tarefa ainda' : 'Nenhum resultado'}
      description={hasNoTasksAtAll && !searchQuery ? 'Toque no botão + para criar sua primeira tarefa.' :
        searchQuery ? `Nenhuma tarefa encontrada para "${searchQuery}".` : 'Nenhuma tarefa corresponde ao filtro selecionado.'}>
      {!(hasNoTasksAtAll && !searchQuery) && <>
        {(searchQuery || activeFilter !== 'todas') && (
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              style={styles.clearFilterBtn}
              onPress={() => {
                setSearchQuery('');
                setActiveFilter('todas');
              }}
            >
              <Text style={styles.clearFilterBtnText}>Limpar filtros</Text>
            </TouchableOpacity>
          )}
      </>}
    </FeedbackEmptyState>
  );

  // ─────── Swipe Actions ───────
  const renderRightActions = (taskId: string) => (
    <TouchableOpacity activeOpacity={ControlOpacity.pressed}
      style={styles.swipeDelete}
      onPress={() => { closeOpenSwipeable(); handleDelete(taskId); }}
    >
      <Ionicons name="trash-outline" size={20} color={Colors.onAction} />
      <Text style={styles.swipeActionText}>Excluir</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (task: Task) => (
    <TouchableOpacity activeOpacity={ControlOpacity.pressed}
      style={styles.swipeComplete}
      onPress={() => handleStartEdit(task)}
    >
      <Ionicons name="create-outline" size={20} color={Colors.onAction} />
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
        containerStyle={SurfaceStyles.swipeContainer}
        childrenContainerStyle={SurfaceStyles.swipeContainer}
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
          activeOpacity={ControlOpacity.pressed}
          onLongPress={() => {
            AppAlert.alert('Excluir tarefa', `"${item.description}" será removida.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Excluir', style: 'destructive', onPress: () => handleDelete(item.id) },
            ]);
          }}
        >
          <View style={styles.taskMainRow}>
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              style={[styles.checkbox, item.done && styles.checkboxDone]}
              onPress={() => handleToggle(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {item.done && <Ionicons name="checkmark" size={13} color={Colors.onAction} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.taskBody}
              activeOpacity={ControlOpacity.pressed}
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
                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
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
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                    style={[styles.taskMetaTag, isOverdue && styles.taskMetaTagOverdue]}
                    onPress={() => setDatePicker({ taskId: item.id, current: item.dueDate, currentLabel: item.dueDateLabel ?? null })}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={10}
                      color={isOverdue ? Colors.dangerIcon : Colors.textSecondary}
                    />
                    <Text style={[styles.taskMetaText, { color: isOverdue ? Colors.dangerText : Colors.textSecondary }]}>
                      {formatTaskDate(item)}
                    </Text>
                  </TouchableOpacity>
                )}

                {!item.dueDate && (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
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
                    <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                      key={tag}
                      style={[styles.tagChip, { backgroundColor: c.bg }]}
                      onPress={() => setTagManager({ taskId: item.id, current: item.tags })}
                    >
                      <Text style={[styles.tagChipText, { color: c.text }]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.taskMetaTag} onPress={() => setEmployeePicker(item.id)}>
                  <Ionicons name="person-outline" size={10} color={item.employeeId || item.clientId || item.supplierId ? Colors.accentIcon : Colors.textSecondary} />
                  <Text style={[styles.taskMetaText, (item.employeeId || item.clientId || item.supplierId) && { color: Colors.accentText }]} numberOfLines={1}>
                    {[
                      clienteItems.find((client) => client.id === item.clientId)?.name,
                      fornecedorItems.find((supplier) => supplier.id === item.supplierId)?.name,
                      employeeItems.find((employee) => employee.id === item.employeeId)?.name,
                    ].filter(Boolean).join(', ') || 'Atribuir'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                  style={styles.tagChipAdd}
                  onPress={() => setTagManager({ taskId: item.id, current: item.tags })}
                >
                  <Ionicons name="add" size={12} color={Colors.iconMuted} />
                </TouchableOpacity>

                {progress.total > 0 && (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                    style={styles.taskMetaTag}
                    onPress={() => handleToggleExpand(item.id)}
                  >
                    <Ionicons name="list-outline" size={10} color={Colors.textSecondary} />
                    <Text style={styles.taskMetaText}>{progress.done}/{progress.total}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              onPress={() => handleToggleExpand(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.chevronBtn}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.iconMuted}
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
                      <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                        style={[styles.subtaskCheck, sub.done && styles.subtaskCheckDone]}
                        onPress={() => handleToggleSubtask(item.id, sub.id)}
                      >
                        {sub.done && <Ionicons name="checkmark" size={10} color={Colors.onAction} />}
                      </TouchableOpacity>
                      <Text style={[styles.subtaskText, sub.done && styles.subtaskTextDone]} numberOfLines={2}>
                        {sub.text}
                      </Text>
                      <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                        onPress={() => handleRemoveSubtask(item.id, sub.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={14} color={Colors.iconMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.addSubtaskRow}>
                <Ionicons name="add" size={15} color={Colors.iconMuted} style={{ marginRight: Spacing.sm }} />
                <TextInput
                  style={styles.addSubtaskInput}
                  placeholder="Adicionar subtarefa..."
                  placeholderTextColor={Colors.placeholder}
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
      <ModalKeyboardViewport>
        <Pressable style={styles.modalOverlay} onPress={() => setTagManager(null)}>
          <Pressable style={[styles.pickerCard, { maxHeight: '100%', flexShrink: 1 }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Tags</Text>
              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                onPress={() => setTagManager(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.iconMuted} />
              </TouchableOpacity>
            </View>

            <ModalScrollView style={{ flexShrink: 1 }}>
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
                      <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                        style={[
                          styles.tagToggleChip,
                          { borderColor: active ? c.text : SurfaceStyles.filter.borderColor, backgroundColor: active ? c.bg : 'transparent' },
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
                      {canRemove && <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                          onPress={() => handleRemoveGlobalTag(tag)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close-circle-outline" size={18} color={Colors.iconMuted} />
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
                  placeholderTextColor={Colors.placeholder}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  onSubmitEditing={handleCreateTag}
                  returnKeyType="done"
                />
                <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.tagAddBtn} onPress={handleCreateTag}>
                  <Ionicons name="add" size={18} color={Colors.onAction} />
                </TouchableOpacity>
              </View>
            </ModalScrollView>
          </Pressable>
        </Pressable>
      </ModalKeyboardViewport>
    </Modal>
  );

  // ─────── Priority Picker Modal ───────
  const renderPriorityPicker = () => (
    <Modal visible={priorityPicker !== null} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={() => setPriorityPicker(null)}>
        <Pressable style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Prioridade</Text>
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              onPress={() => setPriorityPicker(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.iconMuted} />
            </TouchableOpacity>
          </View>
          {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              key={p}
              style={[styles.pickerOption, priorityPicker?.current === p && styles.pickerOptionActive]}
              onPress={() => {
                if (priorityPicker) {
                  handleSetPriority(priorityPicker.taskId, p);
                }
              }}
            >
              <View style={[styles.pickerIconCircle, { backgroundColor: PRIORITY_CONFIG[p].tint }]}>
                <Ionicons name={PRIORITY_CONFIG[p].icon} size={20} color={PRIORITY_CONFIG[p].color} />
              </View>
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <Text style={styles.pickerOptionLabel}>{PRIORITY_CONFIG[p].label}</Text>
                <Text style={styles.pickerOptionDesc}>
                  {p === 'alta' ? 'Ação imediata necessária' : p === 'media' ? 'Planejar em breve' : 'Pode esperar'}
                </Text>
              </View>
              {priorityPicker?.current === p && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.accentIcon} />
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
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              onPress={() => setDatePicker(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.iconMuted} />
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

  const scrollToSuggestionAnchor = () => {
    if (filteredTasks.length > 0) {
      taskListRef.current?.scrollToIndex({ index: filteredTasks.length - 1, viewPosition: 0, animated: !reducedMotion });
    }
    else emptyListRef.current?.scrollToEnd({ animated: !reducedMotion });
  };
  const handleSuggestionsShortcut = () => {
    Keyboard.dismiss();
    closeOpenSwipeable();
    anchorRequested.current = true;
    scrollToSuggestionAnchor();
    queueAnchorCheck();
  };
  const queueAnchorCheck = () => {
    if (anchorTimer.current !== null) return;
    anchorTimer.current = setTimeout(() => {
      anchorTimer.current = null;
      handleAnchorScrollEnd();
    }, 350);
  };
  const handleContentSizeChange = (_width: number, height: number) => {
    contentHeight.current = height;
    // Virtualized rows can revise their estimated height while scrolling to the footer.
    if (anchorRequested.current) queueAnchorCheck();
  };
  const handleAnchorScrollEnd = () => {
    if (!anchorRequested.current) return;
    const viewport = (filteredTasks.length > 0 ? taskListRef.current?.getNativeScrollRef() : emptyListRef.current?.getNativeScrollRef()) as NativeMethods | null | undefined;
    viewport?.measureInWindow((_x, top, _width, height) => {
      suggestionsAnchorRef.current?.measureInWindow((_sx, sectionTop, sectionWidth) => {
        if (!anchorRequested.current) return;
        if (sectionWidth > 0 && sectionTop >= top - 1 && sectionTop < top + height - 40) {
          anchorRequested.current = false;
        } else {
          const offset = Math.max(0, scrollOffset.current + sectionTop - top);
          if (filteredTasks.length > 0) {
            if (sectionWidth > 0) taskListRef.current?.scrollToOffset({ offset, animated: !reducedMotion });
            else taskListRef.current?.scrollToEnd({ animated: !reducedMotion });
          } else emptyListRef.current?.scrollTo({ y: offset, animated: !reducedMotion });
          queueAnchorCheck();
        }
      });
    });
  };
  const renderModuleSuggestions = () => hasModuleSuggestions ? (
    <View ref={suggestionsAnchorRef} collapsable={false} onLayout={event => { suggestionsHeight.current = event.nativeEvent.layout.height; }}>
      <ModuleSuggestions suggestions={visibleSuggestions} onDismiss={dismissSuggestion} />
    </View>
  ) : null;

  // ─────── Loading State ───────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tarefas</Text>
          <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accentIcon} />
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



          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={17} color={Colors.iconMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar tarefas..."
              placeholderTextColor={Colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={Colors.iconMuted} />
              </TouchableOpacity>
            )}
          </View>

          {(!hasNoTasksAtAll || hasModuleSuggestions) && (
            <HorizontalOptions
              contentContainerStyle={styles.filterRow}
              hintStyle={styles.filterHint}
              keyboardShouldPersistTaps="handled"
            >
              {!hasNoTasksAtAll && <>
              {FILTERS.slice(0, 3).map((f) => {
                const isActive = activeFilter === f.key;
                let chipCount = 0;
                if (f.key === 'todas') chipCount = tasks.length;
                else if (f.key === 'hoje') chipCount = tasks.filter((t) => isToday(t.dueDate)).length;
                else if (f.key === 'importante') chipCount = tasks.filter((t) => t.priority === 'alta').length;

                return (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
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
                      color={isActive ? Colors.onAction : Colors.textSecondary}
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

              <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                style={[
                  styles.filterChip,
                  (showTagFilter || activeTagFilters.length > 0) && styles.filterChipTagActive,
                ]}
                onPress={() => setShowTagFilter((v) => !v)}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={14}
                  color={activeTagFilters.length > 0 ? Colors.accentIcon : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    activeTagFilters.length > 0 && { color: Colors.accentText },
                  ]}
                >
                  {activeTagFilters.length > 0
                    ? `${activeTagFilters.length} tag${activeTagFilters.length > 1 ? 's' : ''}`
                    : 'Tags'}
                </Text>
                {activeTagFilters.length > 0 && (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setActiveTagFilters([]);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={14} color={Colors.accentIcon} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {FILTERS.slice(3).map((f) => {
                const isActive = activeFilter === f.key;
                const chipCount = tasks.filter((t) => t.done).length;

                return (
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
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
                      color={isActive ? Colors.onAction : Colors.textSecondary}
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
              </>}
              {hasModuleSuggestions && <TouchableOpacity
                activeOpacity={ControlOpacity.pressed}
                style={styles.filterChip}
                accessibilityRole="button"
                accessibilityLabel="Ir para sugestões dos módulos"
                onPress={handleSuggestionsShortcut}
              >
                <Ionicons name="sparkles-outline" size={14} color={Colors.accentIcon} />
                <Text style={styles.filterChipText}>Sugestões</Text>
              </TouchableOpacity>}
            </HorizontalOptions>
          )}

        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {filteredTasks.length === 0 ? (
            <ScrollView
              ref={emptyListRef}
              onContentSizeChange={handleContentSizeChange}
              onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => { anchorRequested.current = false; }}
              onMomentumScrollEnd={handleAnchorScrollEnd}
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: CONTENT_H, paddingBottom: hasModuleSuggestions ? 120 : 0 }}
              keyboardShouldPersistTaps="handled"
            >
              {renderEmptyState()}
              {renderModuleSuggestions()}
            </ScrollView>
          ) : (
            <FlatList
              ref={taskListRef}
              onContentSizeChange={handleContentSizeChange}
              onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleAnchorScrollEnd}
              data={filteredTasks}
              renderItem={renderTaskCard}
              ListFooterComponent={renderModuleSuggestions()}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => { anchorRequested.current = false; closeOpenSwipeable(); }}
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
              }} locked={taskSave.locked}
            />
          </BottomSheet>
        </KeyboardAvoidingView>

        {renderTagManager()}
        {renderPriorityPicker()}
        {renderDatePicker()}

        <Modal visible={employeePicker !== null} transparent animationType="fade" onRequestClose={() => setEmployeePicker(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEmployeePicker(null)}>
            <Pressable style={styles.pickerCard}>
              <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>Atribuir tarefa</Text><TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => setEmployeePicker(null)}><Ionicons name="close" size={22} color={Colors.iconMuted} /></TouchableOpacity></View>
              {taskBeingAssigned && (
                <TaskPeopleSelector
                  clientId={taskBeingAssigned.clientId}
                  supplierId={taskBeingAssigned.supplierId}
                  employeeId={taskBeingAssigned.employeeId}
                  onChange={(relation, id) => { void confirmAction("tarefas.tsx:action:1269" + ':' + id, () => {
                  updateTask(taskBeingAssigned.id, { [`${relation}Id`]: id });
                  return () => {  };
                  }); }}
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
                        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
                          key={tag}
                          style={[
                            styles.tagFilterChip,
                            { borderColor: active ? c.text : SurfaceStyles.filter.borderColor, backgroundColor: active ? c.bg : Colors.bgCard },
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
                  <TouchableOpacity activeOpacity={ControlOpacity.pressed}
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
  safe: { flex: 1, backgroundColor: Colors.appBackground },

  topSection: {
    backgroundColor: Colors.appBackground,
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

  // Search
  searchContainer: {
      ...SurfaceStyles.control,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: CONTENT_H,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
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
  filterHint: {
    marginLeft: CONTENT_H,
    marginRight: CONTENT_H,
  },
  filterChip: { ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
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
  filterChipTextActive: { color: Colors.onAction },
  filterChipBadge: {
    backgroundColor: Colors.mintBackground,
    borderRadius: Radius.full,
    minWidth: 18,
    minHeight: 18,
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
  filterChipBadgeTextActive: { color: Colors.onAction },

  // List
  listContent: {
    paddingHorizontal: CONTENT_H,
    paddingTop: Spacing.sm,
    paddingBottom: 120,
  },

  // Task card
  taskCard: {
      ...SurfaceStyles.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm
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
    borderColor: SurfaceStyles.filter.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: Colors.actionBackground,
    borderColor: Colors.accentIcon,
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
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
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
      ...SurfaceStyles.control,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
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
    backgroundColor: Colors.actionBackground,
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
    borderColor: SurfaceStyles.filter.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskCheckDone: {
    backgroundColor: Colors.actionBackground,
    borderColor: Colors.accentIcon,
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
      ...SurfaceStyles.control,
    flexDirection: 'row',
    alignItems: 'center',
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
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  tagChip: { maxWidth: '100%', paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  tagChipText: { flexShrink: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
  },
  tagChipAdd: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: SurfaceStyles.filter.borderColor,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Swipe
  swipeDelete: {
    backgroundColor: Colors.dangerActionBackground,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  swipeComplete: {
    backgroundColor: Colors.warningActionBackground,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  swipeCompleteUndo: { backgroundColor: Colors.warningActionBackground },
  swipeActionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: Colors.onAction,
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
    color: Colors.onAction,
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
      ...SurfaceStyles.backdrop,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
      ...SurfaceStyles.overlay,
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
      ...SurfaceStyles.filter,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 1,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md
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
      ...SurfaceStyles.control,
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 1,
  },
  tagAddBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.actionBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tag filter popover
  tagFilterPopover: {
      ...SurfaceStyles.overlay,
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
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full
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
    color: Colors.dangerText,
  },
});
