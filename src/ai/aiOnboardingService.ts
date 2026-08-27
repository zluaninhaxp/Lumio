import { OnboardingContextDTO } from './onboardingContext';
import { buildOnboardingExtractionPrompt } from '../prompts/onboardingExtraction.prompt';
import type { BusinessTaxonomy } from '../engine/taxonomy/types';
import { OnboardingExtractionResult } from './types';
import { AIProviderError, MissingApiKeyError } from './aiProvider';
import { geminiProvider } from './geminiProvider';
import { getPluginDefinition } from '../plugins/registry';

/**
 * Camada de integração REAL com IA do onboarding.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ RESTRIÇÃO NÃO-NEGOCIÁVEL DO PROJETO (BYOK — Bring Your Own Key)    │
 * │                                                                      │
 * │ A chamada ao provedor de IA é feita DIRETO do dispositivo do         │
 * │ usuário para a API do Google Gemini, usando a chave que o próprio    │
 * │ usuário cadastrou (ver `services/secureKeyStorage.ts` + tela          │
 * │ `app/ai-settings.tsx`). NENHUMA chave de API do desenvolvedor       │
 * │ (minha) fica embutida no app, em .env versionado, em variável de     │
 * │ build, ou em qualquer lugar que vá parar no bundle do cliente.      │
 * │                                                                      │
 * │ Nenhum backend próprio é usado para "repassar" a chamada — isso     │
 * │ reintroduziria o problema de custo compartilhado que o projeto       │
 * │ proíbe. A única requisição que sai do app vai direto para            │
 * │ `generativelanguage.googleapis.com` com a chave do usuário.         │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * CONTRATO INALTERADO: continua devolvendo exatamente o mesmo tipo
 * `OnboardingExtractionResult` que a heurística mock local já devolvia
 * (ver `engine/openOnboardingEngine.ts -> buildMockExtractionResult`), então
 * a tela de resumo (`app/onboarding-summary.tsx`) e o store não mudam.
 *
 * O provedor vem injetado pela interface `AIProvider` — hoje só Gemini, mas
 * a injeção mantém o resto do fluxo isolado de detalhes de transporte.
 */

/** Provedor ativo. Trocar só aqui (e adicionar um novo módulo `*Provider`). */
const aiProvider = geminiProvider;

/**
 * Remove cercas ```json ... ``` e texto extra ao redor que alguns modelos
 * às vezes devolvem mesmo em JSON mode. Também recorta para o primeiro `{`
 * e o último `}` quando não há cerca explícita — só assim `JSON.parse`
 * consegue trabalhar. Se nada for encontrado, devolve a string original.
 */
function extractJsonBlock(raw: string): string {
  let text = raw.trim();

  // Caso 1: cerca markdown explícita ```json\n...\n``` (ou ```\n...\n```).
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // Caso 2: ainda sobrou texto antes/depois — recorta do primeiro `{` ao
  // último `}`. Mesmo em JSON mode o Gemini eventualmente prefixa um
  // comentário, então mantemos o parsing defensivo exigido pela tarefa.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Valida minimamente que o objeto retornado bate com o schema de primeiro
 * nível de `OnboardingExtractionResult`. Não valida tipos aninhados em
 * profundidade (o prompt + JSON mode cuidam disso); só garante que as
 * chaves essenciais existem para a tela de resumo não quebrar.
 */
function assertValidResult(value: unknown): OnboardingExtractionResult {
  if (!value || typeof value !== 'object') {
    throw new AIProviderError('bad-format');
  }
  const v = value as Record<string, unknown>;
  if ('taxonomyVersion' in v && v.taxonomyVersion === 2 && v.domains) {
    const rawTaxonomy = value as BusinessTaxonomy;
    const domains = sanitizeDomains(rawTaxonomy.domains);
    const taxonomy: BusinessTaxonomy = {
      ...rawTaxonomy,
      domains,
      learnedTerms: Array.isArray(rawTaxonomy.learnedTerms) ? rawTaxonomy.learnedTerms : [],
    };
    return {
      businessName: taxonomy.businessName,
      segment: taxonomy.segment,
      summary: taxonomy.summary,
      taxonomy,
      coreCategories: {
        financial: {
          expense: taxonomy.domains['financial.expense'].map((n) => ({ label: n.generic.label, origin: 'mentioned' as const })),
          income: taxonomy.domains['financial.income'].map((n) => ({ label: n.generic.label, origin: 'mentioned' as const })),
        },
        taskTags: taxonomy.domains.task.map((n) => ({ label: n.generic.label, origin: 'mentioned' as const })),
        calendarEventTypes: taxonomy.domains.calendar.map((n) => ({ label: n.generic.label, origin: 'mentioned' as const })),
      },
      keywordMap: {},
      recommendedPlugins: sanitizePlugins(taxonomy.recommendedPlugins),
      missingInformation: taxonomy.missingInformation,
    };
  }
  const required = ['businessName', 'segment', 'summary', 'coreCategories', 'keywordMap', 'recommendedPlugins', 'missingInformation'];
  const missing = required.filter((k) => !(k in v));
  if (missing.length > 0) {
    throw new AIProviderError('bad-format', undefined, { missing });
  }
  const cc = v.coreCategories as Record<string, unknown> | undefined;
  if (!cc || typeof cc !== 'object' || !('financial' in cc) || !('taskTags' in cc) || !('calendarEventTypes' in cc)) {
    throw new AIProviderError('bad-format', undefined, { reason: 'coreCategories incompleto' });
  }
  const result = value as OnboardingExtractionResult;
  result.recommendedPlugins = sanitizePlugins(result.recommendedPlugins);
  return result;
}

function sanitizePlugins(value: unknown): OnboardingExtractionResult['recommendedPlugins'] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const plugin = (item as { plugin?: unknown }).plugin;
    if (typeof plugin !== 'string' || !getPluginDefinition(plugin) || seen.has(plugin)) return [];
    seen.add(plugin);
    const confidence = (item as { confidence?: unknown }).confidence;
    return [{
      plugin,
      reason: typeof (item as { reason?: unknown }).reason === 'string' ? (item as { reason: string }).reason : '',
      confidence: confidence === 'alta' || confidence === 'media' || confidence === 'baixa' ? confidence : 'baixa',
    }];
  });
}

/**
 * Ponto único de entrada do fluxo final do onboarding.
 *
 * Fluxo:
 *  1. Recebe o DTO já montado a partir das respostas (ver
 *     `onboardingContext.ts -> buildOnboardingContextDTO`).
 *  2. Monta o prompt final consumindo `buildExtractionPrompt(dto)` —
 *     texto do prompt NÃO é reescrito aqui (responsabilidade de outra etapa).
 *  3. Lê a chave do usuário do secure storage. Se não houver, NÃO chama
 *     rede — lança `MissingApiKeyError` para a tela decidir o caminho de
 *     simulação (instrução 3.2.a) em vez de mostrar um erro genérico.
 *  4. Faz a chamada HTTP direta ao Gemini via `AIProvider`.
 *  5. Faz o parsing defensivo (limpa cercas markdown, recorta braces) e
 *     valida as chaves de 1º nível antes de devolver.
 *  6. Diferencia os erros amigáveis: `MissingApiKeyError`,
 *     `AIProviderError(kind=unauthorized|quota-exceeded|payment-required|`
 *     `network|bad-format|provider|invalid-input)`. NUNCA expõe stacktrace /
 *     erro cru da API ao usuário — fica só em `error.cause` para debug.
 */
export async function extractBusinessProfile(
  dto: OnboardingContextDTO
): Promise<OnboardingExtractionResult> {
  // Validação local mínima do DTO de entrada — sem rede.
  if (!dto || !Array.isArray(dto.answers) || dto.answers.length === 0) {
    throw new AIProviderError('invalid-input');
  }

  const prompt = buildOnboardingExtractionPrompt(dto);

  let rawText: string;
  try {
    rawText = await aiProvider.generate(prompt);
  } catch (error) {
    // Reemite erros já tipados pelo provedor (MissingApiKeyError,
    // AIProviderError). Qualquer erro desconhecido vira 'provider' para a
    // UI não precisar lidar com exceções nuas.
    if (error instanceof AIProviderError) {
      throw error;
    }
    throw new AIProviderError('provider', undefined, error);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new AIProviderError('bad-format');
  }

  const jsonText = extractJsonBlock(rawText);

  try {
    return assertValidResult(JSON.parse(jsonText));
  } catch (error) {
    // A single corrective retry keeps transient model formatting errors from
    // breaking onboarding while retaining the same source-of-truth prompt.
    if (error instanceof AIProviderError && error.kind === 'bad-format') {
      try {
        const retry = await aiProvider.generate(`${prompt}\nCorrija apenas o JSON inválido retornado anteriormente. Erro: ${String(error.message)}\nJSON recebido anteriormente:\n${jsonText}`);
        return assertValidResult(JSON.parse(extractJsonBlock(retry)));
      } catch (retryError) {
        if (retryError instanceof AIProviderError) throw retryError;
        throw new AIProviderError('bad-format', undefined, retryError);
      }
    }
    throw new AIProviderError('bad-format', undefined, { error, jsonText });
  }
}

/** Remove duplicatas que o modelo pode gerar; a primeira ocorrência vence. */
function sanitizeDomains(domains: BusinessTaxonomy['domains']): BusinessTaxonomy['domains'] {
  const result = {} as BusinessTaxonomy['domains'];
  for (const domain of ['financial.expense', 'financial.income', 'task', 'calendar'] as const) {
    const nodes = Array.isArray(domains?.[domain]) ? domains[domain] : [];
    const used = new Set<string>();
    result[domain] = nodes.map((node) => ({
      ...node,
      generic: { ...node.generic, synonyms: uniqueSynonyms(node.generic?.synonyms, used) },
      specifics: (node.specifics ?? []).map((specific) => ({
        ...specific,
        synonyms: uniqueSynonyms(specific.synonyms, used),
      })),
    }));
  }
  return result;
}

function uniqueSynonyms(values: unknown, used: Set<string>): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).filter((value) => {
    const key = value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (used.has(key)) return false;
    used.add(key);
    return true;
  });
}

/** Reexporta para a tela de configurações / futura injeção multi-provedor. */
export { aiProvider };
export type { AIProvider } from './aiProvider';
export { AIProviderError, MissingApiKeyError } from './aiProvider';
