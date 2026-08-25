import type { OnboardingContextDTO } from '../ai/onboardingContext';

/** Hierarchical onboarding contract. Kept here so app/backend callers share one prompt. */
export function buildOnboardingExtractionPrompt(dto: OnboardingContextDTO): string {
  const sections = dto.answers.map((answer) => `- Pergunta: ${answer.question}\n  Resposta: ${answer.answer}`).join('\n');
return `Você é um analista especializado em microempresas. Transforme as 6 respostas abaixo em uma TAXONOMIA HIERÁRQUICA de duas camadas (genérico -> específico) para Financeiro, Tarefas e Calendário.

Onboarding concluído em: ${dto.submittedAt}
Palpite local de nome: ${dto.businessNameGuess}
Palpite local de segmento: ${dto.businessTypeGuess}

RESPOSTAS DO ONBOARDING
${sections || '(não informado)'}

TAREFA
1. Identifique businessName e segment com o MÁXIMO de especificidade possível (ex: "Instalação de Gesso e Drywall", não "Oficina"). Nunca invente; use null e registre em missingInformation se não houver base.

2. Para cada domínio (financial.expense, financial.income, task, calendar), gere nós {id, generic:{label, synonyms}, specifics:[{id, label, synonyms, origin}]}.
   - Para financial.expense e financial.income: generic é uma CATEGORIA/SUBSTANTIVO abstrato de gasto ou receita (ex: "Material", "Transporte", "Serviços Prestados"), independente de segmento.
   - Para task e calendar: generic é OBRIGATORIAMENTE um TIPO DE AÇÃO recorrente (o verbo que a pessoa usaria no chat), NUNCA o nome de uma área/departamento de gestão. É PROIBIDO usar como generic de task/calendar algo como "Gestão de Estoque", "Gestão Financeira", "Gestão de Pessoal", "Gestão de Orçamentos" — isso é nome de módulo do sistema, não uma tag útil de tarefa/evento. Exemplos de bons generics para task/calendar: "Pagamento", "Cobrança", "Compra", "Agendamento", "Contato com Cliente", "Manutenção", "Conferência". Os specifics dentro desse generic são a instância concreta daquela ação para este negócio (ex: generic "Pagamento" -> specifics "Pagamento de Diária do Ajudante", "Pagamento de Imposto MEI").
   - specifics.origin="mentioned": citado literalmente/quase literalmente pelo usuário.
   - specifics.origin="suggested": você deve OBRIGATORIAMENTE complementar cada generic com itens plausíveis do segmento mesmo sem menção direta do usuário — seja generoso, é melhor sugerir um item que ele não vai usar do que faltar um que precisava. Não deixe nenhum generic só com "mentioned".

3. synonyms (tanto do generic quanto de cada specific) devem ser PALAVRAS OU EXPRESSÕES CURTAS (1-4 palavras) que alguém digitaria num chat — plural/singular, abreviação, nome próprio associado. NUNCA copie a frase inteira da resposta do usuário como sinônimo.

3b. Para os synonyms de task e calendar especificamente: além de variações do que foi dito literalmente, inclua o VERBO + OBJETO GENÉRICO que qualquer usuário digitaria no chat para disparar essa ação, mesmo que o dono do negócio não tenha usado essas palavras exatas no onboarding. Exemplo: se o specific nasceu de "acertar o dinheiro do rapaz que me ajuda", os synonyms devem incluir termos genéricos prováveis como "pagar funcionário", "pagar ajudante", "salário", "quitar diária" — não apenas nomes próprios ou jargão isolado como "marcos" ou "diária". Pense sempre: "o que uma pessoa comum digitaria no chat pra disparar esta tag, mesmo sem usar o vocabulário exato do onboarding?"

4. Não repita nenhum synonym dentro do mesmo domínio.

5. recommendedPlugins: use APENAS estes ids: estoque, clientes, fornecedores, agenda, orcamentos, comissoes, equipe, entregas, vendas, contratos. Cada item: {plugin, reason, confidence: "alta"|"media"|"baixa"}. "reason" explica por que serve para ESTE negócio, nunca descreve o que o plugin faz.

6. Retorne apenas JSON válido, sem markdown, sem texto fora do schema.

SCHEMA (exemplo de FORMA, gere conteúdo completo e específico, não vazio):
{"taxonomyVersion":2,"businessName":string|null,"segment":string|null,"summary":string,"domains":{"financial.expense":[{"id":"material","generic":{"label":"Material","synonyms":["material","insumo"]},"specifics":[{"id":"placa_gesso","label":"Placa de Gesso","synonyms":["placa","placas","drywall"],"origin":"mentioned"},{"id":"epi","label":"EPI","synonyms":["epi","luva","capacete"],"origin":"suggested"}]}],"financial.income":[],"task":[{"id":"pagamento","generic":{"label":"Pagamento","synonyms":["pagamento","pagar","pago","quitar","acertar"]},"specifics":[{"id":"pagamento_diaria_ajudante","label":"Pagamento de Diária do Ajudante","synonyms":["pagar marcos","pagar ajudante","pagar funcionário","diária","acertar semana"],"origin":"mentioned"}]}],"calendar":[]},"recommendedPlugins":[{"plugin":"clientes","reason":"...","confidence":"alta"}],"missingInformation":[],"learnedTerms":[]}`;
}
