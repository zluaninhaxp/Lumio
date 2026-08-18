/**
 * Testes de SINCRONIZAÇÃO entre Tarefas e Calendário.
 *
 * O store real (`src/store/index.ts`) é zustand + importações react-expo
 * pesadas, não adequado para rodar direto em `node --test`. Estes testes
 * exercitam a LÓGICA PURA de sincronização (a mesma que vive no store)
 * sobre arrays planos, reproduzindo fielmente as regras das seções 5-11
 * da especificação.
 *
 * Se você alterar a lógica no store, espelhe aqui. O objetivo é garantir
 * que as regras (conclusão bidirecional, edição de data, exclusão sem
 * órfãos, idempotência) permaneçam consistentes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CalendarEvent, Task } from '../index.ts';

interface State {
  tasks: Task[];
  events: CalendarEvent[];
}

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Espelha `calendarizeTask` do store — idempotente. */
function calendarizeTask(
  state: State,
  taskId: string,
  calendar: { date: string; time?: string | null; deadline?: boolean; eventType?: string }
): State {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return state;
  if (task.calendarEventId) return state; // idempotente
  if (state.events.some((e) => e.taskId === taskId)) return state;
  const calendarEventId = newId('cal_task_');
  const event: CalendarEvent = {
    id: calendarEventId,
    date: calendar.date,
    time: calendar.time ?? null,
    description: task.description,
    done: task.done,
    type: 'task',
    eventType: calendar.eventType,
    taskId,
    source: 'task',
    deadline: calendar.deadline ? true : undefined,
  };
  return {
    events: [...state.events, event],
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, calendarEventId } : t)),
  };
}

/** Espelha `addTask` + `calendarizeTask` do store. */
function addTaskWithCalendar(
  state: State,
  partial: Omit<Task, 'id'>,
  calendar?: { date: string; time?: string | null; deadline?: boolean; eventType?: string }
): State {
  const id = newId('task_');
  const task: Task = { ...partial, id };
  let tasks = [task, ...state.tasks];
  let events = state.events;
  if (calendar && task.dueDate) {
    const afterAdd: State = { tasks, events };
    const synced = calendarizeTask(afterAdd, id, calendar);
    tasks = synced.tasks;
    events = synced.events;
  }
  return { tasks, events };
}

/** Espelha `toggleTask` do store — sincroniza evento derivado. */
function toggleTask(state: State, id: string): State {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  const newDone = !task.done;
  const tasks = state.tasks.map((t) => (t.id === id ? { ...t, done: newDone } : t));
  let events = state.events;
  if (task.calendarEventId) {
    events = events.map((e) => (e.id === task.calendarEventId ? { ...e, done: newDone } : e));
  }
  return { tasks, events };
}

/** Espelha `toggleEvent` do store — sincroniza tarefa vinculada. */
function toggleEvent(state: State, id: string): State {
  const event = state.events.find((e) => e.id === id);
  if (!event) return state;
  const newDone = !event.done;
  const events = state.events.map((e) => (e.id === id ? { ...e, done: newDone } : e));
  let tasks = state.tasks;
  if (event.source === 'task' && event.taskId) {
    const task = state.tasks.find((t) => t.id === event.taskId);
    if (task && task.done !== newDone) {
      tasks = tasks.map((t) => (t.id === event.taskId ? { ...t, done: newDone } : t));
    }
  }
  return { tasks, events };
}

/** Espelha `updateTask` do store — propaga data/descrição/done ao evento. */
function updateTask(state: State, id: string, updates: Partial<Omit<Task, 'id'>>): State {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  const next = { ...task, ...updates, id } as Task;
  let events = state.events;
  if (next.calendarEventId) {
    events = events.map((e) => {
      if (e.id !== next.calendarEventId) return e;
      if (e.source !== 'task') return e;
      const patches: Partial<CalendarEvent> = {};
      if (updates.dueDate !== undefined) patches.date = updates.dueDate ?? e.date;
      if (updates.description !== undefined) patches.description = updates.description;
      if (updates.done !== undefined) patches.done = updates.done;
      if (Object.keys(patches).length === 0) return e;
      return { ...e, ...patches } as CalendarEvent;
    });
  }
  return { tasks: state.tasks.map((t) => (t.id === id ? next : t)), events };
}

/** Espelha `removeTask` do store — remove evento derivado (source='task'). */
function removeTask(state: State, id: string): State {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  let events = state.events;
  if (task.calendarEventId) {
    const linked = state.events.find((e) => e.id === task.calendarEventId);
    if (linked && linked.source === 'task') {
      events = events.filter((e) => e.id !== task.calendarEventId);
    }
  }
  return { tasks: state.tasks.filter((t) => t.id !== id), events };
}

function emptyState(): State {
  return { tasks: [], events: [] };
}

// ─── Teste 1: criar tarefa com data gera evento vinculado ────────────
test('Teste 1 — criar tarefa com data cria CalendarEvent vinculado', () => {
  const s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento',
    done: false,
    dueDate: '2026-08-20',
    priority: 'media',
    subtasks: [],
    tags: [],
    createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  assert.equal(s.tasks.length, 1);
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].source, 'task');
  assert.equal(s.events[0].taskId, s.tasks[0].id);
  assert.equal(s.tasks[0].calendarEventId, s.events[0].id);
});

// ─── Teste 2: concluir tarefa -> evento concluído, permanece visível ──
test('Teste 2 — concluir tarefa marca evento done e NÃO o remove', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  s = toggleTask(s, s.tasks[0].id);
  assert.equal(s.tasks[0].done, true);
  assert.equal(s.events.length, 1); // permanece
  assert.equal(s.events[0].done, true);
});

// ─── Teste 3: concluir evento derivado -> tarefa concluída ────────────
test('Teste 3 — concluir evento derivado conclui a tarefa vinculada', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  s = toggleEvent(s, s.events[0].id);
  assert.equal(s.events[0].done, true);
  assert.equal(s.tasks[0].done, true);
});

// ─── Teste 4: editar data da tarefa -> evento acompanha ───────────────
test('Teste 4 — alterar dueDate da tarefa reflete no evento', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  s = updateTask(s, s.tasks[0].id, { dueDate: '2026-08-22' });
  assert.equal(s.tasks[0].dueDate, '2026-08-22');
  assert.equal(s.events[0].date, '2026-08-22');
});

// ─── Teste 5: editar título da tarefa -> evento derivado acompanha ────
test('Teste 5 — alterar description da tarefa reflete no evento derivado', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  s = updateTask(s, s.tasks[0].id, { description: 'Comprar cimento para obra da Rua X' });
  assert.equal(s.events[0].description, 'Comprar cimento para obra da Rua X');
});

// ─── Teste 6: excluir tarefa -> nenhum evento órfão ───────────────────
test('Teste 6 — excluir tarefa remove o evento derivado (sem órfãos)', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  const taskId = s.tasks[0].id;
  s = removeTask(s, taskId);
  assert.equal(s.tasks.length, 0);
  assert.equal(s.events.length, 0);
});

// ─── Teste 7: simular recarga — relacionamento permanece ──────────────
test('Teste 7 — estado serializado mantém vínculo task↔event', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  // Simula persistência + reload: clonamos via JSON.
  const reloaded: State = JSON.parse(JSON.stringify(s));
  assert.equal(reloaded.tasks[0].calendarEventId, reloaded.events[0].id);
  assert.equal(reloaded.events[0].taskId, reloaded.tasks[0].id);
});

// ─── Teste 8: idempotência — chamar calendarizeTask 2x não duplica ────
test('Teste 8 — calendarize chamado 2x não cria duplicata', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'Comprar cimento', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  const before = s.events.length;
  const taskId = s.tasks[0].id;
  // Tentar calendarizar de novo a mesma tarefa — a função respeita
  // `task.calendarEventId` já preenchido e NÃO cria novo evento.
  s = calendarizeTask(s, taskId, { date: '2026-08-20' });
  assert.equal(s.events.length, before);
});

// ─── Teste 9: evento independente não cria tarefa ─────────────────────
test('Teste 9 — evento independente (source=chat) não cria tarefa', () => {
  const event: CalendarEvent = {
    id: newId('cal_'), date: '2026-08-20', time: null,
    description: 'Aniversário da minha mãe', done: false, type: 'event',
    eventType: undefined, source: 'chat',
  };
  const s: State = { tasks: [], events: [event] };
  assert.equal(s.tasks.length, 0);
  assert.equal(s.events[0].source, 'chat');
  assert.equal(s.events[0].taskId, undefined);
});

// ─── Teste 10: tarefa sem data NÃO tem evento obrigatório ─────────────
test('Teste 10 — tarefa sem data não cria evento', () => {
  const s = addTaskWithCalendar(emptyState(), {
    description: 'Pensar no planejamento', done: false, dueDate: null,
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  });
  assert.equal(s.tasks.length, 1);
  assert.equal(s.events.length, 0);
  assert.equal(s.tasks[0].calendarEventId, undefined);
});

// ─── Teste 11: deadline marcado no evento ─────────────────────────────
test('Teste 11 — tarefa com prazo gera evento com deadline=true', () => {
  const s = addTaskWithCalendar(emptyState(), {
    description: 'Pagar funcionário', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20', deadline: true });
  assert.equal(s.events[0].deadline, true);
});

// ─── Teste 12: tarefa com horário -> evento respeita horário ──────────
test('Teste 12 — tarefa com horário gera evento com time', () => {
  const s = addTaskWithCalendar(emptyState(), {
    description: 'Ligar pro João', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20', time: '10:00' });
  assert.equal(s.events[0].time, '10:00');
});

// ─── Extra: loop infinito NÃO ocorre (snapshot atômico) ───────────────
test('Extra — toggleTask depois toggleEvent não causa loop', () => {
  let s = addTaskWithCalendar(emptyState(), {
    description: 'X', done: false, dueDate: '2026-08-20',
    priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString(),
  }, { date: '2026-08-20' });
  const taskId = s.tasks[0].id;
  const eventId = s.events[0].id;
  s = toggleTask(s, taskId);
  assert.equal(s.tasks[0].done, true);
  assert.equal(s.events[0].done, true);
  // Agora toggleEvent: newDone=false (reabrir). Tarefa também reabre.
  s = toggleEvent(s, eventId);
  assert.equal(s.events[0].done, false);
  assert.equal(s.tasks[0].done, false);
  // Seguir alternando não cria eventos novos.
  assert.equal(s.events.length, 1);
});

// ─── Extra: evento independente NÃO é sobrescrito por updateTask ──────
test('Extra — evento manual (source=manual) não é sobrescrito pela tarefa', () => {
  let s = emptyState();
  // Cenário artificial: uma tarefa com calendarEventId apontando para um
  // evento manual (situação não esperada, mas defensiva).
  const manualEvent: CalendarEvent = {
    id: 'cal_manual_1', date: '2026-08-20', time: null,
    description: 'Aniversário da empresa', done: false, type: 'event',
    source: 'manual',
  };
  s.events = [manualEvent];
  s.tasks = [{
    id: 'task_1', description: 'Comprar cimento', done: false,
    dueDate: '2026-08-20', priority: 'media', subtasks: [], tags: [],
    createdAt: new Date().toISOString(), calendarEventId: 'cal_manual_1',
  }];
  s = updateTask(s, 'task_1', { description: 'Comprar cimento E areia' });
  // Evento manual NÃO deve ter sua descrição sobrescrita.
  assert.equal(s.events[0].description, 'Aniversário da empresa');
});
