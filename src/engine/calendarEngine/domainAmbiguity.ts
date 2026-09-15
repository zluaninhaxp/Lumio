import { resolveTemporal } from './calendarParser.ts';
import type { CalendarParseResult } from './types.ts';
import type { TaskParseResult } from '../taskEngine/types.ts';

export interface TaskEventAmbiguity {
  type: 'task_or_event';
  sourceText: string;
  candidatePhrase: string;
  date: string;
  time: string | null;
  options: { label: 'Tarefa' | 'Evento'; value: 'task' | 'event' }[];
}

export function buildTaskEventAmbiguity(
  text: string,
  task: TaskParseResult,
  calendar: CalendarParseResult,
  now: Date,
): TaskEventAmbiguity | null {
  const temporal = resolveTemporal(calendar.normalized.tokens, now).resolution;
  if (!temporal.dueDate && !temporal.dueTime) return null;

  const taskConfident = task.intent === 'create_task' && task.tasks.some((item) => item.confidence >= 0.5);
  const calendarConfident = calendar.intent !== 'none' && calendar.confidence >= 0.45;
  if (taskConfident || calendarConfident) return null;

  return {
    type: 'task_or_event',
    sourceText: text,
    candidatePhrase: text,
    date: temporal.dueDate ?? toDateISO(now),
    time: temporal.dueTime,
    options: [{ label: 'Tarefa', value: 'task' }, { label: 'Evento', value: 'event' }],
  };
}

function toDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
