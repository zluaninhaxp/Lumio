/**
 * Resolução TEMPORAL determinística para o domínio de tarefas.
 *
 * Centralizada para reaproveitamento futuro pelo Calendário (ver seção 10
 * da especificação). NÃO usa datas fixas — toda referência é relativa ao
 * `now` injetado pelo contexto da aplicação.
 *
 * Suporta: hoje, amanhã, depois de amanhã, ontem, dias da semana (sexta,
 * próxima sexta), semana que vem, períodos (manhã/tarde/noite), "daqui a N
 * dias", "em N dias", "dia 20", "20/08", "20/08/2026", "20 de agosto",
 * horários ("às 15h", "às 10", "15h30"), prazos ("até sexta", "para amanhã").
 */
import { stripAccents } from './normalize.ts';

export interface TemporalResolution {
  dueDate: string | null;
  dueTime: string | null;
  expression: string | null;
  isDeadline: boolean;
}

const WEEKDAYS: Array<{ key: string; aliases: string[]; jsDay: number }> = [
  { key: 'domingo', aliases: ['domingo', 'dom', 'domingos'], jsDay: 0 },
  { key: 'segunda', aliases: ['segunda', 'segunda-feira', 'seg', 'segundas'], jsDay: 1 },
  { key: 'terca', aliases: ['terça', 'terca', 'terça-feira', 'terca-feira', 'ter', 'tercas'], jsDay: 2 },
  { key: 'quarta', aliases: ['quarta', 'quarta-feira', 'qua', 'quartas'], jsDay: 3 },
  { key: 'quinta', aliases: ['quinta', 'quinta-feira', 'qui', 'quintas'], jsDay: 4 },
  { key: 'sexta', aliases: ['sexta', 'sexta-feira', 'sex', 'sextas'], jsDay: 5 },
  { key: 'sabado', aliases: ['sábado', 'sabado', 'sáb', 'sab', 'sábados', 'sabados'], jsDay: 6 },
];

const MONTHS: Array<{ aliases: string[]; month: number }> = [
  { month: 1, aliases: ['janeiro', 'jan'] },
  { month: 2, aliases: ['fevereiro', 'fev'] },
  { month: 3, aliases: ['março', 'marco', 'mar'] },
  { month: 4, aliases: ['abril', 'abr'] },
  { month: 5, aliases: ['maio', 'mai'] },
  { month: 6, aliases: ['junho', 'jun'] },
  { month: 7, aliases: ['julho', 'jul'] },
  { month: 8, aliases: ['agosto', 'ago'] },
  { month: 9, aliases: ['setembro', 'set'] },
  { month: 10, aliases: ['outubro', 'out'] },
  { month: 11, aliases: ['novembro', 'nov'] },
  { month: 12, aliases: ['dezembro', 'dez'] },
];

const ADD_UNIT_DAYS: Record<string, number> = { dia: 1, dias: 1, semana: 7, semanas: 7, mês: 30, mes: 30, meses: 30 };
const WORD_NUM: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function clone(d: Date): Date { return new Date(d.getTime()); }
function addDays(d: Date, n: number): Date { const r = clone(d); r.setDate(r.getDate() + n); return r; }
function stripTime(d: Date): Date { const r = clone(d); r.setHours(0, 0, 0, 0); return r; }
function nextWeekday(from: Date, targetJsDay: number, includeToday: boolean): Date {
  let delta = (targetJsDay - from.getDay() + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return addDays(from, delta);
}
function startOfWeek(d: Date): Date {
  const r = stripTime(d);
  const dow = r.getDay(); // 0=dom
  return addDays(r, -dow);
}
function matchWeekday(s: string): { jsDay: number; matched: string } | null {
  for (const wd of WEEKDAYS) {
    if (wd.aliases.includes(s)) return { jsDay: wd.jsDay, matched: s };
  }
  return null;
}

/** Parse de horário: "10h", "10h30", "10:00", "10", opcionalmente "às". */
function parseTimeAt(tokens: string[], idx: number): { time: string; consumed: number } | null {
  let i = idx;
  while (i < tokens.length && (tokens[i] === 'as' || tokens[i] === 'às' || tokens[i] === 'as' || tokens[i] === 'h')) i++;
  if (i >= tokens.length) return null;
  const t = tokens[i];
  let hh = '', mm = '';
  const m1 = t.match(/^(\d{1,2})h(\d{2})?$/);
  const m2 = t.match(/^(\d{1,2}):(\d{2})$/);
  const m3 = t.match(/^(\d{1,2})$/);
  if (m1) { hh = m1[1]; mm = m1[2] ?? '00'; }
  else if (m2) { hh = m2[1]; mm = m2[2]; }
  else if (m3) { hh = m3[1]; mm = '00'; }
  else return null;
  const HH = hh.padStart(2, '0');
  if (Number(HH) > 23 || Number(mm || '0') > 59) return null;
  return { time: `${HH}:${(mm || '00').padStart(2, '0')}`, consumed: i - idx + 1 };
}

/** Helper: é um token de prazo que precede data ("até"/"para"/"antes"). */
function isDeadlineLead(t: string | undefined): boolean {
  return t === 'até' || t === 'ate' || t === 'para' || t === 'pra' || t === 'antes' || t === 'para' || t === 'pro';
}

export function resolveTemporal(tokens: string[], now: Date): { resolution: TemporalResolution; span: [number, number] | null } {
  const n = tokens.length;
  if (n === 0) return { resolution: empty(), span: null };

  // 1) "depois de amanhã" / "depois deamanha" — ANTES do loop de hoje/amanhã.
  for (let i = 0; i + 2 < n; i++) {
    if (tokens[i] === 'depois' && tokens[i + 1] === 'de' && /^amanh[ãa]$/.test(tokens[i + 2])) {
      const time = parseTimeAt(tokens, i + 3);
      if (time) return { resolution: { dueDate: toISO(addDays(now, 2)), dueTime: time.time, expression: 'depois de amanhã às ' + time.time, isDeadline: false }, span: [i, i + 3 + time.consumed] };
      return { resolution: { dueDate: toISO(addDays(now, 2)), dueTime: null, expression: 'depois de amanhã', isDeadline: false }, span: [i, i + 3] };
    }
  }
  // 1b) "depois de amanhã" onde "de amanhã" colou (tokens "depois", "de amanhã") — rare.

  // 2) "daqui a N dias/semanas/meses" / "em N <unit>" — NÃO exige fim de string.
  for (let i = 0; i < n; i++) {
    if (tokens[i] === 'daqui' || tokens[i] === 'em') {
      // "daqui a N unit" (a 3 tokens) ou "em N unit" (2 tokens)
      let j = i + 1;
      if (tokens[i] === 'daqui' && tokens[j] === 'a') j++;
      // espera número
      const numTok = tokens[j];
      const num = /^\d+$/.test(numTok) ? Number(numTok) : WORD_NUM[stripAccents(numTok ?? '')];
      const unitTok = stripAccents(tokens[j + 1] ?? '');
      const perDay = ADD_UNIT_DAYS[unitTok];
      if (num !== undefined && perDay !== undefined) {
        const days = num * perDay;
        const lead = isDeadlineLead(tokens[i - 1]);
        const time = parseTimeAt(tokens, j + 2);
        const label = tokens.slice(i, j + 1 + (time ? 0 : 0)).join(' ');
        if (time) return { resolution: { dueDate: toISO(addDays(now, days)), dueTime: time.time, expression: `${label} às ${time.time}`, isDeadline: lead }, span: [i, j + 2 + time.consumed] };
        return { resolution: { dueDate: toISO(addDays(now, days)), dueTime: null, expression: label, isDeadline: false }, span: [i, j + 2] };
      }
    }
  }

  // 3) "hoje" / "amanhã" 
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t === 'hoje') {
      const time = parseTimeAt(tokens, i + 1);
      if (time) return { resolution: { dueDate: toISO(now), dueTime: time.time, expression: `hoje às ${time.time}`, isDeadline: false }, span: [i, i + 1 + time.consumed] };
      return { resolution: { dueDate: toISO(now), dueTime: null, expression: 'hoje', isDeadline: isDeadlineLead(tokens[i - 1]) }, span: [i, i + 1] };
    }
    if (t === 'amanhã' || t === 'amanha') {
      const period = tokens[i + 1];
      const isPeriod = period && (period === 'cedo' || period === 'tarde' || period === 'noite');
      const time = parseTimeAt(tokens, i + (isPeriod ? 2 : 1));
      const date = addDays(now, 1);
      const expr = isPeriod ? `amanhã ${period}` : 'amanhã';
      if (time) return { resolution: { dueDate: toISO(date), dueTime: time.time, expression: `${expr} às ${time.time}`, isDeadline: false }, span: [i, i + (isPeriod ? 2 : 1) + time.consumed] };
      return { resolution: { dueDate: toISO(date), dueTime: null, expression: expr, isDeadline: isDeadlineLead(tokens[i - 1]) }, span: [i, i + (isPeriod ? 2 : 1)] };
    }
  }

  // 4) dia da semana, com modificador "próxima/próximo"
  for (let i = 0; i < n; i++) {
    const two = tokens.slice(i, i + 2).join(' ');
    const prox = two.match(/^(pr[óo]xima?|pr[óo]ximas?) (segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?$/);
    if (prox) {
      const wdTok = prox[2].replace(/-feira$/, '');
      const wd = matchWeekday(stripAccents(wdTok));
      if (wd) {
        const natural = nextWeekday(now, wd.jsDay, true);
        const date = sameWeek(natural, now) ? addDays(natural, 7) : natural;
        const time = parseTimeAt(tokens, i + 2);
        if (time) return { resolution: { dueDate: toISO(date), dueTime: time.time, expression: `${two} às ${time.time}`, isDeadline: false }, span: [i, i + 2 + time.consumed] };
        return { resolution: { dueDate: toISO(date), dueTime: null, expression: two, isDeadline: false }, span: [i, i + 2] };
      }
    }
    const wd = matchWeekday(stripAccents(tokens[i]).replace('-feira', ''));
    if (wd && !isDeadlineLead(tokens[i])) {
      const lead = isDeadlineLead(tokens[i - 1]);
      const date = nextWeekday(now, wd.jsDay, true);
      const time = parseTimeAt(tokens, i + 1);
      if (time) return { resolution: { dueDate: toISO(date), dueTime: time.time, expression: `${tokens[i]} às ${time.time}`, isDeadline: lead }, span: [i, i + 1 + time.consumed] };
      return { resolution: { dueDate: toISO(date), dueTime: null, expression: tokens[i], isDeadline: lead }, span: [i, i + 1] };
    }
  }

  // 5) "semana que vem" / "próxima semana" -> próxima segunda.
  for (let i = 0; i < n; i++) {
    const phrase = tokens.slice(i, i + 3).join(' ');
    if (/^(semana que vem|pr[óo]xima semana|proxima semana)$/.test(phrase)) {
      const monday = nextWeekday(now, 1, true);
      const date = sameWeek(monday, now) ? monday : monday; // já é futura
      return { resolution: { dueDate: toISO(date), dueTime: null, expression: phrase, isDeadline: false }, span: [i, i + 3] };
    }
  }

  // 6) "dia 20", "20/08", "20/08/2026", "dia 20 de agosto"
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t === 'dia' && /^\d{1,2}$/.test(tokens[i + 1] ?? '')) {
      const day = Number(tokens[i + 1]);
      let consumed = 2;
      let month: number | null = null;
      let year = now.getFullYear();
      if (tokens[i + 2] === 'de') {
        const mc = MONTHS.find((m) => m.aliases.includes(stripAccents(tokens[i + 3] ?? '').toLowerCase()) || m.aliases.includes(tokens[i + 3] ?? ''));
        if (mc) { month = mc.month; consumed = 4; if (tokens[i + 4] === 'de' && /^\d{4}$/.test(tokens[i + 5] ?? '')) { year = Number(tokens[i + 5]); consumed = 6; } }
      }
      if (month !== null) {
        return { resolution: { dueDate: toISO(buildDate(day, month, year)), dueTime: null, expression: tokens.slice(i, i + consumed).join(' '), isDeadline: isDeadlineLead(tokens[i - 1]) }, span: [i, i + consumed] };
      }
      // só "dia N" — mês corrente; se já passou, próximo mês
      const candidate = buildDate(day, now.getMonth() + 1, now.getFullYear());
      const final = stripTime(candidate) < stripTime(now) ? rolloverNextMonth(now, day) : candidate;
      return { resolution: { dueDate: toISO(final), dueTime: null, expression: `dia ${day}`, isDeadline: isDeadlineLead(tokens[i - 1]) }, span: [i, i + 2] };
    }
    if (/^\d{1,2}\/\d{1,2}(\/\d{4})?$/.test(t)) {
      const [dd, mm, yyyy] = t.split('/');
      const d = Number(dd), m = Number(mm);
      if (validDM(d, m)) return { resolution: { dueDate: toISO(buildDate(d, m, yyyy ? Number(yyyy) : now.getFullYear())), dueTime: null, expression: t, isDeadline: isDeadlineLead(tokens[i - 1]) }, span: [i, i + 1] };
    }
  }

  // 7) horário isolado
  for (let i = 0; i < n; i++) {
    const tt = parseTimeAt(tokens, i);
    if (tt) return { resolution: { dueDate: toISO(now), dueTime: tt.time, expression: `às ${tt.time}`, isDeadline: false }, span: [i, i + tt.consumed] };
  }

  return { resolution: empty(), span: null };
}

function rolloverNextMonth(now: Date, day: number): Date {
  let y = now.getFullYear();
  let m = now.getMonth() + 2;
  if (m > 12) { m = 1; y++; }
  return buildDate(day, m, y);
}
function buildDate(day: number, month: number, year: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}
function validDM(d: number, m: number): boolean { return d >= 1 && d <= 31 && m >= 1 && m <= 12; }
function sameWeek(a: Date, b: Date): boolean { return startOfWeek(a).getTime() === startOfWeek(b).getTime(); }
function empty(): TemporalResolution { return { dueDate: null, dueTime: null, expression: null, isDeadline: false }; }

export function humanizeDueDate(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  const today = stripTime(now);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff < 0) return 'Atrasada';
  return target.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}