import { OnboardingContextDTO, OnboardingQA } from './onboardingContext';

/**
 * Mapeia cada bloco do onboarding (ver `src/data/onboardingQuestions.ts`)
 * para a seção do prompt em que ele deve entrar. Adicionar um novo bloco de
 * pergunta no futuro é só incluir o `blockId` na seção correta abaixo — o
 * prompt se atualiza sozinho, sem precisar tocar no texto do prompt em si.
 */
const SECTION_BLOCK_MAP: Record<string, string[]> = {
  negocioESegmento: ['negocio'],
  rotinaFinanceira: ['financas'],
  rotinaDeTarefas: ['tarefas'],
  compromissosComData: ['compromissos'],
  equipe: ['equipe'],
  maiorAtrito: ['atrito'],
};

const SECTION_TITLES: Record<keyof typeof SECTION_BLOCK_MAP, string> = {
  negocioESegmento: 'NEGÓCIO E SEGMENTO',
  rotinaFinanceira: 'ROTINA FINANCEIRA (de onde vem e pra onde vai o dinheiro)',
  rotinaDeTarefas: 'ROTINA DE TAREFAS (o que precisa ser lembrado/organizado)',
  compromissosComData: 'COMPROMISSOS COM DATA (entregas, pagamentos, atendimentos, reuniões)',
  equipe: 'EQUIPE (sozinho ou com ajuda, e o que cada um faz)',
  maiorAtrito: 'MAIOR ATRITO ATUAL (o que mais incomoda organizar hoje)',
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
as 6 respostas de um onboarding conversacional em classificadores prontos
(categorias e tags) para os 3 módulos que já existem no sistema de gestão
Lumio: Financeiro, Tarefas e Calendário.

## CONTEXTO ADICIONAL
- Onboarding concluído em: ${dto.submittedAt}
- Palpite local (heurística, não confiável) de nome da empresa: ${dto.businessNameGuess}
- Palpite local (heurística, não confiável) de segmento: ${dto.businessTypeGuess}
  (estes dois campos acima são apenas um chute por palavra-chave, feito sem IA
  — priorize sempre o que você conseguir inferir diretamente das respostas)

## RESPOSTAS DO ONBOARDING (ler as 6, na ordem abaixo)
${sections}

## SUA TAREFA
1. Identifique o segmento do negócio a partir das respostas.
2. Escreva "summary": um resumo geral, em 2-4 frases corridas e em tom
   humano (não uma lista), do que o usuário contou e do que você entendeu
   sobre o negócio dele. Este resumo substitui, na tela final do app, a
   exibição de cada pergunta/resposta individualmente — então ele precisa
   sozinho transmitir o essencial (o que o negócio faz, como ele já se
   organiza hoje, e o que mais pesa no dia a dia).
3. Gere "coreCategories" cobrindo tanto o que foi dito nas respostas quanto
   — e isso é ESSENCIAL — uma lista GENEROSA de categorias adicionais
   plausíveis para aquele segmento, mesmo sem menção explícita do usuário.
   Exemplo: se o segmento é "papelaria" e o usuário só falou "vendo material
   escolar e faço xerox", você também deve sugerir coisas como "Cartolina/
   EVA", "Encadernação", "Cartuchos de impressora", "Papelaria
   personalizada", etc., marcadas como "suggested".
4. Preencha "keywordMap" com o máximo de associações palavra → categoria que
   fizerem sentido para o segmento (não apenas palavras citadas pelo
   usuário) — o objetivo é que o motor de auto-classificação do app já
   nasça com uma base rica de palavras-chave.
5. Recomende plugins em "recommendedPlugins" usando APENAS ids da lista
   fechada definida em src/plugins/registry.ts: "estoque", "clientes",
   "fornecedores", "agenda", "orcamentos", "comissoes", "equipe",
   "entregas", "vendas", "contratos". Nunca invente um id fora
   desta lista. Cada recomendação vem com "reason" humano e "confidence".
   IMPORTANTE: o campo "reason" é APENAS a justificativa de por que este
   plugin faz sentido para ESTE usuário específico (ex: "Você mencionou
   que revende produtos com giro rápido"). NÃO gere, NÃO resuma, NÃO
   adapte e NÃO repita a descrição oficial do plugin — a descrição de
   cada plugin já existe previamente na página de Apps/Módulos e será
   exibida pelo app a partir do catálogo em src/plugins/registry.ts,
   de forma idêntica para todos os usuários. O "reason" nunca deve
   descrever o que o plugin faz; deve apenas explicar por que ele foi
   recomendado para o negócio deste usuário. Não altere, resuma ou
   tente adaptar a funcionalidade do plugin para encaixar nas
   necessidades identificadas no onboarding.
6. NUNCA invente "businessName" ou "segment" caso não sejam identificáveis
   com segurança — use null nesses casos e registre o campo em
   "missingInformation".
7. Retorne APENAS um objeto JSON válido, sem nenhum texto fora do schema,
   sem comentário, sem explicação, sem bloco de código markdown.

## TOM DA RESPOSTA
Seja generoso nas sugestões — é preferível sugerir uma categoria que o
usuário não vai usar do que deixar de sugerir uma que ele precisava.

## REGRAS SOBRE "origin"
- "mentioned": o usuário citou isso literalmente ou de forma muito próxima
  em alguma resposta.
- "suggested": você inferiu com base no segmento, mesmo sem menção direta.
Todo item de "coreCategories" (financial.expense, financial.income,
taskTags, calendarEventTypes) precisa vir com um desses dois valores em
"origin".

## SCHEMA DE SAÍDA (JSON)
{
  "businessName": string | null,
  "segment": string | null,
  "summary": string,
  "coreCategories": {
    "financial": {
      "expense": [{ "label": string, "origin": "mentioned" | "suggested" }],
      "income": [{ "label": string, "origin": "mentioned" | "suggested" }]
    },
    "taskTags": [{ "label": string, "origin": "mentioned" | "suggested" }],
    "calendarEventTypes": [{ "label": string, "origin": "mentioned" | "suggested" }]
  },
  "keywordMap": { "<palavra ou expressão>": "<nome de uma categoria acima>" },
  "recommendedPlugins": [
    { "plugin": string, "reason": string, "confidence": "alta" | "media" | "baixa" }
  ],
  "missingInformation": string[]
}

Responda apenas com o JSON, sem markdown, sem \`\`\`json, sem texto antes ou
depois.`;
}
