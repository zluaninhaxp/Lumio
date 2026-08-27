import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { parseMessage, buildBotResponse } from '../../src/engine/regexEngine';
import { parseTaskMessage } from '../../src/engine/taskEngine/taskParser';
import type { TaskParserContext, TaskParseResult } from '../../src/engine/taskEngine/types';
import { parseCalendarMessage, decideHybrid } from '../../src/engine/calendarEngine/calendarParser';
import type { CalendarParserContext } from '../../src/engine/calendarEngine/types';
import {
  parseFinancialMessage, applyFinancialResult, buildFinanceCards,
  buildFinancialBotText, answerFinancialQuery, formatBRL,
} from '../../src/engine/financialEngine';
import type { FinancialParserContext } from '../../src/engine/financialEngine';
import { useAppStore } from '../../src/store';
import { MASCOT_IMAGES } from '../../src/data/mascotExpressions';
import VoiceInput from '../components/onboarding/VoiceInput';
import { useAuth } from '../../src/hooks/useAuth';
import { UserAvatar } from '../components/account/UserAvatar';
import { AccountSheet } from '../components/account/AccountSheet';
import { BotMessageCard, type BotCard } from '../components/chat/BotMessageCard';

interface Message {
  id: string;
  type: 'user' | 'bot' | 'fallback';
  text: string;
  actions?: string[];
  /** Cards visuais (substituem `text` quando presentes). */
  cards?: BotCard[];
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '0',
    type: 'bot',
    text: 'Olá! Pode digitar qualquer coisa aqui — gastos, tarefas, compromissos. Eu cuido do resto. 👋',
    timestamp: new Date(),
  },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [accountVisible, setAccountVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
const { currentUser } = useAuth();
  const { addTransaction, addTask, addEvent, calendarizeTask, addPedido, pedidos, addOrcamento, orcamentos, refreshOrcamentos, refreshContratos, contratos, clienteItems, transactions, fornecedorItems, estoqueItems, moveEstoqueItem, employeeItems, updateTask, commissions, closeEmployeeCommission, entregas, atendimentos, addAtendimento, activatedPlugins, taskTags, customTaskTags, keywordMap, calendarEventTypes } = useAppStore();

  const resolveClient = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase().replace(/^(?:o|a|do|da|de)\s+/i, '');
    return clienteItems.filter((client) => client.name.toLowerCase().includes(normalized) || normalized.includes(client.name.toLowerCase()));
  }, [clienteItems]);

  const formatMoney = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
  const resolveSupplier = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase().replace(/^(?:do|da|de)\s+/i, '');
    return fornecedorItems.filter((supplier) => supplier.name.toLowerCase().includes(normalized) || normalized.includes(supplier.name.toLowerCase()));
  }, [fornecedorItems]);
  const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  const resolveStockItem = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase();
    return estoqueItems.filter((item) => item.name.toLowerCase().includes(normalized) || normalized.includes(item.name.toLowerCase()));
  }, [estoqueItems]);
  const resolveEmployee = useCallback((name: string) => {
    const normalized = name.trim().toLowerCase();
    return employeeItems.filter((employee) => employee.name.toLowerCase().includes(normalized) || normalized.includes(employee.name.toLowerCase()));
  }, [employeeItems]);
  const parseQuoteItems = (text: string) => text.split(/\s+e\s+|,/i).map((part, index) => { const match = part.trim().match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/); return { id: `${Date.now()}-${index}`, name: match?.[2]?.trim() || part.trim(), quantity: match ? Number(match[1].replace(',', '.')) : 1, unitPrice: 0 }; }).filter((item) => item.name);
  const dateForToken = (token: string) => {
    const normalized = token.toLowerCase();
    const date = new Date();
    if (/amanh/.test(normalized)) date.setDate(date.getDate() + 1);
    else if (!/hoje/.test(normalized)) {
      const weekdays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      const target = weekdays.findIndex((day) => normalized.startsWith(day.slice(0, 3)));
      if (target >= 0) {
        const delta = (target - date.getDay() + 7) % 7;
        date.setDate(date.getDate() + delta);
      }
    }
return date.toISOString().split('T')[0];
  };

  // ─────── Motor de interpretação de TAREFAS (determinístico) ───────
  // Camada avançada que reconhece tarefas em linguagem natural livre e
  // extrai entidades (ação/objeto/data/responsável/tag) validando contra o
  // contexto REAL do usuário. Ver `src/engine/taskEngine/taskParser.ts`.
  const buildTaskContext = useCallback((): TaskParserContext => {
    const s = useAppStore.getState();
    const tags = Array.from(new Set([...(s.taskTags || []).map((t) => t.label), ...(s.customTaskTags || [])]));
    return {
      now: new Date(),
      people: (s.employeeItems || []).map((e) => ({ id: e.id, name: e.name })),
      taskTags: tags,
      keywordMap: s.keywordMap || {},
      taxonomy: s.taxonomy?.domains.task,
    };
  }, []);

  const runTaskEngine = useCallback((text: string): TaskParseResult => {
    return parseTaskMessage(text, buildTaskContext());
  }, [buildTaskContext]);

  // ─────── Motor de interpretação de CALENDÁRIO (híbrido, seção 2/3) ───────
  // Roda em paralelo ao de tarefas. Decide:
  //  - criar evento independente ("compromisso/reunião/aniversário" + data);
  //  - calendarizar tarefa com data (representação derivada source='task');
  //  - ambas as intenções (ver seção 25 — "reunião + levar o orçamento").
  // Reaproveita normalization/temporal/personResolver do taskEngine.
  const buildCalendarContext = useCallback((): CalendarParserContext => {
    const s = useAppStore.getState();
    return {
      now: new Date(),
      calendarEventTypes: (s.calendarEventTypes || []).map((c) => c.label),
      keywordMap: s.keywordMap || {},
      taxonomy: s.taxonomy?.domains.calendar,
      people: (s.employeeItems || []).map((e) => ({ id: e.id, name: e.name })),
    };
  }, []);

  const runCalendarEngine = useCallback((text: string) => {
    return parseCalendarMessage(text, buildCalendarContext());
  }, [buildCalendarContext]);

  // ─────── Motor financeiro (determinístico) ───────
  // Prioridade sobre tarefas/calendário quando a mensagem é sobre DINHEIRO
  // ("paguei 500", "recebi 2 mil do João"). Para obrigações futuras cria
  // transação pendente + tarefa + calendário derivado, vinculados.
  const buildFinancialContext = useCallback((): FinancialParserContext => {
    const s = useAppStore.getState();
    return {
      now: new Date(),
      expenseCategories: (s.financialExpenseCategories || []).map((c) => c.label),
      incomeCategories: (s.financialIncomeCategories || []).map((c) => c.label),
      keywordMap: s.keywordMap || {},
      expenseTaxonomy: s.taxonomy?.domains['financial.expense'],
      incomeTaxonomy: s.taxonomy?.domains['financial.income'],
      clients: (s.clienteItems || []).map((c) => ({ id: c.id, name: c.name })),
      suppliers: (s.fornecedorItems || []).map((f) => ({ id: f.id, name: f.name, paymentTerm: f.paymentTerm })),
      employees: (s.employeeItems || []).map((e) => ({ id: e.id, name: e.name })),
    };
  }, []);

  const applyFinancialEngine = useCallback((text: string): TaskOutcome => {
    const result = parseFinancialMessage(text, buildFinancialContext());

    if (result.intent === 'query' && result.query) {
      const txs = useAppStore.getState().transactions;
      return { handled: true, botText: answerFinancialQuery(result.query, txs, new Date()), botType: 'bot' };
    }

    if (result.intent === 'incomplete') {
      return { handled: true, botText: 'Entendi que é um lançamento financeiro, mas não consegui identificar o valor com segurança. Quanto foi exatamente?', botType: 'bot' };
    }

    if (result.intent === 'recurrence' && result.recurrence) {
      return { handled: true, botText: `Reconheci um lançamento recorrente ("${result.recurrence.expression}"), mas o Financeiro ainda não automatiza recorrências. Registre cada ocorrência quando acontecer — ou me diga a de hoje.`, botType: 'bot' };
    }

    if (result.intent === 'edit' || result.intent === 'delete') {
      return { handled: true, botText: 'Para corrigir ou excluir um lançamento, abra a tela Financeiro e deslize o lançamento para editar ou excluir — assim você escolhe exatamente qual registro mudar.', botType: 'bot' };
    }

    if (result.intent === 'create_transaction' || result.intent === 'create_obligation') {
      const store = useAppStore.getState();
      const applied = applyFinancialResult(result, store);
      if (applied.created === 'nothing') return { handled: false };
      const cards = buildFinanceCards(result.entries);
      let extra = '';
      if (applied.created === 'obligation' && applied.taskId) {
        const task = store.tasks.find((t) => t.id === applied.taskId);
        extra = task ? `\nTambém criei a tarefa "${task.description}" com prazo no calendário.` : '';
      }
      return { handled: true, botText: `${buildFinancialBotText(result.entries)}${extra}`, cards, botType: 'bot' };
    }

    return { handled: false };
  }, [buildFinancialContext]);

  type TaskOutcome = {
    handled: boolean;
    botText?: string;
    actions?: string[];
    botType?: 'bot' | 'fallback';
    cards?: BotCard[];
  };

  /**
   * Cria as tarefas devolvidas pelo motor e monta a resposta do bot.
   * Devolve { handled: false } quando o motor NÃO deve tomar a frente
   * (ex.: intenção não-tarefa sob confiança baixa), deixando o fluxo
   * original rodar.
   *
   * ORQUESTRAÇÃO HÍBRIDA (especificação seções 25/36):
   *  - Se calendar diz `create_event` puro (confiança alta) → cria SÓ
   *    eventos independentes, NÃO persiste tarefas do taskEngine (evita
   *    duplicação "visitar obra" = tarefa + evento).
   *  - Se calendar diz `create_task_with_calendar` → cria SÓ tarefas com
   *    calendário derivado (source='task').
   *  - Se calendar diz `create_task_and_event` → cria eventos independentes
   *    + tarefas com calendário derivado (cada um no seu domínio).
   *  - Se calendar diz `none` mas taskEngine tem tarefa com data → cria
   *    tarefa + calendário derivado.
   */
  const applyTaskEngineResult = useCallback((	returnText: string, parsedIntent: string): TaskOutcome => {
    const result = runTaskEngine(returnText);
    const cal = runCalendarEngine(returnText);
    const minconf = 0.5;

    // ─── CASO 1: calendar diz create_event PURO (compromissos/eventos) ───
    // A intenção dominante é compromisso. NÃO criar tarefas (evita
    // duplicação "visitar a obra sexta" = tarefa + evento).
    if (cal.intent === 'create_event' && cal.confidence >= 0.45 && cal.events.length > 0) {
      const cards: BotCard[] = [];
      for (const ev of cal.events) {
        addEvent({
          date: ev.date,
          time: ev.time,
          description: ev.title + (ev.context ? ` — ${ev.context}` : ''),
          type: 'event',
          eventType: ev.eventType ?? undefined,
          source: 'chat',
        });
        cards.push({
          kind: 'event',
          title: ev.title,
          date: ev.date,
          time: ev.time ?? undefined,
          assignee: ev.personName ?? undefined,
          eventType: ev.eventType ?? undefined,
          context: ev.context ?? undefined,
        });
      }
      return { handled: true, botText: '', cards, botType: 'bot' };
    }

    // ─── CASO 2: taskEngine não reconheceu tarefa ───
    if (result.intent !== 'create_task' || result.tasks.length === 0) {
      if (parsedIntent === 'TASK_ADD' || parsedIntent === 'TASK_WITH_DATE') {
        return { handled: true, botText: result.reason ? `Não registrei tarefa: ${result.reason}` : 'Não identifiquei uma tarefa nessa mensagem.', botType: 'bot' };
      }
      // Caso UNKNOWN: deixa o fluxo original decidir (fallback).
      return { handled: false };
    }

    // Confiança baixa não cria automaticamente — cai para fallback/IA.
    if (result.tasks.every((t) => t.confidence < minconf)) {
      return { handled: false };
    }

    // ─── CASO 3: calendar diz create_task_and_event ───
    // Eventos independentes + tarefas com calendário derivado.
    const decision = decideHybrid(cal, result.tasks.length > 0, result.tasks.some((t) => !!t.dueDate));
    const eventCards: BotCard[] = [];
    if (decision.shouldCreateInCalendar && decision.events.length > 0) {
      for (const ev of decision.events) {
        addEvent({
          date: ev.date,
          time: ev.time,
          description: ev.title + (ev.context ? ` — ${ev.context}` : ''),
          type: 'event',
          eventType: ev.eventType ?? undefined,
          source: 'chat',
        });
        eventCards.push({
          kind: 'event',
          title: ev.title,
          date: ev.date,
          time: ev.time ?? undefined,
          assignee: ev.personName ?? undefined,
          eventType: ev.eventType ?? undefined,
          context: ev.context ?? undefined,
        });
      }
    }

    // ─── CASO 4: criar tarefas (com calendário derivado quando tem data) ───
    const taskCards: BotCard[] = [];
    for (const t of result.tasks) {
      if (t.confidence < minconf) continue;
      const taskId = addTask({
        description: t.title,
        source: 'chat',
        done: false,
        dueDate: t.dueDate,
        dueDateLabel: t.dueDateLabel,
        priority: 'media',
        subtasks: [],
        tags: t.tags,
        createdAt: new Date().toISOString(),
        employeeId: t.assigneeId || undefined,
      });
      // Calendariozação: se a tarefa tem data relevante (execução OU prazo)
      // criamos um evento derivado (source='task') com deadline marcado
      // quando aplicável (especificação seções 4/6/14/22).
      let isDeadline = false;
      if (t.dueDate) {
        const evType = decision.taskCalendar?.eventType ?? undefined;
        isDeadline = t.entities.isDeadline || (decision.taskCalendar?.deadline ?? false);
        calendarizeTask(taskId, {
          date: t.dueDate,
          time: t.dueTime ?? null,
          deadline: isDeadline,
          eventType: evType ?? undefined,
        });
      }
      taskCards.push({
        kind: isDeadline ? 'deadline' : 'task',
        title: t.title,
        date: t.dueDate ?? undefined,
        dateLabel: t.dueDateLabel ?? undefined,
        time: t.dueTime ?? undefined,
        assignee: t.assigneeName ?? undefined,
        tags: t.tags.length > 0 ? t.tags : undefined,
        context: t.description ?? undefined,
      });
    }
    if (taskCards.length === 0 && eventCards.length === 0) return { handled: false };
    const allCards = [...taskCards, ...eventCards];
    return { handled: true, botText: '', cards: allCards, actions: ['Concluir'], botType: 'bot' };
  }, [runTaskEngine, runCalendarEngine, addTask, addEvent, calendarizeTask]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  /** Adiciona user+bot ao histórico e rola — usado por texto e voz. */
  const commitMessages = useCallback((userText: string, outcome: { botText: string; actions: string[]; botType: 'bot' | 'fallback'; cards?: BotCard[] }) => {
    refreshOrcamentos();
    refreshContratos();
    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: userText,
      timestamp: new Date(),
    };
    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: outcome.botType,
      text: outcome.botText,
      actions: outcome.actions,
      cards: outcome.cards,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    scrollToBottom();
  }, [refreshOrcamentos, refreshContratos, scrollToBottom]);


  /**
   * Intents de PLUGINS (regexEngine): consultas e criações específicas de
   * módulos (equipe, orçamentos, entregas, agenda, contratos, pedidos,
   * estoque, fornecedores, clientes). Devolve `{botText}` ou null.
   */
  const handlePluginIntent = useCallback((parsed: ReturnType<typeof parseMessage>): { botText: string; botType?: 'bot' | 'fallback'; actions?: string[] } | null => {
    let botText = buildBotResponse(parsed);
    let botType: 'bot' | 'fallback' = 'bot';
    let actions: string[] = [];

    if (parsed.intent === 'EMPLOYEE_TASKS_QUERY' || parsed.intent === 'TASK_ASSIGN') {
      const matches = resolveEmployee(parsed.entities.employeeName || '');
      if (matches.length === 0) botText = `Não encontrei um funcionário chamado "${parsed.entities.employeeName}". Cadastre-o em Equipe antes de continuar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um funcionário parecido com "${parsed.entities.employeeName}". Informe o nome completo.`;
      else if (parsed.intent === 'EMPLOYEE_TASKS_QUERY') {
        const today = new Date().toISOString().split('T')[0];
        const tasks = useAppStore.getState().tasks.filter((task) => task.employeeId === matches[0].id && !task.done && task.dueDate === today);
        botText = tasks.length ? `${matches[0].name} tem hoje: ${tasks.map((task) => task.description).join('; ')}.` : `${matches[0].name} não tem tarefas pendentes para hoje.`;
      } else {
        const pending = useAppStore.getState().tasks.filter((task) => !task.done);
        const task = pending[pending.length - 1];
        if (!task) botText = 'Não encontrei uma tarefa pendente para atribuir.';
else { updateTask(task.id, { employeeId: matches[0].id }); botText = `✓ Tarefa "${task.description}" atribuída para ${matches[0].name}.`; }
      }
    } else if (parsed.intent === 'COMMISSION_MONTH_QUERY' || parsed.intent === 'COMMISSION_PAY') {
      const matches = resolveEmployee(parsed.entities.employeeName || '');
      if (matches.length === 0) botText = `Não encontrei um funcionário chamado "${parsed.entities.employeeName}". Cadastre-o em Equipe antes de continuar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um funcionário parecido com "${parsed.entities.employeeName}". Informe o nome completo.`;
      else if (parsed.intent === 'COMMISSION_MONTH_QUERY') {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const total = commissions.filter((c) => c.employeeId === matches[0].id && !c.paid && c.month === month).reduce((sum, c) => sum + c.amount, 0);
        botText = `${matches[0].name} tem ${formatMoney(total)} de comissão pendente este mês.`;
      } else {
        const pending = useAppStore.getState().commissions.filter((c) => c.employeeId === matches[0].id && !c.paid);
        if (pending.length === 0) botText = `${matches[0].name} não tem comissão pendente para fechar.`;
        else { const total = pending.reduce((sum, c) => sum + c.amount, 0); closeEmployeeCommission(matches[0].id); botText = `✓ Comissão de ${formatMoney(total)} de ${matches[0].name} concluída. O saldo foi fechado sem alterar o Financeiro.`; }
      }
    } else if (parsed.intent === 'QUOTE_CREATE' || parsed.intent === 'QUOTE_STATUS_QUERY' || parsed.intent === 'QUOTE_EXPIRING_QUERY') {
      if (parsed.intent === 'QUOTE_EXPIRING_QUERY') {
        const now = new Date(); const start = new Date(now); const day = start.getDay() || 7; start.setDate(start.getDate() - day + 1); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 6);
        const expiring = orcamentos.filter((quote) => quote.status === 'pendente' && new Date(`${quote.validUntil}T00:00:00`) >= start && new Date(`${quote.validUntil}T00:00:00`) <= end);
        botText = expiring.length ? `Vencem esta semana: ${expiring.map((quote) => `#${quote.id.slice(-6)} em ${quote.validUntil}`).join(', ')}.` : 'Nenhum orçamento pendente vence esta semana.';
      } else {
        const matches = resolveClient(parsed.entities.clientName || '');
        if (matches.length === 0) botText = `Não encontrei o cliente "${parsed.entities.clientName}". Cadastre-o em Clientes antes de criar o orçamento.`;
        else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo.`;
        else if (parsed.intent === 'QUOTE_STATUS_QUERY') {
          const quote = orcamentos.find((item) => item.clientId === matches[0].id);
          botText = quote ? `O orçamento ${quote.id.slice(-6)} de ${matches[0].name} está ${quote.status}.` : `Não encontrei orçamento para ${matches[0].name}.`;
        } else {
          const items = parseQuoteItems(parsed.entities.quoteItemsText || ''); const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + 7); const id = addOrcamento({ clientId: matches[0].id, items, total: 0, validUntil: validUntil.toISOString().split('T')[0], status: 'pendente', createdAt: new Date().toISOString() });
          botText = `✓ Orçamento ${id.slice(-6)} criado para ${matches[0].name}, válido por 7 dias.`;
        }
      }
    } else if (parsed.intent === 'DELIVERY_STATUS_QUERY' || parsed.intent === 'DELIVERY_PENDING_QUERY') {
      const today = new Date().toISOString().split('T')[0];
      if (parsed.intent === 'DELIVERY_PENDING_QUERY') {
        const pending = entregas.filter((delivery) => delivery.status === 'a caminho' && delivery.estimatedDate === today);
        botText = pending.length ? `Entregas pendentes hoje: ${pending.map((delivery) => `pedido ${delivery.orderId.slice(-6)}`).join(', ')}.` : 'Não há entregas pendentes para hoje.';
      } else {
        const order = pedidos.find((item) => item.id === parsed.entities.orderId || item.id.endsWith(parsed.entities.orderId || ''));
        const delivery = order && entregas.find((item) => item.orderId === order.id && item.status !== 'cancelada');
        botText = delivery ? `A entrega do pedido ${order!.id.slice(-6)} está ${delivery.status}, com prazo para ${formatDate(delivery.estimatedDate)}.` : `Não encontrei uma entrega ativa para o pedido ${parsed.entities.orderId}.`;
      }
    } else if (parsed.intent === 'FREE_SLOT_QUERY' || parsed.intent === 'APPOINTMENT_CREATE' || parsed.intent === 'APPOINTMENT_TODAY_QUERY') {
      if (!activatedPlugins.includes('agenda')) {
        botText = 'Ative o módulo Agenda / Atendimento em Apps para agendar horários.';
      } else if (parsed.intent === 'APPOINTMENT_TODAY_QUERY') {
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = atendimentos.filter((appointment) => appointment.date === today && appointment.status !== 'cancelado');
        botText = todayAppointments.length ? `Hoje você tem: ${todayAppointments.map((appointment) => `${appointment.time} — ${appointment.service}`).join('; ')}.` : 'Você não tem atendimentos agendados para hoje.';
      } else {
        const date = dateForToken(parsed.entities.date || 'hoje');
        const occupied = atendimentos.some((appointment) => appointment.date === date && appointment.time === parsed.entities.time && appointment.status !== 'cancelado');
        if (parsed.intent === 'FREE_SLOT_QUERY') botText = occupied ? `Esse horário já está ocupado em ${date} às ${parsed.entities.time}.` : `Sim, o horário de ${date} às ${parsed.entities.time} está livre.`;
        else {
          const matches = resolveClient(parsed.entities.clientName || '');
          if (matches.length === 0) botText = `Não encontrei o cliente "${parsed.entities.clientName}". Cadastre-o em Clientes antes de agendar.`;
          else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo.`;
          else if (occupied) botText = `O horário de ${date} às ${parsed.entities.time} já está ocupado.`;
          else { const id = addAtendimento({ clientId: matches[0].id, date, time: parsed.entities.time || '00:00', duration: 60, service: 'Atendimento', status: 'confirmado', createdAt: new Date().toISOString() }); botText = id ? `✓ Atendimento de ${matches[0].name} marcado para ${date} às ${parsed.entities.time}.` : 'Não foi possível criar o atendimento.'; }
        }
      }
    } else if (parsed.intent === 'CONTRACT_DUE_QUERY' || parsed.intent === 'CONTRACT_STATUS_QUERY') {
      const now = new Date();
      if (parsed.intent === 'CONTRACT_DUE_QUERY') {
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const due = contratos.filter((contract) => contract.status === 'ativo' && contract.nextBillingDate.startsWith(month));
        botText = due.length ? `Vencem este mês: ${due.map((contract) => `${clienteItems.find((client) => client.id === contract.clientId)?.name ?? 'cliente'} em ${formatDate(contract.nextBillingDate)}`).join(', ')}.` : 'Nenhum contrato ativo vence este mês.';
      } else {
        const matches = resolveClient(parsed.entities.clientName || '');
        if (matches.length === 0) botText = `Não encontrei o cliente "${parsed.entities.clientName}".`;
        else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo.`;
        else {
          const pending = transactions.some((transaction) => transaction.clientId === matches[0].id && transaction.contractId && transaction.confirmed === false && !!transaction.expectedDate && transaction.expectedDate <= new Date().toISOString().split('T')[0]);
          botText = pending ? `${matches[0].name} tem uma cobrança de contrato pendente.` : `${matches[0].name} está em dia com os contratos.`;
        }
      }
    } else if (parsed.intent === 'ORDER_CREATE' || parsed.intent === 'ORDER_OPEN_QUERY' || parsed.intent === 'SALES_WEEK_QUERY') {
      if (parsed.intent === 'ORDER_OPEN_QUERY') {
        const openOrders = pedidos.filter((order) => order.status === 'aberto');
        botText = openOrders.length ? `Pedidos em aberto: ${openOrders.map((order) => `#${order.id.slice(-6)}`).join(', ')}.` : 'Não há pedidos em aberto.';
      } else if (parsed.intent === 'SALES_WEEK_QUERY') {
        const now = new Date();
        const start = new Date(now);
        const day = start.getDay() || 7;
        start.setDate(start.getDate() - day + 1);
        start.setHours(0, 0, 0, 0);
        const sold = pedidos.filter((order) => order.status === 'concluido' && new Date(order.createdAt) >= start).reduce((sum, order) => sum + order.total, 0);
        botText = `Você vendeu ${formatMoney(sold)} nesta semana.`;
      } else {
        const matches = resolveClient(parsed.entities.clientName || '');
        if (matches.length === 0) botText = `Não encontrei o cliente "${parsed.entities.clientName}". Cadastre-o em Clientes antes de registrar o pedido.`;
        else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo.`;
        else {
          const stockMatch = estoqueItems.find((item) => item.name.trim().toLowerCase() === (parsed.entities.orderItemName || '').trim().toLowerCase());
          const quantity = parsed.entities.orderQuantity || 0;
          const unitPrice = parsed.entities.unitPrice || 0;
          const id = addPedido({ clientId: matches[0].id, items: [{ id: `${Date.now()}`, name: parsed.entities.orderItemName || 'Item', quantity, unitPrice, stockItemId: stockMatch?.id }], total: quantity * unitPrice, status: 'aberto', date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), createdAt: new Date().toISOString() });
          botText = `✓ Pedido ${id.slice(-6)} aberto para ${matches[0].name}: ${quantity}x ${parsed.entities.orderItemName} por ${formatMoney(quantity * unitPrice)}. Conclua o pedido para gerar a receita e baixar o estoque.`;
        }
      }
    } else if (parsed.intent === 'STOCK_BALANCE_QUERY' || parsed.intent === 'STOCK_DECREASE' || parsed.intent === 'STOCK_LOW_QUERY') {
      if (parsed.intent === 'STOCK_LOW_QUERY') {
        const lowItems = estoqueItems.filter((item) => item.quantity < item.minAlert);
        botText = lowItems.length ? `Estão acabando: ${lowItems.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(', ')}.` : 'Nenhum item está abaixo do mínimo.';
      } else {
        const matches = resolveStockItem(parsed.entities.stockItemName || '');
        if (matches.length === 0) botText = `Não encontrei o item "${parsed.entities.stockItemName}" no estoque.`;
        else if (matches.length > 1) botText = `Encontrei mais de um item parecido com "${parsed.entities.stockItemName}". Informe o nome completo.`;
        else if (parsed.intent === 'STOCK_BALANCE_QUERY') botText = `Você tem ${matches[0].quantity} ${matches[0].unit} de ${matches[0].name}.`;
        else if (moveEstoqueItem(matches[0].id, -(parsed.entities.value || 0), 'uso interno')) botText = `✓ Baixa de ${parsed.entities.value} ${matches[0].unit} de ${matches[0].name} registrada.`;
        else botText = `Não foi possível dar baixa: o estoque de ${matches[0].name} não pode ficar negativo.`;
      }
    } else if (parsed.intent === 'SUPPLIER_BALANCE_QUERY' || parsed.intent === 'SUPPLIER_DUE_QUERY') {
      const matches = resolveSupplier(parsed.entities.supplierName || '');
      if (matches.length === 0) botText = `Não encontrei um fornecedor chamado "${parsed.entities.supplierName}". Cadastre-o em Fornecedores antes de consultar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um fornecedor parecido com "${parsed.entities.supplierName}". Informe o nome completo.`;
      else if (parsed.intent === 'SUPPLIER_BALANCE_QUERY') {
        const debt = transactions.filter((transaction) => transaction.supplierId === matches[0].id && transaction.amount < 0 && !transaction.supplierPaid).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
        botText = `Você deve ${formatMoney(debt)} para ${matches[0].name}.`;
      } else {
        const purchases = transactions.filter((transaction) => transaction.supplierId === matches[0].id && transaction.amount < 0).sort((a, b) => b.id.localeCompare(a.id));
        botText = purchases[0]?.supplierDueDate ? `A última compra de ${matches[0].name} vence em ${formatDate(purchases[0].supplierDueDate)}.` : `A última compra de ${matches[0].name} não tem vencimento informado.`;
      }
    } else if (parsed.intent === 'CLIENT_PAYMENT_QUERY' || parsed.intent === 'CLIENT_PENDING_QUERY') {
      const matches = resolveClient(parsed.entities.clientName || '');
      if (matches.length === 0) botText = `Não encontrei um cliente chamado "${parsed.entities.clientName}". Cadastre-o em Clientes antes de consultar.`;
      else if (matches.length > 1) botText = `Encontrei mais de um cliente parecido com "${parsed.entities.clientName}". Informe o nome completo para eu continuar.`;
      else if (parsed.intent === 'CLIENT_PAYMENT_QUERY') {
         const total = transactions.filter((transaction) => transaction.clientId === matches[0].id && transaction.amount > 0 && transaction.confirmed !== false).reduce((sum, transaction) => sum + transaction.amount, 0);
        botText = `${matches[0].name} já pagou ${formatMoney(total)} nas receitas vinculadas.`;
      } else {
        botText = /pend[eê]ncia|aberto|deve/i.test(matches[0].notes) ? `${matches[0].name} tem uma pendência registrada nas observações: ${matches[0].notes}` : `Não há pendência registrada para ${matches[0].name}.`;
      }
    } else if (parsed.intent === 'UNKNOWN') {
      botType = 'fallback';
    }

    return { botText, botType, actions: actions.length ? actions : undefined };
  }, [resolveEmployee, resolveClient, resolveSupplier, resolveStockItem, updateTask, commissions, closeEmployeeCommission, orcamentos, addOrcamento, pedidos, addPedido, estoqueItems, moveEstoqueItem, entregas, atendimentos, addAtendimento, activatedPlugins, contratos, clienteItems, transactions, formatDate, dateForToken, parseQuoteItems, formatMoney]);

  /**
   * Processamento ÚNICO da mensagem do usuário (texto e voz compartilham).
   * Ordem de prioridade dos motores:
   *  1. Intents específicas de plugins (regexEngine) — órdenes/pedidos etc;
   *  2. FINANCEIRO (quando a mensagem é sobre dinheiro) — cria transações,
   *     obrigações (tarefa+calendário+transação vinculadas), responde
   *     consultas com dados reais;
   *  3. TAREFAS + CALENDÁRIO (fluxo híbrido existente);
   *  4. Fallback.
   */
  const processMessage = useCallback((text: string) => {
    const parsed = parseMessage(text);
    let botText = buildBotResponse(parsed);
    let actions: string[] = [];
    let botType: 'bot' | 'fallback' = 'bot';
    let cards: BotCard[] | undefined;

    const isPluginIntent =
      parsed.intent !== 'TASK_ADD' && parsed.intent !== 'TASK_WITH_DATE' &&
      parsed.intent !== 'UNKNOWN' && parsed.intent !== 'QUERY_REPORT';

    // ── 1) Financeiro primeiro (domínio dinheiro tem prioridade) ──
    // QUERY_REPORT do regexEngine legado também cai no financeiro (dados reais).
    const financialTextualDomains = parsed.intent === 'EXPENSE_RECORD' || parsed.intent === 'INCOME_RECORD' || parsed.intent === 'QUERY_REPORT';
    if (financialTextualDomains || parsed.intent === 'UNKNOWN') {
      const outcome = applyFinancialEngine(text);
      if (outcome.handled) {
        botText = outcome.botText ?? botText;
        actions = outcome.actions ?? actions;
        botType = outcome.botType ?? botType;
        cards = outcome.cards;
        return { botText, actions, botType, cards };
      }
    }

    // ── 2) Motor de TAREFAS + CALENDÁRIO (híbrido existente) ──
    if (parsed.intent === 'TASK_ADD' || parsed.intent === 'TASK_WITH_DATE' || parsed.intent === 'UNKNOWN') {
      const outcome = applyTaskEngineResult(text, parsed.intent);
      if (outcome.handled) {
        return {
          botText: outcome.botText ?? botText,
          actions: outcome.actions ?? actions,
          botType: outcome.botType ?? botType,
          cards: outcome.cards,
        };
      }
      if (parsed.intent === 'TASK_ADD' || parsed.intent === 'TASK_WITH_DATE') {
        return {
          botText: 'Não consegui identificar uma tarefa nessa mensagem. O que você quer fazer?',
          actions: [],
          botType: 'fallback' as const,
          cards: undefined,
        };
      }
    }

    // ── 3) Intents de plugins (consulta/criação específicas) ──
    if (isPluginIntent) {
      const pluginOutcome = handlePluginIntent(parsed);
      if (pluginOutcome) {
        botText = pluginOutcome.botText;
        botType = pluginOutcome.botType ?? 'bot';
        actions = pluginOutcome.actions ?? actions;
      }
    } else if (parsed.intent === 'QUERY_REPORT') {
      // já tratado no financeiro; se chegou aqui, sem dados
      botText = 'Nada registrado ainda para resumir.';
    } else if (parsed.intent === 'UNKNOWN') {
      botType = 'fallback';
    }

    return { botText, actions, botType, cards };
  }, [applyFinancialEngine, applyTaskEngineResult, handlePluginIntent]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    commitMessages(text, processMessage(text));
    setInput('');
  }, [input, processMessage, commitMessages]);

  const handleVoiceCapture = useCallback((transcript: string) => {
    if (!transcript.trim()) return;
    commitMessages(transcript.trim(), processMessage(transcript.trim()));
  }, [processMessage, commitMessages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isTransactionReport = item.actions?.some((a) => a === 'Editar' || a === 'Excluir');

    const renderBotAvatar = (expression: 'neutro' | 'confuso' | 'piscando') => (
      <Image source={MASCOT_IMAGES[expression]} style={styles.botAvatarImage} resizeMode="contain" />
    );

    if (item.type === 'user') {
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'fallback') {
      return (
        <View style={styles.botRow}>
          {renderBotAvatar('confuso')}
          <View style={styles.botContent}>
            <View style={styles.botBubble}>
              <Text style={styles.botText}>
                Não consegui identificar o que você quer registrar. O que você quer fazer?
              </Text>
            </View>
            <View style={styles.quickActionsRow}>
              {['Registrar gasto', 'Adicionar tarefa', 'Outra coisa'].map((label) => (
                <TouchableOpacity key={label} style={styles.quickActionBtn}>
                  <Text style={styles.quickActionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    const hasCards = item.cards && item.cards.length > 0;

    return (
      <View style={styles.botRow}>
        {renderBotAvatar(hasCards ? 'piscando' : isTransactionReport ? 'piscando' : 'neutro')}
        <View style={styles.botContent}>
          {hasCards ? (
            <View style={styles.cardsContainer}>
              {item.cards!.map((card, idx) => (
                <BotMessageCard key={idx} card={card} />
              ))}
            </View>
          ) : (
            <View style={styles.botBubble}>
              <Text style={styles.botText}>{item.text}</Text>
            </View>
          )}
          {item.actions && item.actions.length > 0 && (
            <View style={styles.actionsRow}>
              {item.actions.map((action) => (
                <TouchableOpacity key={action} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{action}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/lumio.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
         <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(239,239,237,0)', Colors.bg]}
          style={styles.messageFade}
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { marginBottom: Spacing.sm }]}>
          <View style={styles.inputWrapper}>
            {!input && (
              <Text
                style={styles.inputPlaceholder}
                numberOfLines={1}
                ellipsizeMode="tail"
                pointerEvents="none"
              >
                Digite aqui...
              </Text>
            )}
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholderTextColor="transparent"
              onSubmitEditing={handleSend}
              returnKeyType="send"
              numberOfLines={1}
            />
          </View>
          <VoiceInput
            onCapture={handleVoiceCapture}
            onPartialResult={setInput}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLogo: {
    width: 98,
    height: 30,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },

  messagesList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingBottom: 12,
    gap: Spacing.md,
  },
  messageFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 76,
    height: 10,
  },

  userBubbleContainer: { alignItems: 'flex-end', marginVertical: Spacing.xs },
  userBubble: {
    backgroundColor: Colors.bubbleUser,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: '80%',
  },
  userText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: '#FFFFFF',
    lineHeight: 22,
  },

  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    marginTop: 2,
    overflow: 'hidden',
  },
  botAvatarImage: {
    width: 36,
    height: 36,
    marginTop: 2,
  },
  botContent: { flex: 1, gap: Spacing.xs },
  cardsContainer: {
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  botBubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderTopLeftRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignSelf: 'flex-start',
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  botText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 22,
  },

  actionsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  quickActionsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  quickActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.bgCard,
  },
  quickActionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
});
