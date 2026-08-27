import { AIProvider, AIProviderError, MissingApiKeyError } from './aiProvider';
import { secureKeyStorage } from '../services/secureKeyStorage';

/**
 * Implementação do `AIProvider` para o Google Gemini (REST API do Google AI
 * Studio, `generativelanguage.googleapis.com`).
 *
 * MODELO: `gemini-flash-latest` (alias de ponto-estável que sempre aponta
 * para o release vigente da família Flash — confirmado em
 * https://ai.google.dev/gemini-api/docs/models em 11/08/2026). A família
 * Flash é a única com tier realmente gratuito por requisição, o que é
 * essencial para o modelo BYOK deste app: cada usuário gera a própria chave
 * grátis no Google AI Studio e consome os próprios tokens. Esse alias
 * também evita precisar atualizar o nome do modelo conforme as versões
 * mudam (preocupação explícita na especificação do projeto).
 *
 * POR QUE SEM SDK: a chamada é `fetch` direto do cliente para a API do
 * Google, com a chave do usuário no header `x-goog-api-key`. Não passa por
 * nenhum backend nosso — restrição não-negociável da tarefa (ver cabeçalho
 * do `aiOnboardingService.ts`). NENHUMA chave de desenvolvedor fica
 * embutida aqui.
 *
 * SAÍDA EM JSON: usamos `generationConfig.responseMimeType =
 * 'application/json'` (suporte nativo do Gemini a JSON estruturado) em vez
 * de confiar só na instrução de texto do prompt. Mesmo assim, o parsing
 * defensivo em `aiOnboardingService.ts` continua ativo — o JSON mode reduz,
 * mas não elimina, a chance de vir texto extra.
 */
// Use a concrete model name. The `*-latest` aliases are not enabled for every
// API key/project and commonly result in a misleading 404/400 response.
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_LABEL = 'Google Gemini';

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** Timeout da chamada de geração (ms). O onboarding manda um prompt longo. */
const GENERATE_TIMEOUT_MS = 60_000;
/** Timeout da chamada de validação da chave (ms) — prompt mínimo. */
const TEST_TIMEOUT_MS = 20_000;

interface GeminiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GeminiSuccessBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

/** Aborta o `fetch` após `timeoutMs`, lançando AIProviderError(network). */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    // AbortError === timeout de rede. Outros erros de fetch também viram
    // 'network' — o usuário não precisa distinguir DNS de timeout.
    throw new AIProviderError('network', undefined, error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Traduz o corpo de erro do Gemini + o HTTP status em um `AIErrorKind`
 * estável para a UI. Pequena heurística porque o Gemini às vezes responde
 * 400 (não 401/403) para chave inválida, message==petição fixa.
 */
function classifyHttpError(status: number, body: GeminiErrorBody): AIProviderError {
  const message = body?.error?.message ?? '';
  const statusText = body?.error?.status ?? '';

  // Chave inválida: o Gemini responde 400 com a mensagem fixa abaixo (não
  // 401/403 como a maioria das APIs). Status alternativo 403 PERMISSION_DENIED
  // acontece quando a chave existe mas não tem acesso ao modelo.
  const looksLikeInvalidKey =
    /API key not valid/i.test(message) ||
    statusText === 'PERMISSION_DENIED' ||
    status === 401 ||
    status === 403;

  if (looksLikeInvalidKey) {
    return new AIProviderError('unauthorized', undefined, { status, body });
  }

  if (status === 402) {
    return new AIProviderError('payment-required', undefined, { status, body });
  }

  // 429 — cota do plano gratuito da própria conta Google do usuário
  // estourada. É exceção explícita da tarefa: mensagem deixa claro que é o
  // limite do plano gratuito da conta dele, não um erro do app.
  if (status === 429) {
    return new AIProviderError(
      'quota-exceeded',
      undefined,
      { status, body },
    );
  }

  // Qualquer outro erro de provedor (5xx, 400 de schema, etc.) vira
  // 'provider' para a UI não precisar enumerar casos internos do Gemini.
  return new AIProviderError('provider', undefined, { status, body });
}

/**
 * Lê a chave do usuário do secure storage. Se não houver, lança
 * `MissingApiKeyError` (não tenta chamar a rede) — a tela de celebração
 * depende disso pra decidir o caminho de simulação (ver instruções 3.2).
 */
async function requireApiKey(): Promise<string> {
  const key = await secureKeyStorage.getApiKey();
  if (!key) {
    throw new MissingApiKeyError();
  }
  return key;
}

async function callGenerateContent(
  prompt: string,
  apiKey: string,
  jsonMode: boolean,
  timeoutMs: number,
): Promise<string> {
  const endpoint = GEMINI_ENDPOINT(GEMINI_MODEL);

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      // JSON estruturado nativo do Gemini quando solicitado. No `testKey`
      // (jsonMode=false) deixamos o default (text/plain) pra não impor
      // nenhum custo de modo.
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      temperature: 0.4,
      // A taxonomia contém quatro domínios e pode ser extensa. Sem esse
      // limite o Gemini pode truncar o JSON e o parser reporta formato inválido.
      ...(jsonMode ? { maxOutputTokens: 16384 } : {}),
    },
  };

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Header moderno do Gemini; evita expor a chave na query string
        // (que apareceria em server logs, por exemplo).
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (error) {
    // Corpo não-JSON — tipicamente erro 5xx com HTML, ou gateway caído.
    throw new AIProviderError(
      'network',
      undefined,
      { status: response.status, error },
    );
  }

  if (!response.ok) {
    throw classifyHttpError(response.status, parsed as GeminiErrorBody);
  }

  const success = parsed as GeminiSuccessBody;
  const parts = success.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    // Resposta 200 mas sem candidates é incomum — tratada como formato
    // inesperado para o caller decidir reintentar.
    throw new AIProviderError('bad-format', undefined, { status: 200, body: parsed });
  }

  const text = parts.map((p) => p?.text ?? '').join('').trim();
  return text;
}

export const geminiProvider: AIProvider = {
  id: 'gemini',
  label: GEMINI_LABEL,

  async generate(prompt: string): Promise<string> {
    const apiKey = await requireApiKey();
    return callGenerateContent(prompt, apiKey, true, GENERATE_TIMEOUT_MS);
  },

  async testKey(): Promise<void> {
    const apiKey = await requireApiKey();
    // Chamada mínima e barata: prompt trivial, sem JSON mode, timeout curto.
    // Não nos importamos com o conteúdo — só validar que a chave é aceita
    // e que o modelo responde 200. Qualquer erro vira AIProviderError.
    await callGenerateContent(
      'Responda apenas com a palavra: ok',
      apiKey,
      false,
      TEST_TIMEOUT_MS,
    );
  },
};
