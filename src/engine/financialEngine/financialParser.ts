/**
 * Orquestrador do motor determinístico de FINANCEIRO.
 *
 * Pipeline (seção 40 da especificação):
 *   MENSAGEM -> NORMALIZAÇÃO -> INTENÇÃO FINANCEIRA -> VALOR ->
 *   TEMPORAL -> CONTRAPARTE -> CATEGORIA -> VALIDAÇÃO -> RESULTADO
 *
 * Reutiliza explicitamente o taskEngine (mesmo padrão do calendarEngine):
 *  - `taskEngine/normalize.ts` (normalização idempotente);
 *  - `taskEngine/temporal.ts` (datas — NÃO há segundo interpretador);
 *  - `taskEngine/personResolver.ts` (pessoas — não inventa).
 *
 * O resultado NÃO substitui o `TaskParseResult`/`CalendarParseResult`: o
 * chat orquestra os três motores. Quando o financeiro reconhece domínio
 * financeiro, ele tem PRIORIDADE (a mensagem é sobre dinheiro); tarefas e
 * calendário só participam quando a especificação manda (obrigação futura
 * = tarefa + representação temporal; "cobrar" = tarefa com valor como
 * contexto, sem entrada).
 */
import { normalizeMessage, stripAccents } from '../taskEngine/normalize.ts';
import { resolveTemporal } from '../taskEngine/temporal.ts';
import { resolvePerson } from '../taskEngine/personResolver.ts';
import { scanMoneyTokens, pickAmount } from './moneyParser.ts';
import {
  OUT_REALIZED_MARKERS, OUT_FUTURE_MARKERS,
  IN_REALIZED_MARKERS, IN_FUTURE_MARKERS,
  PAYER_3RD_PERSON_PATTERNS, FINANCIAL_NEGATION_MARKERS,
  CHARGE_TASK_MARKERS, QUERY_STARTERS,
  QUERY_INCOME_HINTS, QUERY_EXPENSE_HINTS, QUERY_RECEIVABLE_HINTS, QUERY_PAYABLE_HINTS,
  EDIT_VERBS, DELETE_VERBS, ENTRY_NOUNS,
  RECURRENCE_PATTERN, DEFAULT_FINANCE_CATEGORY_ALIASES,
} from './dictionaries.ts';
import type {
  FinancialDirection, FinancialEditRef, FinancialIntent, FinancialParseResult,
  FinancialParserContext, FinancialQuery, ParsedFinancialEntry,
} from './types.ts';
import { resolveEntity } from '../taxonomy/entityResolver.ts';
import type { GenericNode, TaxonomyDomain } from '../taxonomy/types.ts';

export const FINANCIAL_ENGINE_VERSION = '1.0.0';

/** Ponto único de entrada. */
export function parseFinancialMessage(input: string, context: FinancialParserContext): FinancialParseResult {
  const normalized = normalizeMessage(input);
  const text = normalized.text;
  const none = (reason: string): FinancialParseResult => ({
    intent: 'none', confidence: 0, entries: [], query: null, edit: null,
    recurrence: null, reason, originalText: normalized.original,
  });

  if (!text) return none('Mensagem vazia.');

  // ── 1) Negação financeira (seção 22): nunca cria movimentação ──
  const negHit = FINANCIAL_NEGATION_MARKERS.find((m) => text.includes(m));
  if (negHit) return none(`Negação financeira: "${negHit}".`);

  // ── 2) Consulta (seção 30): classificar antes de criar ──
  const query = classifyQuery(text, context);
  if (query) return {
    intent: 'query', confidence: 0.9, entries: [], query,
    edit: null, recurrence: null, reason: null, originalText: normalized.original,
  };

  // ── 3) Recorrência (seção 37): reconhecer, não lançar ──
  const recHit = text.match(RECURRENCE_PATTERN);
  if (recHit && hasFinancialVerb(text)) {
    return {
      intent: 'recurrence', confidence: 0.8, entries: [], query: null, edit: null,
      recurrence: { expression: recHit[0] }, reason: null,
      originalText: normalized.original,
    };
  }

  // ── 4) Edição/exclusão (seção 31): reconhecer, NÃO executar ──
  const edit = classifyEdit(text);
  if (edit) return {
    intent: edit.kind === 'delete' ? 'delete' : 'edit', confidence: 0.7,
    entries: [], query: null, edit, recurrence: null, reason: null,
    originalText: normalized.original,
  };

  // ── 5) Direção + tempo verbal ──
  const signal = detectDirectionAndTense(text);
  if (!signal.isFinancial) return none('Sem intenção financeira reconhecida.');

  // ── 6) Fragmentos (múltiplas movimentações — seções 34/35) ──
  const fragments = splitFinancialFragments(normalized.original);
  const entries: ParsedFinancialEntry[] = [];
  let sharedDateISO: string | null = null;
  let sharedTense: 'realized' | 'future' | null = null;
  let sharedDirection: FinancialDirection | null = null;

  for (const frag of fragments) {
    const fn = normalizeMessage(frag);
    const fragTokens = fn.tokens;
    const fragScan = scanMoneyTokens(fragTokens);
    const picked = pickAmount(fragTokens, fragScan);
    const fragSignal = detectDirectionAndTense(fn.text);
    const fragTemporal = resolveTemporal(fragTokens, context.now);

    // Herança: data/tense/direção do primeiro fragmento quando o atual é
    // ambíguo (padrão "hoje paguei X de A e Y de B").
    if (sharedDateISO === null && fragTemporal.resolution.dueDate) sharedDateISO = fragTemporal.resolution.dueDate;
    if (sharedTense === null && fragSignal.isFinancial) sharedTense = fragSignal.tense;
    if (sharedDirection === null && fragSignal.isFinancial) sharedDirection = fragSignal.direction;

    const direction: FinancialDirection | null = fragSignal.isFinancial ? fragSignal.direction : sharedDirection;
    const tense: 'realized' | 'future' | null = fragSignal.isFinancial ? fragSignal.tense : sharedTense;
    const dateISO = fragTemporal.resolution.dueDate ?? sharedDateISO;
    if (!direction || !tense) continue; // fragmento sem sinal e sem herança

    const amount = picked.amount;
    if (amount === null || amount <= 0) {
      // intenção clara mas valor ausente/ambíguo -> incomplete (seção 32)
      entries.push({
        direction, tense: tense!, amount: null, amountComputed: false,
        counterpartyName: null, counterpartyClientId: null, counterpartySupplierId: null,
        counterpartyEmployeeId: null, category: null, item: null,
        transactionDate: null, dueDate: null, status: 'pending',
        installments: fragScan.installments, quantity: picked.quantity,
        confidence: 0.4, confidenceLevel: 'baixa', originalText: frag,
      });
      continue;
    }

    const counterparty = extractCounterparty(normalized.original, fn, context);
     const categoryResolution = resolveFinancialCategory(fn.text, direction, context);
     const category = categoryResolution.genericLabel;
    const item = extractItem(fragTokens, direction);
     const confidence = computeConfidence(signal, fragSignal, picked, category, dateISO);

    entries.push({
      direction, tense,
      amount, amountComputed: picked.computed,
      ...counterparty,
       category,
       categoryId: categoryResolution.genericId,
       subcategory: categoryResolution.specificLabel,
       subcategoryId: categoryResolution.specificId,
       subcategoryCandidates: categoryResolution.specificCandidates.map((candidate) => candidate.label),
       item,
      transactionDate: tense === 'realized' ? (dateISO ?? isoToday(context.now)) : null,
      dueDate: tense === 'future' ? dateISO : null,
      status: tense === 'realized' ? (direction === 'expense' ? 'paid' : 'received') : 'pending',
      installments: fragScan.installments,
      quantity: picked.quantity,
      confidence: confidence.score,
      confidenceLevel: confidence.level,
      originalText: frag,
    });
  }

  const valid = entries.filter((e) => e.amount !== null && e.amount > 0);
  const incomplete = entries.length > 0 && valid.length === 0;

  if (entries.length === 0) {
    // verbo financeiro sem fragmento estruturável — ou cobrança (tarefa)
    if (CHARGE_TASK_MARKERS.some((m) => text.includes(m))) {
      return none('Cobrança é tarefa, não movimentação.');
    }
    return none('Não foi possível estruturar movimentação.');
  }

  if (incomplete) {
    // Sem valor: se é FUTURO/obrigação ("tenho que pagar o funcionário até
    // dia 20"), devolve `none` para o taskEngine criar a tarefa — o valor
    // não é obrigatório no domínio tarefa. Se é REALIZADO ("paguei o
    // João"), pergunta o valor (nunca lança sem valor).
    const anyFutureSignal = entries.some((e) => e.tense === 'future');
    if (anyFutureSignal) return none('Obrigação sem valor — tratar como tarefa.');
    return {
      intent: 'incomplete', confidence: 0.5, entries: [], query: null, edit: null,
      recurrence: null, reason: 'Valor não informado — perguntar ao usuário.',
      originalText: normalized.original,
    };
  }

  const anyFuture = valid.some((e) => e.tense === 'future');
  return {
    intent: anyFuture ? 'create_obligation' : 'create_transaction',
    confidence: Math.max(...valid.map((e) => e.confidence)),
    entries: valid,
    query: null, edit: null, recurrence: null, reason: null,
    originalText: normalized.original,
  };
}

// ═════════════════ DIREÇÃO E TEMPO ═════════════════

interface DirectionSignal {
  isFinancial: boolean;
  direction: FinancialDirection | null;
  tense: 'realized' | 'future' | null;
}

/**
 * Decide direção (entrada/saída) e tempo (realizado/futuro) pela
 * sobreposição de marcadores. "comprei" (realizado, saída) vence "para
 * pagar"; "vou pagar" vence "paguei" quando presente. Padrões de 3ª
 * pessoa ("o cliente pagou") convertem pagamento de terceiro em ENTRADA.
 */
export function detectDirectionAndTense(text: string): DirectionSignal {
  const outRealized = OUT_REALIZED_MARKERS.some((m) => text.includes(m));
  const outFuture = OUT_FUTURE_MARKERS.some((m) => text.includes(m));
  const inRealized = IN_REALIZED_MARKERS.some((m) => text.includes(m));
  const inFuture = IN_FUTURE_MARKERS.some((m) => text.includes(m));
  const payer3rd = PAYER_3RD_PERSON_PATTERNS.some((re) => re.test(text));

  // "o cliente pagou/vai pagar" = entrada (3ª pessoa pagando o usuário)
  const in3rdRealized = payer3rd && /\bpagou\b|\bme\s+pagaram\b|\bj[áa]\s+pagou\b/i.test(text);
  const in3rdFuture = payer3rd && /\bvai\s+pagar\b|\bv[ãa]o\s+pagar\b|\bficou\s+de\b/i.test(text);

  const outScore = (outRealized ? 1 : 0) + (outFuture ? 1 : 0);
  const inScore = (inRealized || in3rdRealized ? 1 : 0) + (inFuture || in3rdFuture ? 1 : 0);

  if (outScore === 0 && inScore === 0) return { isFinancial: false, direction: null, tense: null };

  // empate ("comprei ... para pagar depois"): 1ª pessoa realizada vence
  let direction: FinancialDirection;
  let tense: 'realized' | 'future';
  if (inScore > outScore) {
    direction = 'income';
    tense = (inRealized || in3rdRealized) ? 'realized' : 'future';
  } else if (outScore > inScore) {
    direction = 'expense';
    tense = outRealized ? 'realized' : 'future';
  } else {
    // empate exato: decide pelo padrão que aparece PRIMEIRO no texto
    const firstOut = firstIndex(text, [...OUT_REALIZED_MARKERS, ...OUT_FUTURE_MARKERS]);
    const firstIn = firstIndex(text, [...IN_REALIZED_MARKERS, ...IN_FUTURE_MARKERS]);
    const inFirst = firstIn !== null && (firstOut === null || firstIn < firstOut) || in3rdRealized || in3rdFuture;
    if (inFirst && (inRealized || inFuture || in3rdRealized || in3rdFuture)) {
      direction = 'income';
      tense = (inRealized || in3rdRealized) ? 'realized' : 'future';
    } else {
      direction = 'expense';
      tense = outRealized ? 'realized' : 'future';
    }
  }
  return { isFinancial: true, direction, tense };
}

function firstIndex(text: string, markers: string[]): number | null {
  let best: number | null = null;
  for (const m of markers) {
    const idx = text.indexOf(m);
    if (idx >= 0 && (best === null || idx < best)) best = idx;
  }
  return best;
}

// ═════════════════ FRAGMENTOS (múltiplas movimentações) ═════════════════

/**
 * Quebra "paguei 500 de gasolina e 300 de material" em fragmentos com
 * valor próprio. Split sobre o BRUTO (vírgulas são apagadas pela
 * normalização). Fragmento sem valor é anexado ao anterior (não vira
 * movimentação sozinho) — regra de não-ambiguidade da seção 34.
 */
function splitFinancialFragments(original: string): string[] {
  const parts = original
    .split(/,|;|\s+e\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [original.trim()];

  const merged: string[] = [];
  for (const part of parts) {
    const hasValue = scanMoneyTokens(normalizeMessage(part).tokens).money.length > 0;
    if (hasValue || merged.length === 0) merged.push(part);
    else merged[merged.length - 1] += ', ' + part;
  }
  // O primeiro fragmento carrega o verbo ("hoje paguei"); fragmentos
  // seguintes sem verbo herdam direção/tense via caller.
  return merged;
}

// ═════════════════ CONTRAPARTE (seção 13) ═════════════════

function extractCounterparty(
  originalFull: string,
  fragNormalized: ReturnType<typeof normalizeMessage>,
  context: FinancialParserContext
): Pick<ParsedFinancialEntry, 'counterpartyName' | 'counterpartyClientId' | 'counterpartySupplierId' | 'counterpartyEmployeeId'> {
  const empty = { counterpartyName: null, counterpartyClientId: null, counterpartySupplierId: null, counterpartyEmployeeId: null };

  // 1) Clientes reais (entrada: "recebi 500 do João" com João em clientes)
  const clientHit = matchAgainst(fragNormalized.original, context.clients);
  if (clientHit) return { counterpartyName: clientHit.name, counterpartyClientId: clientHit.id, counterpartySupplierId: null, counterpartyEmployeeId: null };

  // 2) Fornecedores reais (saída: "paguei o fornecedor Carlos")
  const supplierHit = matchAgainst(fragNormalized.original, context.suppliers);
  if (supplierHit) return { counterpartyName: supplierHit.name, counterpartyClientId: null, counterpartySupplierId: supplierHit.id, counterpartyEmployeeId: null };

  // 3) Funcionários reais ("paguei o funcionário 2 mil")
  const employeeHit = matchAgainst(fragNormalized.original, context.employees);
  if (employeeHit) return { counterpartyName: employeeHit.name, counterpartyClientId: null, counterpartySupplierId: null, counterpartyEmployeeId: employeeHit.id };

  // 4) Menção textual "do João" / "pro fornecedor" — sem inventar pessoa
  const m = fragNormalized.original.match(/(?:\bd[oa]s?\s+|\bpro\s+|\bpara\s+[oa]\s+|\bpra\s+[oa]\s+)([\p{Lu}][\p{L}'.\-]+(?:\s+[\p{Lu}][\p{L}'.\-]+){0,2})/u);
  if (m?.[1]) {
    const name = m[1].replace(/\s+(vai|vão|me|que|até|dia|em|no|na)$/i, '').trim();
    if (name.length >= 2) return { counterpartyName: name, counterpartyClientId: null, counterpartySupplierId: null, counterpartyEmployeeId: null };
  }
  const generic = fragNormalized.text.match(/\b(?:pro|para o|para a|pra o|pra a|o|a)\s+(fornecedor|funcion[áa]rio|cliente|motorista|entregador|pedreiro|ajudante)\b/);
  if (generic) {
    const label = capitalize(generic[1]);
    // singulariza rótulo genérico ("fornecedores" não; aqui sempre singular)
    return { counterpartyName: label, counterpartyClientId: null, counterpartySupplierId: null, counterpartyEmployeeId: null };
  }
  return empty;
}

function matchAgainst<T extends { id: string; name: string }>(text: string, list: ReadonlyArray<T>): T | null {
  if (list.length === 0) return null;
  const hay = stripAccents(text.toLowerCase());
  let best: { item: T; score: number } | null = null;
  for (const item of list) {
    const full = stripAccents(item.name.toLowerCase());
    const first = stripAccents(item.name.trim().split(/\s+/)[0]?.toLowerCase() ?? '');
    let score = 0;
    if (full.length >= 3 && contains(hay, full)) score = 3;
    else if (first.length >= 3 && contains(hay, first)) score = 1;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

function contains(haystack: string, needle: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}])${escapeReg(needle)}([^\\p{L}]|$)`, 'u');
  return re.test(haystack);
}

// ═════════════════ CATEGORIA (seções 10/11/12/39) ═════════════════

/**
 * Resolve a categoria contra o contexto REAL do usuário. Ordem:
 *  1. keywordMap do onboarding (se o valor for categoria financeira);
 *  2. label direto de uma categoria real citada na mensagem;
 *  3. aliases padrão (somente se o label existir no onboarding);
 *  4. null = sem categoria (NUNCA inventa).
 */
export function classifyCategory(
  text: string,
  direction: FinancialDirection,
  context: FinancialParserContext
): string | null {
  return resolveFinancialCategory(text, direction, context).genericLabel;
}

function resolveFinancialCategory(text: string, direction: FinancialDirection, context: FinancialParserContext) {
  const categories = direction === 'expense' ? context.expenseCategories : context.incomeCategories;
  const t = stripAccents(text.toLowerCase());
  if (categories.length === 0 && !context.taxonomy?.length) return emptyResolution();
  const taxonomy = direction === 'expense' ? (context.expenseTaxonomy ?? context.taxonomy) : (context.incomeTaxonomy ?? context.taxonomy);
  if (taxonomy?.length) return resolveEntity(text, `financial.${direction}` as TaxonomyDomain, taxonomy);

  // 1) keywordMap (chave na mensagem, valor é categoria real)
  for (const [kw, cat] of Object.entries(context.keywordMap)) {
    if (!categories.includes(cat)) continue;
    const k = stripAccents(kw.toLowerCase());
    if (k && contains(t, k)) return resolutionForLegacy(cat, context, 1, kw);
  }

  // 2) label direto (com plural simples)
  for (const cat of categories) {
    const cn = stripAccents(cat.toLowerCase());
    if (contains(t, cn)) return resolutionForLegacy(cat, context, 1, cat);
    if (cn.endsWith('s') && contains(t, cn.slice(0, -1))) return resolutionForLegacy(cat, context, 1, cat);
    if (!cn.endsWith('s') && contains(t, cn + 's')) return resolutionForLegacy(cat, context, 1, cat);
  }

  // 3) aliases padrão — só se a categoria existir no onboarding do usuário
  for (const [label, aliases] of Object.entries(DEFAULT_FINANCE_CATEGORY_ALIASES)) {
    if (!categories.includes(label)) continue;
    for (const alias of aliases) {
      const a = stripAccents(alias.toLowerCase());
      if (a && contains(t, a)) return resolutionForLegacy(label, context, 1, alias);
    }
  }
  return emptyResolution();
}

function emptyResolution() { return { genericId: null, genericLabel: null, specificId: null, specificLabel: null, specificCandidates: [] as { id: string; label: string; score: number }[], genericConfidence: 0, specificConfidence: null, matchedTerm: null }; }
function resolutionForLegacy(label: string, context: FinancialParserContext, confidence: number, matchedTerm: string) {
  return { ...emptyResolution(), genericId: `legacy_${slug(label)}`, genericLabel: label, genericConfidence: confidence, matchedTerm };
}
function slug(value: string): string { return stripAccents(value.toLowerCase()).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'categoria'; }

// ═════════════════ ITEM / DESCRIÇÃO ═════════════════

const STOP_ITEM = new Set([
  'paguei','gastei','comprei','recebi','vendi','entrou','caiu','de','do','da','do',
  'em','no','na','nos','nas','por','para','pra','pro','um','uma','uns','umas',
  'o','a','os','as','reais','real','r$','conto','contos','mil','k','hoje','ontem',
  'amanhã','amanha','eu','me','meu','minha','valor','de','com','às','as','e',
]);

/** Extrai o item principal ("gastei 300 de gasolina" -> "gasolina"). */
function extractItem(tokens: string[], direction: FinancialDirection): string | null {
  const clean = tokens.filter((t) => !/^\d+(?:[.,]\d+)?$/.test(t) && !STOP_ITEM.has(t) && t.length > 1);
  if (clean.length === 0) return null;
  const item = clean.slice(0, 3).join(' ');
  return item.length >= 3 ? capitalize(item) : null;
}

// ═════════════════ CONSULTAS (seção 30) ═════════════════

function classifyQuery(text: string, context: FinancialParserContext): FinancialQuery | null {
  const t = stripAccents(text.toLowerCase().trim()).replace(/\?+$/,'').replace(/\?/g, ' ');
  const isQuestion = /^(quanto|qual|como|quais|meu|minha)\b/.test(t);

  const starter = QUERY_STARTERS.find((q) => t.includes(stripAccents(q.toLowerCase())));
  if (!starter && !isQuestion) return null;
  if (!starter) return null;

  const period: FinancialQuery['period'] = /\bhoje\b/.test(t) ? 'today' : /\bm[êe]s\b|mensal/.test(t) ? 'month' : 'total';

  // categoria mencionada ("com combustível")
  let category: string | null = null;
  const catMatch = t.match(/\b(?:com|de|em|no|na)\s+([\p{L}çãéíóúâêôõ-]+)\s*\??$/u);
  if (catMatch?.[1]) {
    const word = catMatch[1];
    for (const c of context.expenseCategories) {
      const cn = stripAccents(c.toLowerCase());
      if (cn === word || cn === word + 's' || cn === word.replace(/s$/, '')) { category = c; break; }
    }
    if (!category) {
      for (const [kw, cat] of Object.entries(context.keywordMap)) {
        if (context.expenseCategories.includes(cat) && stripAccents(kw.toLowerCase()) === word) { category = cat; break; }
      }
    }
  }

  if (/maior\s+despesa/.test(t)) return { kind: 'biggest_expense', category: null, period: 'month' };
  // payable/receivable ANTES dos hints genéricos ("devo" é expense-hint)
  if (/para pagar|a pagar|pra pagar/.test(t) || (/\bdevo\b|\bdevendo\b/.test(t) && !/gastei|gastamos/.test(t))) {
    return { kind: 'payable', category: null, period: 'total' };
  }
  if (QUERY_RECEIVABLE_HINTS.some((h) => t.includes(stripAccents(h))) && /para receber|a receber|pra receber|me deve|devendo/.test(t)) {
    return { kind: 'receivable', category: null, period: 'total' };
  }
  if (QUERY_INCOME_HINTS.some((h) => t.includes(stripAccents(h)))) {
    return { kind: 'month_income', category: null, period };
  }
  if (QUERY_EXPENSE_HINTS.some((h) => t.includes(stripAccents(h)))) {
    return { kind: category ? 'category_expenses' : 'month_expenses', category, period };
  }
  if (/saldo|balan[çc]o|resumo|relat[óo]rio/.test(t)) {
    return { kind: 'balance', category: null, period: 'month' };
  }
  return { kind: 'generic', category: null, period };
}

// ═════════════════ EDIÇÃO/EXCLUSÃO (seção 31) ═════════════════

function classifyEdit(text: string): FinancialEditRef | null {
  const t = stripAccents(text.toLowerCase().trim());
  const hasEntryNoun = ENTRY_NOUNS.some((n) => t.includes(stripAccents(n)));
  const deleteHit = DELETE_VERBS.find((v) => t.startsWith(stripAccents(v.toLowerCase())) || t.includes(' ' + stripAccents(v.toLowerCase()) + ' ') || new RegExp(`^${escapeReg(stripAccents(v.toLowerCase()))}\\b`).test(t));
  const editHit = EDIT_VERBS.find((v) => t.startsWith(stripAccents(v.toLowerCase())) || new RegExp(`^${escapeReg(stripAccents(v.toLowerCase()))}\\b`).test(t));

  if (!hasEntryNoun) return null;
  if (deleteHit) return { kind: 'delete', field: 'unknown', amount: null };
  if (editHit) {
    let field: FinancialEditRef['field'] = 'unknown';
    let amount: number | null = null;
    if (/para\s+(?:r\$\s*)?[\d.,]+|valor/.test(t)) {
      field = 'amount';
      const m = t.match(/(?:para|de)\s+(?:r\$\s*)?([\d.,]+)/);
      if (m) {
        const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        if (Number.isFinite(v)) amount = v;
      }
    } else if (/categor/.test(t)) field = 'category';
    else if (/data|dia|foi (?:ontem|amanh[ãa])/.test(t)) field = 'date';
    else if (/para o|para a|pro|pra/.test(t)) field = 'counterparty';
    return { kind: 'edit', field, amount };
  }
  return null;
}

// ═════════════════ CONFIANÇA (seção 33) ═════════════════

function computeConfidence(
  global: DirectionSignal,
  frag: DirectionSignal,
  picked: { amount: number | null; computed: boolean },
  category: string | null,
  date: string | null
): { score: number; level: 'alta' | 'media' | 'baixa' } {
  let s = 0.7;
  if (picked.amount !== null && picked.amount > 0) s += 0.12;
  if (!picked.computed) s += 0.06; // valor literal é mais seguro que calculado
  if (category) s += 0.06;
  if (date) s += 0.04;
  if (frag.isFinancial && global.direction === frag.direction) s += 0.02;
  const score = Math.round(Math.min(1, s) * 100) / 100;
  const level = score >= 0.85 ? 'alta' : score >= 0.6 ? 'media' : 'baixa';
  return { score, level };
}

// ═════════════════ utilidades ═════════════════

function isoToday(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hasFinancialVerb(text: string): boolean {
  return OUT_REALIZED_MARKERS.some((m) => text.includes(m))
    || OUT_FUTURE_MARKERS.some((m) => text.includes(m))
    || IN_REALIZED_MARKERS.some((m) => text.includes(m))
    || IN_FUTURE_MARKERS.some((m) => text.includes(m));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { resolvePerson };
