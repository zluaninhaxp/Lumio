import { OnboardingContextDTO, OnboardingQA } from './onboardingContext';

/**
 * Mapeia cada bloco do onboarding (ver `src/data/onboardingQuestions.ts`)
 * para a seção do prompt em que ele deve entrar. Adicionar um novo bloco de
 * pergunta no futuro é só incluir o `blockId` na seção correta abaixo — o
 * prompt se atualiza sozinho, sem precisar tocar no texto do prompt em si.
 */
const SECTION_BLOCK_MAP: Record<string, string[]> = {
  perfilDoUsuario: ['visaoGeral'],
  rotina: ['rotina'],
  operacao: ['operacao'],
  dificuldades: ['dores'],
  preferencias: ['clientes'],
  restricoes: ['sazonalidade'],
  objetivos: ['objetivos'],
  prioridadeApp: ['prioridade'],
  respostasLivres: ['complemento'],
};

const SECTION_TITLES: Record<keyof typeof SECTION_BLOCK_MAP, string> = {
  perfilDoUsuario: 'PERFIL DO USUÁRIO E DO NEGÓCIO',
  rotina: 'ROTINA / OPERAÇÃO DO DIA A DIA',
  operacao: 'EQUIPE E CONTROLE FINANCEIRO',
  dificuldades: 'DIFICULDADES',
  preferencias: 'PREFERÊNCIAS (relacionamento com clientes)',
  restricoes: 'RESTRIÇÕES (sazonalidade)',
  objetivos: 'OBJETIVOS',
  prioridadeApp: 'PRIORIDADE DE USO DO APP',
  respostasLivres: 'RESPOSTAS LIVRES (complemento opcional do usuário)',
};

function formatQAList(qas: OnboardingQA[]): string {
  if (qas.length === 0) return '(não informado)';
  return qas
    .map((qa) => `- Pergunta: ${qa.question}\n  Resposta: ${qa.answer}`)
    .join('\n');
}

function buildSection(dto: OnboardingContextDTO, sectionKey: keyof typeof SECTION_BLOCK_MAP): string {
  const blockIds = SECTION_BLOCK_MAP[sectionKey];
  const qas = dto.answers.filter((qa) => blockIds.includes(qa.blockId));
  return `## ${SECTION_TITLES[sectionKey]}\n${formatQAList(qas)}`;
}

/**
 * Monta o prompt completo que será enviado ao modelo de IA no futuro.
 * Hoje esta função só monta texto — nenhuma chamada de rede acontece aqui
 * (ver `aiOnboardingService.ts` para onde a chamada real vai entrar).
 */
export function buildExtractionPrompt(dto: OnboardingContextDTO): string {
  const sections = (Object.keys(SECTION_BLOCK_MAP) as (keyof typeof SECTION_BLOCK_MAP)[])
    .map((key) => buildSection(dto, key))
    .join('\n\n');

  return `Você é um analista especializado em microempresas, responsável por transformar
relatos livres de donos de negócio em dados estruturados para configurar um
sistema de gestão chamado Lumio.

## CONTEXTO ADICIONAL
- Onboarding concluído em: ${dto.submittedAt}
- Palpite local (heurística, não confiável) de nome da empresa: ${dto.businessNameGuess}
- Palpite local (heurística, não confiável) de segmento: ${dto.businessTypeGuess}
  (estes dois campos acima são apenas um chute por palavra-chave, feito sem IA
  — priorize sempre o que você conseguir inferir diretamente das respostas)

${sections}

## SUA TAREFA
Leia todas as respostas com atenção e devolva SOMENTE um objeto JSON válido,
seguindo exatamente o schema abaixo. Não inclua nenhum texto fora do JSON,
nenhum comentário, nenhuma explicação, nenhum bloco de código markdown.

## REGRAS OBRIGATÓRIAS
- Nunca invente informação que não esteja implícita ou explícita no texto do
  usuário. Se uma informação não puder ser inferida com segurança, use o
  valor null (para campos de texto/objeto) ou [] (para listas) e adicione o
  nome do campo à lista "missingInformation".
- Diferencie inferência razoável de invenção.
- Escreva descrições e resumos em português, de forma objetiva, sem copiar
  frases inteiras do usuário — parafraseie.
- Se o usuário mencionar múltiplos produtos/serviços/dores/objetivos, liste
  todos, não escolha só um.
- Se o texto for ambíguo ou contraditório entre seções, sinalize isso em
  "conflictsOrAmbiguities" em vez de resolver silenciosamente.

## SCHEMA DE SAÍDA (JSON)
{
  "businessName": string | null,
  "segment": string | null,
  "shortDescription": string | null,
  "products": string[],
  "services": string[],
  "targetAudience": string | null,
  "operationSummary": string | null,
  "teamStructure": {
    "worksAlone": boolean | null,
    "teamSizeEstimate": string | null,
    "rolesMentioned": string[]
  },
  "currentFinancialControl": {
    "toolsUsed": string[],
    "organizationLevel": "nenhum" | "informal" | "parcialmente organizado" | "organizado" | null
  },
  "customerRelationship": {
    "hasRecurringCustomers": boolean | null,
    "followsUpWithCustomers": boolean | null,
    "notes": string | null
  },
  "painPoints": string[],
  "challenges": string[],
  "seasonality": {
    "hasSeasonalVariation": boolean | null,
    "notes": string | null
  },
  "goals": string[],
  "priorityModule": "financeiro" | "tarefas" | "agenda" | null,
  "processesToOrganize": string[],
  "recommendedModules": string[],
  "automationOpportunities": string[],
  "maturityLevel": "iniciante" | "em organização" | "estruturado" | null,
  "missingInformation": string[],
  "conflictsOrAmbiguities": string[],
  "additionalNotes": string | null
}

Responda apenas com o JSON, sem markdown, sem \`\`\`json, sem texto antes ou
depois.`;
}
