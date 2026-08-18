/**
 * Resolução de TAGS contra o contexto real do usuário.
 *
 * Combina `taskTags` (do onboarding) e `customTaskTags` consolidados no store
 * (chegam aqui como `taskTags`) com o `keywordMap` (palavra/expressão -> tag).
 *
 * Política de segurança (seção 19): melhor NÃO adicionar uma tag do que
 * adicionar uma completamente errada. Matcheamos palavra exata, plural
 * simples e variação de acento — sem associação extremamente agressiva.
 *
 * Dicionário de SINÔNIMOS (ver `SYNONYM_TO_KEYWORD`): o usuário fala
 * "ajudante" mas a keyword do onboarding é "funcionário"; fala "pagar"
 * mas a keyword é "pagamento". Mapeamos termos informais comuns para
 * palavras que provavelmente estão no keywordMap ou nas próprias labels
 * das tags, e então o fluxo normal de matching se aplica. Isso NÃO
 * inventa tags — só amplia as chances de uma tag real casar.
 */
import { stripAccents } from './normalize.ts';

interface TagMatchConfig {
  taskTags: string[];
  keywordMap: Record<string, string>;
}

/**
 * Normaliza para matching: lowercase + sem acentos + remove plural simples
 * (s final) para robustez contra "cimento"/"cimentos".
 */
function norm(s: string): string {
  return stripAccents(s.toLowerCase().trim()).replace(/s$/, '');
}

function normKeep(s: string): string {
  return stripAccents(s.toLowerCase().trim());
}

/**
 * Sinônimos informais -> palavra "canônica" que pode estar no keywordMap
 * ou em alguma label de tag. O objetivo é cobrir o vocabulário do dia a
 * dia do usuário brasileiro pequeno empresário ("ajudante", "pedreiro",
 * "diarista", "pagar", "comprar", etc.) sem depender de o onboarding ter
 * listado cada sinônimo explicitamente.
 *
 * O mapeamento NÃO cria tags — apenas injeta a palavra canônica no texto
 * de busca para que o matching normal (keywordMap + label direta) casue.
 * Assim, se a tag "Financeiro" tem keyword "pagamento" e o usuário diz
 * "pagar o ajudante", injetamos "pagamento" e "funcionario" no texto,
 * permitindo que "Financeiro" case (se existir).
 *
 * Mantenha essa tabela PEQUENA e conservadora — só sinônimos óbvios.
 */
const SYNONYM_TO_KEYWORD: Record<string, string[]> = {
  // pessoas / cargos informais
  'ajudante': ['funcionario', 'funcionários', 'equipe'],
  'pedreiro': ['funcionario', 'equipe', 'obra'],
  'eletricista': ['funcionario', 'equipe', 'obra'],
  'encanador': ['funcionario', 'equipe', 'obra'],
  'diarista': ['funcionario', 'equipe'],
  'secretaria': ['funcionario', 'equipe'],
  'vendedor': ['funcionario', 'equipe', 'vendas'],
  'cara': ['funcionario', 'pessoa'],
  // ações financeiras
  'pagar': ['pagamento', 'financas', 'financeiro'],
  'paguei': ['pagamento', 'financas'],
  'salario': ['pagamento', 'financas', 'funcionários'],
  'aluguel': ['pagamento', 'financas'],
  'conta': ['pagamento', 'financas'],
  'imposto': ['financas', 'impostos'],
  'cobranca': ['financas', 'cobrança'],
  'cobrar': ['cobrança', 'financas'],
  // compras / estoque
  'comprar': ['compra', 'reposição', 'compras', 'estoque'],
  'comprei': ['compra', 'compras'],
  'compra': ['compras', 'reposição'],
  'pegar': ['compra', 'buscar'],
  'buscar': ['compra', 'entrega'],
  'retirar': ['compra', 'entrega'],
  'estoque': ['reposição', 'estoque'],
  'acabando': ['reposição', 'estoque'],
  // clientes / fornecedores
  'fornecedor': ['fornecedores', 'contato com fornecedor'],
  'cliente': ['clientes', 'pendência com cliente'],
  'pendência': ['pendência com cliente', 'clientes'],
  'pendencia': ['pendência com cliente', 'clientes'],
  // obra / serviço
  'obra': ['obras', 'serviço'],
  'reforma': ['obras', 'serviço'],
  'servico': ['serviço', 'obras'],
  'serviço': ['serviço', 'obras'],
  // orçamento
  'orçamento': ['orçamentos', 'orçamento para cliente'],
  'orcamento': ['orçamentos', 'orçamento para cliente'],
  'cotação': ['orçamentos', 'cotação'],
  'cotacao': ['orçamentos', 'cotação'],
  // entrega
  'entregar': ['entrega', 'entregas'],
  'entrega': ['entregas', 'entrega'],
  'entreguei': ['entrega', 'entregas'],
  // contato / comunicação
  'ligar': ['contato', 'comunicação'],
  'liguei': ['contato', 'comunicação'],
  'telefone': ['contato', 'comunicação'],
  'chamar': ['contato', 'comunicação'],
  'mandar': ['enviar', 'contato'],
  'enviar': ['enviar', 'contato'],
  'enviei': ['enviar', 'contato'],
  'falar': ['contato', 'comunicação'],
  'conversar': ['contato', 'comunicação'],
  'reuniao': ['reuniões', 'reunião'],
  'reunião': ['reuniões', 'reunião'],
};

/** Expande o texto com sinônimos canônicos injetados (não destrutivo). */
function expandWithSynonyms(text: string): string {
  let out = text;
  const t = normKeep(text);
  for (const [syn, canonicals] of Object.entries(SYNONYM_TO_KEYWORD)) {
    const s = normKeep(syn);
    if (!s) continue;
    if (containsWord(t, s)) {
      // injeta as palavras canônicas no texto de busca (sem repetir)
      for (const c of canonicals) {
        const cn = normKeep(c);
        if (cn && !containsWord(out, cn)) {
          out = out + ' ' + cn;
        }
      }
    }
  }
  return out;
}

/**
 * Retorna as tags (labels) que se aplicam à mensagem, sem repetir.
 * Considera:
 *  - keywordMap: se a chave aparece na mensagem (word-boundary), aplica a tag
 *    mapeada (desde que ela exista em taskTags);
 *  - taskTags: se a própria label aparece na mensagem (palavra/expressão),
 *    aplica diretamente;
 *  - SINÔNIMOS: expande o texto com termos canônicos antes do matching,
 *    para cobrir vocabulário informal (ver `SYNONYM_TO_KEYWORD`).
 */
export function resolveTags(text: string, cfg: TagMatchConfig): string[] {
  const { taskTags, keywordMap } = cfg;
  const tags = taskTags && taskTags.length > 0 ? taskTags : [];
  // Expande o texto com sinônimos para ampliar o matching sem inventar tags.
  const expanded = expandWithSynonyms(text);
  const t = normKeep(expanded);

  const applied = new Set<string>();
  const apply = (tag: string) => {
    if (tag && !applied.has(tag)) applied.add(tag);
  };

  // 1) keywordMap (palavra -> tag). Só aplica se a tag existir em taskTags.
  for (const [kw, tag] of Object.entries(keywordMap)) {
    const k = normKeep(kw);
    if (!k) continue;
    if (tags.length === 0 || !tags.includes(tag)) continue; // só tags reais
    if (containsWord(t, k)) apply(tag);
  }

  // 2) taskTags diretas
  for (const tag of tags) {
    const tn = normKeep(tag);
    if (containsWord(t, tn)) apply(tag);
    // plural flexão simples
    else if (containsWord(t, tn + 's')) apply(tag);
    else if (containsWord(t, tn.replace(/s$/, ''))) apply(tag);
  }

  return [...applied];
}

function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.length <= 2) return false; // evita tag curta
  const re = new RegExp(`(^|[^\\p{L}])${escapeRegex(needle)}([^\\p{L}]|$)`, 'u');
  return re.test(haystack);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}