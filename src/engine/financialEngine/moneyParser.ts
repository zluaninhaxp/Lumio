/**
 * Extração de VALOR monetário (seções 7/8/9 da especificação).
 *
 * Reconhece: "100", "100 reais", "R$ 100", "R$100", "100,00", "100.00",
 * "1.500", "1.500,00", "1500", "mil", "dois mil", "2 mil", "2k", "300
 * conto", "quinhentos reais".
 *
 * NÃO interpreta números de data ("dia 20", "20/08"), horário ("às 15h"),
 * anos, parcelas ("3x"/"três vezes") nem quantidade ("10 sacos") como
 * dinheiro — cada candidato carrega a classificação para o consumidor
 * decidir (regra: não inventar valor).
 */
import { QUANTITY_UNITS } from './dictionaries.ts';

export interface MoneyCandidate {
  amount: number;
  raw: string;
  /** Índice do token inicial (texto tokenizado por espaço, lower). */
  tokenIndex: number;
  /** Quantos tokens o candidato consome. */
  tokenLength: number;
  /** Tem marcador explícito de moeda (R$, reais, conto, mil, k). */
  strong: boolean;
}

export interface QuantityCandidate {
  value: number;
  tokenIndex: number;
}

/** Números por extenso usados em valores. */
const WORD_NUM: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80,
  noventa: 90, cem: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500,
  quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900,
  novecentas: 900, mil: 1000,
};

/** Converte número em formato BR ("1.500,00") para number. */
export function parseBRNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    // "100.00" (2 casas) -> decimal; "1.500" / "1.500.000" -> milhar.
    if (parts.length === 2 && parts[1].length === 2) return parseFloat(parts.join('.'));
    return parseFloat(parts.join(''));
  }
  return parseFloat(cleaned);
}

const DATE_RE = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/;
const TIME_RE = /^\d{1,2}h\d{0,2}$/;
const YEAR_RE = /^(19|20)\d{2}$/;
/** Número imediatamente após estas palavras NÃO é dinheiro. */
const NUMBER_CONTEXT_DENY_BEFORE = new Set(['dia', 'dias', 'às', 'as', 'parcelas', 'parcela', 'x', 'vezes', 'ano', 'mes', 'mês', 'hora', 'horas']);

interface ScanResult {
  money: MoneyCandidate[];
  quantity: QuantityCandidate[];
  installments: number | null;
}

/**
 * Varre os tokens (lowercase, normalizados) e classifica os números.
 * Devolve candidatos de dinheiro (com força), quantidades ("10 sacos") e
 * parcelamento ("em 3x" / "três vezes").
 *
 * NOTA: a normalização remove "." (pontuação), o que quebra "1.500" em
 * "1" "500". Antes da varredura, remontamos milhares separados
 * (dígito-1ou2-3casas + dígito3) de volta em um único token.
 */
export function scanMoneyTokens(rawTokens: string[]): ScanResult {
  const tokens = rejoinThousands(rawTokens);
  const money: MoneyCandidate[] = [];
  const quantity: QuantityCandidate[] = [];
  let installments: number | null = null;
  const n = tokens.length;

  for (let i = 0; i < n; i++) {
    const t = tokens[i];

    // ── Parcelas: "em 3x" | "3x" | "em três vezes" | "parcelado em 3"
    const mInst = t.match(/^(\d+)x$/) ?? null;
    if (mInst) { installments = Number(mInst[1]); continue; }
    if ((t === 'x' || t === 'vezes') && i > 0) {
      const prev = tokens[i - 1];
      const prevNum = /^\d+$/.test(prev) ? Number(prev) : WORD_NUM[prev];
      if (prevNum !== undefined && prevNum > 0 && prevNum <= 48) {
        installments = prevNum;
        // remove o número já registrado como dinheiro/quantidade
        removeLastAt(money, quantity, i - 1);
        continue;
      }
    }
    if (t === 'parcelas' && i > 0 && /^\d+$/.test(tokens[i - 1])) {
      installments = Number(tokens[i - 1]);
      removeLastAt(money, quantity, i - 1);
      continue;
    }

    // ── "R$ 1.500,00" / "R$100" / "R$ 2 mil"
    if (t === 'r$' || /^r\$[\d.,]/.test(t)) {
      const inline = t.match(/^r\$([\d.,]+)$/);
      const valueTok = inline ? inline[1] : tokens[i + 1];
      const value = parseBRNumber(valueTok ?? '');
      if (value !== null && Number.isFinite(value)) {
        let consumed = inline ? 1 : 2;
        let amount = value;
        if ((tokens[i + consumed] ?? '') === 'mil') {
          amount = value * 1000;
          consumed += 1;
        }
        money.push({ amount, raw: `${t} ${valueTok ?? ''}`.trim(), tokenIndex: i, tokenLength: consumed, strong: true });
        i += consumed - 1;
        continue;
      }
    }

    // ── "2 mil" / "dois mil"
    const base = WORD_NUM[t] ?? (/^\d+(?:[.,]\d+)?$/.test(t) ? parseBRNumber(t) : null);
    if (base !== null && Number.isFinite(base) && (tokens[i + 1] ?? '') === 'mil') {
      money.push({ amount: base * 1000, raw: `${t} mil`, tokenIndex: i, tokenLength: 2, strong: true });
      i += 1;
      continue;
    }
    const mK = t.match(/^(\d+(?:[.,]\d+)?)k$/i);
    if (mK) {
      const v = parseBRNumber(mK[1]);
      if (v !== null) {
        money.push({ amount: v * 1000, raw: t, tokenIndex: i, tokenLength: 1, strong: true });
        continue;
      }
    }
    if (/^k$/i.test(tokens[i + 1] ?? '') && /^\d+(?:[.,]\d+)?$/.test(t)) {
      const v = parseBRNumber(t);
      if (v !== null) {
        money.push({ amount: v * 1000, raw: `${t} k`, tokenIndex: i, tokenLength: 2, strong: true });
        i += 1;
        continue;
      }
    }

    // ── "mil" sozinho = 1000 (sem número antes)
    if (t === 'mil' && !isNumberish(tokens[i - 1]) && !WORD_NUM[tokens[i - 1] ?? '']) {
      money.push({ amount: 1000, raw: 'mil', tokenIndex: i, tokenLength: 1, strong: true });
      continue;
    }

    // ── número + gíria: "300 conto(s)" / "500 reais" / "100 pila(s)"
    if (isNumberish(t) || WORD_NUM[t] !== undefined) {
      const slang = tokens[i + 1] ?? '';
      const next2 = tokens[i + 2] ?? '';
      if (['conto', 'contos', 'pila', 'pilas', 'mingau'].includes(slang)) {
        const v = WORD_NUM[t] ?? parseBRNumber(t);
        if (v !== null) {
          money.push({ amount: v, raw: `${t} ${slang}`, tokenIndex: i, tokenLength: 2, strong: true });
          i += 1;
          continue;
        }
      }
      if (slang === 'reais' || (slang === 'mil' && next2 === 'reais')) {
        // número puro + "reais" = forte
        if (slang === 'reais') {
          const v = WORD_NUM[t] ?? parseBRNumber(t);
          if (v !== null) {
            money.push({ amount: v, raw: `${t} reais`, tokenIndex: i, tokenLength: 2, strong: true });
            i += 1;
            continue;
          }
        }
      }
    }

    // ── centenas por extenso + reais ("quinhentos reais")
    if (WORD_NUM[t] !== undefined && (tokens[i + 1] ?? '') === 'reais') {
      money.push({ amount: WORD_NUM[t], raw: `${t} reais`, tokenIndex: i, tokenLength: 2, strong: true });
      i += 1;
      continue;
    }

    // ── número puro: classificar dinheiro-fraco vs quantidade vs excluído
    if (/^\d+(?:[.,]\d+)?$/.test(t)) {
      if (isExcludedNumber(tokens, i)) continue;
      const next = tokens[i + 1] ?? '';
      if (QUANTITY_U.has(next)) {
        quantity.push({ value: parseBRNumber(t) ?? 0, tokenIndex: i });
        continue;
      }
      money.push({ amount: parseBRNumber(t) ?? 0, raw: t, tokenIndex: i, tokenLength: 1, strong: false });
      continue;
    }

    // ── "20/08", "15h" — apenas ignorar (exclusão implícita)
  }

  return { money, quantity, installments };
}

const QUANTITY_U = QUANTITY_UNITS;

function isExcludedNumber(tokens: string[], i: number): boolean {
  const t = tokens[i];
  // datas "20/08" | horário "15h" | horário remontado "15:30"
  if (DATE_RE.test(t) || TIME_RE.test(t) || /^\d{1,2}:\d{2}$/.test(t)) return true;
  // anos: "2000" só é excluído como ANO quando vem depois de marcador
  // temporal ("em 2025", "dia 2025"? improvável) — sozinho pode ser valor.
  const prev = tokens[i - 1] ?? '';
  if (YEAR_RE.test(t) && (prev === 'em' || prev === 'ano' || prev === 'desde')) return true;
  // "dia 20", "às 15"
  if (NUMBER_CONTEXT_DENY_BEFORE.has(prev)) return true;
  // "20 de agosto" (dia N de mês)
  if ((tokens[i + 1] ?? '') === 'de' && MONTH_WORDS.has(tokens[i + 2] ?? '')) return true;
  return false;
}

const MONTH_WORDS = new Set([
  'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]);

/**
 * Reconstitui números quebrados pela normalização (que remove "." e ":"):
 *  - milhar BR: "1.500" -> ["1","500"] -> "1500";
 *  - horário: "15:30" -> ["15","30"] (após "às/as") — marcado como tempo.
 */
function rejoinThousands(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    // horário "à(s) 15 30"
    if ((t === 'às' || t === 'as') && /^\d{1,2}$/.test(next ?? '') && /^\d{2}$/.test(tokens[i + 2] ?? '') && !/^\d{3}$/.test(tokens[i + 2] ?? '')) {
      out.push(t, `${next}:${tokens[i + 2]}`);
      i += 2;
      continue;
    }
    if (
      /^\d{1,3}$/.test(t) && /^\d{3}$/.test(next ?? '') &&
      !isJoinDenyToken(tokens[i + 2])
    ) {
      out.push(t + next);
      i++;
    } else {
      out.push(t);
    }
  }
  return out;
}

/** Contextos em que "1 500" NÃO deve ser reunido (ex.: "às 1 500"? raro; datas "20 08"). */
function isJoinDenyToken(t: string | undefined): boolean {
  if (t === undefined) return false;
  // "20 08 de agosto" já é impedido pelo 3-dígitos do segundo token.
  return QUANTITY_UNITS.has(t) || t === 'h' || t === 'horas' || t === 'anos';
}

function isNumberish(t: string | undefined): boolean {
  return !!t && /^\d+(?:[.,]\d+)?$/.test(t);
}

function removeLastAt(money: MoneyCandidate[], quantity: QuantityCandidate[], tokenIndex: number): void {
  const mi = money.findIndex((m) => m.tokenIndex === tokenIndex);
  if (mi >= 0) money.splice(mi, 1);
  const qi = quantity.findIndex((q) => q.tokenIndex === tokenIndex);
  if (qi >= 0) quantity.splice(qi, 1);
}

export interface PickedAmount {
  amount: number | null;
  computed: boolean;
  quantity: number | null;
}

/**
 * Escolhe o valor da movimentação dentre os candidatos do fragmento.
 *
 * Prioridade (seção 8): candidatos fortes > número após "por/de/em" >
 * número fraco único. "N1 por N2 cada" -> total = N1*N2 (aritmética
 * segura e explícita). Com múltiplos fracos sem desambiguador, prefere o
 * que segue "por" (quantidade vem antes); persistindo a ambiguidade,
 * devolve o MAIOR? NÃO — devolve null (não inventa).
 */
export function pickAmount(
  rawTokens: string[],
  scan: ScanResult
): PickedAmount {
  const tokens = rejoinThousands(rawTokens);
  const { money, quantity } = scan;
  if (money.length === 0) return { amount: null, computed: false, quantity: quantity.length ? quantity[0].value : null };

  // "5 peças por 100 cada" -> 500 (só quando a aritmética é explícita).
  const hasEach = tokens.some((t) => t === 'cada' || t === 'unitário' || t === 'unitario');
  if (hasEach && money.length >= 1 && quantity.length >= 1) {
    const unit = money[money.length - 1].amount;
    const q = quantity[0].value;
    if (q > 0 && q <= 10000 && unit > 0) {
      return { amount: Math.round(q * unit * 100) / 100, computed: true, quantity: q };
    }
  }

  // forte único
  const strong = money.filter((m) => m.strong);
  if (strong.length === 1) return { amount: strong[0].amount, computed: false, quantity: quantity.length ? quantity[0].value : null };
  if (strong.length > 1) {
    const afterPor = strong.find((m) => isValueLead(tokens, m.tokenIndex));
    return { amount: (afterPor ?? strong[0]).amount, computed: false, quantity: quantity.length ? quantity[0].value : null };
  }

  // só fracos: prefere o que vem depois de "por"/"no"/"na" (valor), senão o único
  const afterPor = money.find((m) => isValueLead(tokens, m.tokenIndex));
  if (afterPor) return { amount: afterPor.amount, computed: false, quantity: quantity.length ? quantity[0].value : null };
  if (money.length === 1) return { amount: money[0].amount, computed: false, quantity: quantity.length ? quantity[0].value : null };

  // vários fracos sem desambiguação -> não inventa
  return { amount: null, computed: false, quantity: quantity.length ? quantity[0].value : null };
}

/** O token antes do valor é marcador de valor ("por", "de", "em", "no", "na")? */function isValueLead(tokens: string[], tokenIndex: number): boolean {
  const prev = tokens[tokenIndex - 1] ?? '';
  return ['por', 'de', 'em', 'no', 'na', 'nos', 'nas'].includes(prev);
}
