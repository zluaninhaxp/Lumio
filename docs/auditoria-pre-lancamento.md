# Auditoria técnica de pré-lançamento do Lumio

Data: 14/10/2026, America/Sao_Paulo. Checkout auditado: `a8ab61dee4dbba737238f2721ebc567ba91b5e6c` (`feat: reforçar persistência e sincronização do Lumio`).

## Estado atual após retomada — 14/10/2026

O diagnóstico original abaixo se refere ao checkout `a8ab61d`. As correções preparadas em `8a0d207` foram retomadas e receberam revisão adicional. **O código local avançou, mas a distribuição segue pendente de implantação aprovada e validação do APK.** Não interpretar os estados históricos “confirmado” como ausência das correções atuais, nem interpretar teste local como prova de implantação.

| Achado | Estado atual | Evidência / pendência |
| --- | --- | --- |
| P0-01 | Corrigido e migration 0010 aplicada | Histórico remoto confirma 0001–0010 alinhadas; testes PostgreSQL isolados para revisão NULL, coleções ausentes, rollback, RLS e recibos. |
| P0-02 | Corrigido localmente; APK pendente | Exclusão de cliente/contrato preserva e desvincula histórico; teste sobre store real. |
| P0-03 | Corrigido localmente; APK pendente | Preflight, rollback da preparação, recuperação explícita de grupo e mensagens pendentes após restart; testes dos serviços reais. |
| P1-01 | Corrigido localmente; APK pendente | Recalcula comissão pendente e bloqueia alteração incompatível após pagamento. |
| P1-02 | Corrigido localmente; dados antigos exigem revisão | Datas completas; registros sem ano ficam separados e não recebem ano presumido. |
| P1-03 | Corrigido localmente; APK pendente | Regras compartilhadas de realizado/previsto; retomada corrigiu despesas com dois flags pendentes e confirmação por tarefa, agenda e Financeiro. |
| P1-04 | Corrigido localmente; APK pendente | Alterações derivadas passam pela origem; recebimento/pagamento sincroniza tarefa e evento. |
| P1-05 | Corrigido localmente; dois aparelhos pendentes | Conflitos por agregado comercial preservam operações vinculadas; testes de merge. |
| P1-06 | Corrigido localmente; APK pendente | Mensagens recuperadas aparecem como pendentes/históricas sem reexecutar comandos. |
| P1-07 | Corrigido; handler `ai` v8 ativo | Fetch preserva timeout da IA; deadline total no handler e limites por tentativa. Disponibilidade/quota do provedor não foi exercitada. |
| P1-08 | Corrigido; `ai` v8 ativo; chave nova pendente | Teste/salvamento usam o modelo do relatório; erros de acesso distinguem chave rejeitada. Disponibilidade real não foi exercitada. |
| P1-09 | Aviso e consentimento implementados; operação pendente | Responsável, contato e retenção informados pela usuária; implementação de retenção/backups e adequação jurídica não comprovadas. |
| P1-10 | Corrigido localmente; binário pendente | AES-GCM, chave via SecureStore e chunks para journals; prebuild com backup/transferência excluídos. |
| P1-11 | Corrigido; handler `delete-account` v2 ativo | Purge retomável por identidade; recibo de A preserva sessão/estado de B; exclusão remota drena fotos de qualquer extensão e subpastas. Teste em conta descartável segue pendente. |
| P1-12 | Corrigido localmente; APK pendente | Drafts auxiliares isolados e limpos na troca de identidade. |
| P1-13 | Parcial; deploy confirmado | Migrations 0001–0010 e ai v8/delete-account v2 confirmados no projeto, com JWT habilitado. Leitura final de grants/RLS/bucket e teste isolado A/B seguem pendentes. |
| P1-14 | Corrigido localmente; Auth/SMTP/links reais pendentes | Reenvio, recuperação PKCE e callback; cadastro agora encaminha à confirmação quando signup não retorna sessão. |
| P2-06 | Corrigido localmente; APK pendente | Dia âncora, fevereiro/bissexto, preservação de cobranças recebidas e geração após hidratação/refresh. |
| P2-08 | Parcial | Paginação e formatos antigos/subpastas na exclusão corrigidos; concorrência de upload, erros de URL e HEIC permanecem fora desta correção. |
| Outros P2/P3 | Backlog preservado | Não foram declarados resolvidos por esta retomada. |

Ver [relatório de preparação do APK](relatorio-preparacao-apk.md) para evidências, falha ambiental do Gradle e matriz restante, e [pacote de revisão do deploy](deploy-pre-lancamento/revisao.md). Nenhuma chamada paga de IA ou escrita/exclusão de conta real foi executada.

## Veredito executivo original — checkout a8ab61d

**Ainda não recomendo entregar o APK atual para testes irrestritos de todos os módulos.** Há caminhos confirmados de exclusão inesperada de dados, uma validação incompleta da RPC de substituição e um caminho de rejeição do Chat que pode bloquear novas gravações. São os três P0 abaixo. Não foi confirmado vazamento entre contas no backend; também não foi comprovada a segurança da implantação atual por esta auditoria.

Depois de corrigir os P0, conferir a implantação e executar a validação mínima no APK, é viável começar um teste fechado pequeno, com dados comerciais fictícios. Os P1 podem ser tratados por etapas **desde que o fluxo afetado fique efetivamente fora do teste**. Se Financeiro, vendas, comissões, contratos e uso simultâneo em dois aparelhos forem oferecidos aos primeiros testadores, corrigir seus P1 antes da entrega. Uma orientação verbal para evitar determinado botão não equivale a impedir um caminho de perda de dados.

Mesmo em teste fechado, disponibilizar previamente informação clara sobre o tratamento dos dados de cadastro, Supabase, IA e voz, um contato de suporte e um procedimento de exclusão. Publicação em loja, automações, analytics, notificações, recorrências financeiras gerais e refinamentos visuais não são pré-requisitos de um APK fechado.

## Método, alcance e limites

- Inspeção das rotas em `app/`, componentes compartilhados, store, hooks, serviços, motores determinísticos, catálogo de módulos, migrations 0001–0009, três Edge Functions e seus helpers, plugins nativos, scripts e configurações Expo/EAS.
- Foco no commit recente de persistência: revisão otimista, merge de três versões, journal, recibos de confirmação, transação de Chat/negócio/onboarding e recuperação de sessão.
- Verificações locais com o código real, transpilações em memória, mocks de IO e PostgreSQL via PGlite em memória. As reproduções adicionais usaram somente registros sintéticos.
- Nenhuma correção, commit, build EAS, instalação de dependências, publicação, chamada Gemini paga ou alteração do Supabase remoto foi executada. A única gravação deliberada desta auditoria é este relatório.
- Não foram inspecionados um APK novo, seu Manifest final, certificado de assinatura, logs Android ou sessões autenticadas em dois aparelhos. Não foram consultados Dashboard, secrets, grants/policies remotos, configuração de Auth/SMTP, backups, billing ou histórico EAS autenticado.
- `docs/persistencia/relatorio-final.md` registra que 0001–0009 estavam alinhadas no remoto e que 0007–0009 foram aplicadas em 14/10. Isso é evidência documental anterior, **não uma nova confirmação de implantação**. Não classifico migrations como pendentes sem verificar o histórico remoto.
- Documentação exata do [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) consultada. O projeto resolve Expo 54.0.36, RN 0.81.5 e React 19.1.0. A skill `expo-overview` e a orientação `eas-app-stores` foram consultadas; nenhuma operação de release foi realizada.

### Interpretação dos estados

**Confirmado:** condição identificada no código ou reproduzida localmente; não significa reproduzida em APK. **Risco potencial:** caminho plausível, com condição de ocorrência explicitada. **Validação externa/APK:** não comprovável somente pelo checkout. A prioridade reflete impacto e alcance, não a quantidade de avisos de uma ferramenta.

## Verificações executadas

| Verificação | Resultado e limite |
| --- | --- |
| `npm run typecheck` | Aprovado; TypeScript estrito do aplicativo. Handlers Edge com `@ts-nocheck` não recebem a mesma garantia. |
| Motores e testes de store | 273 testes aprovados com `--experimental-test-isolation=none`. `npm test` inicialmente falhou por `spawn EPERM` do sandbox, não por assertiva de produto. |
| `npm run test:persistence` | 17 testes de serviços, 5 de AuthContext e 1 suíte SQL aprovados. |
| `npm run test:ai` | 11 testes aprovados com provedor/backend simulados. |
| Segurança local | 3 testes de migração legada e 2 de WebP aprovados. |
| Otimização de foto | 2 testes adicionais aprovados. |
| Suítes de interface/fluxo existentes | 120 testes aprovados: superfícies, sugestões, voz, etapas visuais 3–6, sheets, foco, barras, onboarding e alertas. Predominam verificações estruturais e fixtures; não são testes de release em aparelho. |
| Contraste | 226 verificações do script aprovadas; não cobrem todos os estados reais em tela. |
| `expo install --check` local | Sem divergências encontradas; a própria CLI avisa que a validação offline é menos confiável. Não equivale a um Expo Doctor completo online. |
| `expo config --type public --json` | Resolvido com sucesso: SDK 54, package `com.zluhcastro.lumio`, nova arquitetura. |
| `npm ls --depth=0` | Sem dependências diretas inválidas reportadas. Node local 22.17.0 atende ao requisito do projeto. |
| `npm audit --omit=dev --json` | Zero vulnerabilidades conhecidas retornadas pelo registry nesta execução. Não comprova ausência de falhas de lógica, nativas ou do código próprio. |
| Git/credenciais locais | Checkout inicialmente limpo; `.env` ignorado, somente nomes das variáveis inspecionados para inventário. Nenhum `.env`, keystore ou chave privada rastreado nos padrões verificados. Não foi feita uma varredura integral de secrets no histórico Git. |

Total: **434 testes locais aprovados**, além dos 226 checks de contraste e das reproduções diagnósticas descritas abaixo. Não há teste remoto desta auditoria. Os scripts `test:security:remote` e `test:ai:remote` criam/excluem contas e realizam gravações; foram deliberadamente excluídos da execução em produção.

## P0 — Bloqueadores da distribuição atual

### P0-01 — RPC aceita revisão nula e snapshot parcial que apaga coleções omitidas

**Estado: confirmado em PostgreSQL local.**

**Problema:** `replace_business_state` compara revisão e tipos com expressões que podem resultar em SQL NULL. Um `IF` com NULL não entra no ramo de rejeição. Campos de coleção ausentes passam pela checagem; o loop não insere itens e o DELETE considera a coleção vazia. `expected_revision = NULL` também contorna a comparação de revisão.

**Impacto:** uma chamada autenticada malformada, cliente incompatível ou futura regressão pode apagar os dados da própria conta sem detectar revisão desatualizada. Não permite por si só acessar outra conta: a RPC deriva o proprietário de `auth.uid()`.

**Evidência:** `supabase/migrations/0004_business_state.sql:240`, `:247`, `:249` e `:292`. Reproduzido com o schema 0001–0004 e 0007–0009 em PGlite: após gravar uma tarefa, `replace_business_state(NULL, '{"preferences":{}}')` retornou revisão 2; a contagem de tarefas caiu de 1 para 0. A suíte existente não cobre este payload.

**Correção recomendada:** rejeitar explicitamente revisão nula/inválida, exigir todas as coleções e preferências com tipos exatos usando comparações seguras para NULL, validar snapshot antes de qualquer mutação e testar campos ausentes, JSON null e revisão nula em uma nova migration. Rever as sobrecargas que delegam à mesma função. Não reaplicar/editar migrations já implantadas como solução operacional.

### P0-02 — Exclusão de cliente apaga receitas que o aviso promete preservar

**Estado: confirmado com o store real em memória.**

**Problema:** a confirmação de Clientes diz que receitas vinculadas ficam sem cliente e não são excluídas. `removeClienteItem` remove contratos do cliente e filtra todas as transações desses contratos, inclusive receitas confirmadas. `removeContrato` também elimina todo o histórico financeiro vinculado.

**Impacto:** perda permanente de histórico de recebimentos por uma ação rotineira. O commit recente torna essa exclusão remota e confirmada; sincronização correta não restaura registros deliberadamente removidos.

**Evidência/arquivos:** `app/plugins/clientes.tsx:141`, `src/store/index.ts:1117` e `:1160`, `app/plugins/contratos.tsx`. Reprodução: cliente → contrato → receita de 100 confirmada → `removeClienteItem`; transações restantes = 0.

**Correção recomendada:** definir política de arquivamento/desvinculação e preservar lançamentos realizados. Caso existam exclusões financeiras deliberadas, apresentar alcance preciso e confirmação específica. Testar cliente/contrato com recebimentos realizados e pendentes, atendimento e evento vinculados, incluindo reabertura em outro aparelho.

### P0-03 — Rejeição definitiva no Chat pode deixar um estado inválido bloqueando todos os commits

**Estado: confirmado no fluxo de código; reprodução de interface pendente.**

**Problema:** `runChatAction` prepara alterações no store, registra a dupla de mensagens e tenta o commit. No erro, só mostra alerta; não captura/inverte a preparação rejeitada nem oferece abandonar/corrigir a tentativa. Enquanto `pendingPair` existe, o próximo envio reutiliza a operação anterior e não processa a nova mensagem. Diferentemente de `useConfirmedSave`, não trata rejeições definitivas de validação.

**Impacto:** um comando que gere dado recusado pelo SQL pode contaminar o snapshot inteiro e impedir salvar alterações de outros módulos. Reabrir não elimina o dado inválido preservado no journal; repetir a chamada não resolve uma constraint.

**Evidência/arquivos:** `app/(tabs)/chat.tsx:652`, `src/services/businessStateService.ts:195`, `src/hooks/use-confirmed-save.ts:52`, `supabase/migrations/0004_business_state.sql:16`. Exemplo verificável: `/adicionarcliente nome="..."` com mais de 200 caracteres é aceito pelo parser/store e recusado pela constraint de nome; o composer não impõe esse limite. Não foi executado em conta remota.

**Correção recomendada:** aplicar a fronteira de preparação/rollback ao Chat, separar falha transitória de rejeição definitiva e permitir corrigir/descartar a tentativa sem apagar alterações independentes. Validar os limites antes de alterar o store. Cobrir constraint, falha ao journal, conflito remoto, retry, restart e resposta perdida.

## P1 — Importantes antes de ampliar os testes

### P1-01 — Comissões ficam incorretas após editar, cancelar e reconcluir vendas

**Estado: confirmado com o store real.**

**Problema:** a comissão só é criada na transição para concluído. Editar uma venda já concluída altera receita/estoque, mas não recalcula comissão ou funcionário. Cancelar mantém comissões pagas; reconcluir pode criar uma nova comissão sobre a mesma venda.

**Impacto:** saldo e histórico de remuneração incorretos. **Evidência:** `src/store/index.ts:648–697` (função `applyOrderUpdate`), `app/plugins/vendas.tsx:170`, `app/plugins/comissoes.tsx`. Venda 100/10% editada para 200: receita = 200, comissão = 10. Cancelamento e reconclusão com comissão paga: duas comissões.

**Correção:** estabelecer regras para edição/estorno depois de pagamento, recalcular pendentes e impedir dupla comissão; preservar trilha de valores pagos. Corrigir antes de oferecer Vendas/Comissões no teste fechado.

### P1-02 — Financeiro não distingue anos e reinterpreta registros antigos como atuais

**Estado: confirmado.**

**Problema:** transações usam `DD/MM`; `periodTransactions` filtra só mês, apesar de a navegação mostrar ano. O Chat converte essa data usando o ano atual do relógio.

**Impacto:** outubro/2025 e outubro/2026 exibem o mesmo conjunto; após a virada do ano, relatórios incluem lançamentos antigos como atuais. **Evidência/arquivos:** `src/hooks/useFinanceState.ts:124–139`, `src/engine/financialEngine/queryAnswer.ts:14–17`, `src/store/index.ts:633`, `app/components/Finance/QuickAddForm.tsx`, `src/engine/financialEngine/apply.ts`.

**Correção:** persistir data completa ISO e usar o mesmo período em tela, consultas e efeitos de módulos. Planejar migração conservadora dos registros sem ano, sem inventar silenciosamente um ano para todo o histórico. Antes do primeiro teste do Financeiro, corrigir ou retirar a navegação enganosa e documentar a limitação temporária.

### P1-03 — Chat e Financeiro divergem sobre valores realizados

**Estado: confirmado, com reprodução local.**

**Problema:** o Chat exclui receitas com `expectedDate` mesmo quando `confirmed` é true. O Financeiro as inclui. O Financeiro soma todas as saídas; o Chat exclui despesas de fornecedor com `supplierPaid === false`.

**Impacto:** dois saldos para a mesma conta, decisões baseadas em números incompatíveis. **Evidência:** `src/engine/financialEngine/queryAnswer.ts:20–25`, `src/hooks/useFinanceState.ts:201–207`. Consulta de entrada mensal para contrato 100 confirmado com `expectedDate`: resposta “Nenhuma entrada registrada este mês”.

**Correção:** centralizar a definição de realizado/previsto, usar data de realização quando apropriado e cobrir contratos, despesas de fornecedor e confirmação/desconfirmação nas duas interfaces.

### P1-04 — Editar ou excluir lançamentos gerados por módulos quebra a coerência de origem

**Estado: confirmado no código.**

**Problema:** `removeTransaction`, `removeTransactions` e `updateTransaction` alteram somente transações, sem reconciliar a venda, entrega, contrato, estoque ou tarefa que as gerou. Existem campos como `financeTransactionId` que continuam apontando para um lançamento removido.

**Impacto:** venda concluída sem receita; frete sem despesa; recriação de receita ao editar venda; valores divergentes entre documentos e Financeiro. **Evidência/arquivos:** `src/store/index.ts:1387–1400`, `:671–676`, `src/hooks/useFinanceState.ts:255`, `app/components/Finance/QuickAddForm.tsx`. As FKs SQL não cobrem todos os IDs guardados no JSON, como a ligação reversa `financeTransactionId`.

**Correção:** identificar lançamentos derivados, direcionar edição à origem ou fazer alteração/estorno coordenado. Testar exclusão em lote e desfazer, incluindo registros de diferentes origens. Não basta o commit ser atômico se o estado preparado já é incoerente.

### P1-05 — Merge protege campos conflitantes, mas não toda operação de negócio vinculada

**Estado: confirmado em reprodução local; alcance adicional é risco potencial.**

**Problema:** o agrupamento de operações relacionadas só atua quando `mergeSnapshots` detecta conflitos. Mudanças em registros/campos diferentes de uma mesma operação podem ser combinadas sem validar invariantes comerciais.

**Impacto:** segundo aparelho pode confirmar uma comissão enquanto o primeiro muda a venda correspondente, resultando em valores incompatíveis sem oferecer resolução. **Evidência/arquivos:** `src/services/syncMerge.ts:10`, `:77`, `src/services/businessStateService.ts:163`. Reprodução sintética: base venda/receita 100 e comissão 10; local altera venda/receita para 200; remoto paga comissão 10; merge retorna `conflicts: []`.

**Correção:** tratar revisão/validação por agregado comercial ou verificar invariantes sobre o snapshot combinado antes do commit. Cobrir edição/cancelamento/pagamento de venda, aprovação de orçamento, entrega e cobrança em dois aparelhos. Até resolver, limitar testes dessas operações a um aparelho por conta.

### P1-06 — Mensagens pendentes recuperadas não aparecem no Chat

**Estado: confirmado usando o serviço real com IO em memória.**

**Problema:** `chatHistoryService.start` restaura `pending` do journal, zera `original` e monta a interface a partir das mensagens remotas e do histórico em memória. Não inclui os payloads pendentes recuperados.

**Impacto:** após matar o app com envio não confirmado, há indicação genérica de pendência, mas o usuário não vê qual mensagem será salva. Pode interpretar desaparecimento como perda ou reenviar conteúdo.

**Evidência:** `src/services/chatHistoryService.ts:30–40`, `app/(tabs)/chat.tsx`, `src/components/persistence-feedback.tsx`. Reprodução: stage de mensagem → nova instância dos serviços com o mesmo storage → `hasPending = true`, histórico visível = 0. O conteúdo continua preservado e pode aparecer após confirmação; não foi comprovada perda definitiva.

**Correção:** apresentar mensagens recuperadas como pendentes, com retry explícito e sem reativar comandos históricos. Testar confirmação já feita no servidor com resposta perdida e pendência realmente não gravada.

### P1-07 — Timeout global de 30 s cancela a IA antes dos limites específicos

**Estado: confirmado no encadeamento de fetch; ocorrência com Gemini lento depende de teste.**

**Problema:** `invokeAiBackend` define 135 s para geração/40 s para teste, mas o fetch global aborta tudo fora de `/auth/v1/` em 30 s. A função permite 55 s por geração, fallback e tentativa corretiva; o teste pode fazer duas chamadas de 20 s.

**Impacto:** erro prematuro enquanto o backend pode continuar usando quota; retry manual pode gerar trabalho/custo repetido. **Evidência/arquivos:** `src/lib/authFetch.ts:9`, `src/lib/supabase.ts:23`, `src/services/ai-backend.ts:15–17`, `supabase/functions/ai/index.ts:36–80`, `:135–140`.

**Correção:** definir orçamento coerente por operação e deadline total no servidor; não deixar o wrapper reduzir inadvertidamente o timeout do chamador. Considerar deduplicação de geração e cancelamento ao sair. Confirmar também limites do plano/runtime Supabase.

### P1-08 — Teste e salvamento de chave dependem de Gemini 2.5 Flash

**Estado: dependência confirmada; compatibilidade de novas contas é risco externo.**

**Problema:** `keyCheckModel` é `gemini-2.5-flash`, enquanto relatórios usam `gemini-3.5-flash-lite`. A documentação consultada informa acesso restrito aos modelos 2.5 para usuários que já os utilizaram.

**Impacto:** uma chave válida de novo testador pode falhar no teste/salvamento mesmo tendo acesso ao modelo de relatório. Não concluo que todas as chaves falharão. **Evidência:** `supabase/functions/ai/index.ts:8–9`, `:117–133`, `app/ai-settings.tsx:79`; [catálogo oficial Gemini](https://ai.google.dev/gemini-api/docs/models).

**Correção:** validar disponibilidade com projeto novo e projeto existente, usar modelo compatível para teste/salvamento e distinguir restrição de modelo de chave inválida. Corrigir/validar antes de oferecer IA a novas contas; onboarding sem IA já existe como alternativa explícita.

### P1-09 — Informação de privacidade e condições da IA insuficientes no fluxo

**Estado: ausência confirmada no checkout; eventual documento enviado fora do app não foi verificado.**

**Problema:** cadastro e configurações não disponibilizam política/aviso com finalidade, retenção, responsável, contato e compartilhamento. Respostas livres do onboarding são enviadas ao Gemini; a chave própria não informa qual regime de tratamento/cobrança se aplica. Reconhecimento de voz usa o serviço disponível no aparelho, sem exigir processamento exclusivamente local.

**Impacto:** participantes podem enviar dados pessoais, de clientes ou comerciais confidenciais sem entender destino e tratamento. **Evidência/arquivos:** `src/components/auth-screen.tsx`, `app/resources.tsx`, `app/ai-settings.tsx`, `src/ai/onboardingContext.ts`, `supabase/functions/_shared/onboarding-prompt.ts`, `src/services/voiceRecognition.ts:114`.

**Correção:** antes do primeiro testador, fornecer aviso acessível, responsável/contato, finalidade, destinatários, retenção e exclusão; informar custos da chave e limitar os exemplos de IA a dados fictícios/não confidenciais. Definir base legal e consentimentos aplicáveis com orientação adequada, sem presumir que um checkbox genérico resolve tudo. O art. 9 da [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) trata da transparência. Os [termos Gemini](https://ai.google.dev/gemini-api/terms) diferenciam serviços pagos e gratuitos; no regime gratuito contemplam uso de conteúdo para melhoria e orientam não enviar informação pessoal/confidencial. Não foi verificado o regime das chaves dos testadores.

Para APK fechado, o aviso e procedimento podem inicialmente ser fornecidos por documento/link antes da inscrição, sem exigir um portal jurídico completo. Para lançamento público, integrar acesso permanente no produto e atender às declarações/requisitos do canal de distribuição.

### P1-10 — Tokens e rascunhos pessoais usam armazenamento local sem criptografia própria

**Estado: confirmado; exposição por backup/aparelho depende do ambiente.**

**Problema:** Supabase persiste sessão em AsyncStorage. Journals de negócio/Chat também usam AsyncStorage. SecureStore instalado é usado para apagar chave antiga, não para proteger a sessão atual.

**Impacto:** tokens de acesso/renovação e conteúdo pessoal podem ser recuperáveis em aparelho comprometido ou em certas configurações de extração/backup. Não significa que outro app Android comum tenha acesso ao sandbox. **Evidência:** `src/lib/supabase.ts:25`, `src/services/businessStateService.ts:115–124`, `src/services/chatHistoryService.ts:12`, `src/services/legacy-ai-key-cleanup.ts`.

**Correção:** adotar armazenamento protegido adequado à sessão, revisar tamanho/erros de storage e excluir conteúdo sensível de backup/transferência conforme política. Para journals, definir cifragem/retenção e recuperação. Validar Manifest/regras de backup do APK; o plugin SecureStore não protege automaticamente entradas de AsyncStorage. Ver [SecureStore no SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).

### P1-11 — Exclusão de conta não garante limpeza dos rascunhos locais

**Estado: confirmado na implementação; resíduos efetivos dependem de haver pendências.**

**Problema:** apagar a conta remove dados remotos por cascade e arquivos listados, mas logout/`stop`/`clearPrivateState` limpam memória sem remover todos os journals e dados legados por usuário. Exclusão não chama uma rotina de purge local. A função remove fotos antes de excluir Auth; falha posterior pode deixar a conta existente sem foto.

**Impacto:** conteúdo pessoal permanece no aparelho depois de promessa de exclusão; exclusão parcial tem comportamento difícil de explicar. **Evidência/arquivos:** `app/settings.tsx:25`, `src/services/authService.ts:40–51`, `src/services/businessStateService.ts:341`, `src/services/chatHistoryService.ts:78`, `supabase/functions/delete-account/index.ts:28–35`.

**Correção:** purge local específico após exclusão confirmada, preservar pendências no logout normal conforme regra explícita e tornar a exclusão retomável. Validar cascade, storage, logs/backups e prazo de retenção; não prometer remoção imediata de toda cópia de backup. Testar só com contas descartáveis em ambiente isolado.

### P1-12 — Rascunhos auxiliares não são separados por usuário

**Estado: confirmado no código; reapresentação a outra conta é risco a reproduzir no APK.**

**Problema:** `pendingDrafts` de relações e `pendingTransactionDraft` são variáveis globais sem owner/project e não são limpas por `clearPrivateState`.

**Impacto:** após troca de conta no mesmo processo, texto/valores/referências do formulário anterior podem reaparecer em fluxos de criação. FKs por owner ajudam a impedir gravar IDs de outra conta, mas não impedem expor texto na interface.

**Evidência/arquivos:** `src/utils/relationDraft.ts:5`, `app/components/Finance/QuickAddForm.tsx:69`, `src/services/businessStateService.ts:351`, `src/contexts/AuthContext.tsx:174`.

**Correção:** escopo por conta/projeto e limpeza na transição de identidade. Testar A preenchendo formulário → navegar para cadastrar relação → logout/login B → abrir Financeiro/Vendas/Tarefa e completar retorno.

### P1-13 — Segurança/configuração efetivamente implantadas ainda precisam de prova operacional

**Estado: validação externa pendente, não defeito confirmado.**

**Problema:** policies, funções SQL, secrets e handlers corretos no Git não comprovam o ambiente que o APK alcança. Não há `supabase/config.toml` versionado para registrar opções das funções. A chave embutida é publicável; sua presença no bundle é esperada, e não deve ser confundida com service role.

**Impacto:** implantação divergente pode interromper login/salvamento/IA ou expor dados se permissões remotas forem diferentes. **Evidência/arquivos:** `app.json`, `src/lib/supabase.ts:12–13`, `supabase/migrations/0001_auth_onboarding.sql`, `0004_business_state.sql`, `0005_private_services.sql`, `0006_ai_credentials_privileges.sql`, `0007–0009`, `supabase/functions/_shared/secure.ts`.

**Recomendação:** conferir read-only migrations/grants/RLS, função implantada, bucket privado, segredo AES de 32 bytes e verificação de identidade. Validar anônimo, JWT inválido/expirado e duas contas descartáveis em ambiente separado. Não alterar produção para executar os scripts existentes. Após corrigir P0-01, usar migration nova e plano de deploy; verificar o host embutido no APK. Registrar opções do gateway compatíveis com a autenticação interna, sem simplesmente desabilitar proteção por tentativa e erro. Referência: [autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth).

**Critério de distribuição:** essa conferência é obrigatória antes de entregar o APK, independentemente de o código já ter passado nos testes. Não é uma afirmação de que as migrations atuais estão faltando.

### P1-14 — Confirmação de e-mail pode criar conta sem um fluxo claro de continuação

**Estado: confirmado no código; ativação dessa configuração é externa.**

**Problema:** signup sem sessão lança `EMAIL_CONFIRMATION_REQUIRED`; o usuário permanece no cadastro. Não há tela dedicada, reenvio ou tratamento do callback de confirmação; `detectSessionInUrl` é false. Recuperação de senha também não está implementada.

**Impacto:** se confirmação estiver ativa no Supabase, testador pode achar que o cadastro falhou e tentar criar novamente. Login posterior à confirmação pode funcionar, mas precisa ser orientado/testado. **Evidência/arquivos:** `src/services/authService.ts:53–61`, `src/components/auth-screen.tsx`, `src/lib/supabase.ts:29`, `src/services/authError.ts`.

**Correção:** conferir Auth/SMTP/redirect URLs e explicar continuação/reenvio. Para grupo pequeno, contas preparadas e suporte manual são aceitáveis; não é obrigatório construir recuperação completa antes de teste restrito. Não desabilitar confirmação em produção só para contornar o UX.

## P2 — Recomendados durante a fase de testes

### P2-01 — Sincronização e histórico têm custo proporcional a toda a conta

**Estado: confirmado na arquitetura; degradação depende do volume.**

Cada alteração serializa o snapshot inteiro; commit consulta remoto e faz upsert de todas as coleções. Refresh periódico recarrega o Chat inteiro em páginas de 500, com buscas lineares para reaproveitar mensagens. **Impacto:** CPU, rede, latência e custo crescem mesmo em mudanças pequenas. **Evidência:** `src/services/businessStateService.ts:46`, `:178`, `:328`, `src/services/chatHistoryService.ts:22–27`, `src/contexts/AuthContext.tsx:153`, `supabase/migrations/0004_business_state.sql:250–298`.

**Correção:** medir em Android intermediário com volume sintético, carregar Chat incrementalmente e reduzir serialização/regravação. Não exigir mudança total de arquitetura antes do pequeno grupo; definir limites e acompanhar latência.

### P2-02 — Limites rígidos de snapshot/pêndencias podem bloquear crescimento sem orientação

**Estado: limites confirmados; atingir o limite é risco potencial.**

Snapshot acima de 2 MB, coleção acima de 5.000 e lote de Chat acima de 100 mensagens/1 MB são rejeitados. O journal pode acumular mensagens em reinícios/navegações sem confirmação. Não há indicador de capacidade nem estratégia de arquivamento/chunking de pendências. **Impacto:** conta para de salvar após crescer; uma mensagem grande pode barrar o lote. **Evidência:** `0004_business_state.sql:241`, `:251`, `0007_chat_history.sql:31`, `src/services/chatHistoryService.ts:63`.

**Correção:** comunicar limites, validar tamanho antes da mutação, limitar lote e preservar atomicidade da operação correspondente. Testar volume com dados fictícios, inclusive limitação de AsyncStorage por entrada/plataforma. Não anunciar uso offline ilimitado.

### P2-03 — Rate limit por usuário limita frequência, mas não orçamento total ou cadastro abusivo

**Estado: controles confirmados; abuso/custo é risco potencial.**

AI permite 20 gerações/hora por usuário; uma ação pode executar tentativa corretiva/fallback. Não há budget global/diário, idempotência de IA ou controle visível de cadastros. Testar e salvar uma chave executam validações separadas. **Impacto:** custo de provedor/Supabase e quota dos testadores; várias contas contornam limite individual. **Evidência:** `supabase/functions/ai/index.ts:102`, `:119`, `:134`, `0005_private_services.sql:16`, `app/ai-settings.tsx`.

**Correção:** começar com participantes identificados, configurar quotas/budgets e monitorar volume no provedor; informar que a chave pertence ao testador. Definir limite total por projeto e controle de onboarding se o grupo crescer. Não há evidência de cobrança central de Gemini: as gerações usam chaves por usuário.

### P2-04 — Validação JSON deixa campos consumidos pela UI sem schema completo

**Estado: confirmado; crash por payload específico é risco potencial.**

Constraints protegem campos nucleares/FKs, mas não todos os campos de negócio. Preferências/taxonomia são hidratadas por casts; cards do Chat também. Um cliente antigo ou gravação direta autenticada permitida nas tabelas legadas pode produzir conteúdo que a UI não entende. **Impacto:** erros ao renderizar, dados economicamente inconsistentes ou inicialização bloqueada. **Evidência:** `src/services/businessStateService.ts:69–107`, `src/services/chatSerialization.ts:22`, `supabase/migrations/0004_business_state.sql`, `src/ai/aiOnboardingService.ts:48`.

**Correção:** schemas compartilhados para payloads críticos, validação no servidor e na hidratação e tratamento recuperável de registro inválido. Priorizar status, datas, montantes, percentuais e arrays consumidos. A validação de IA no servidor já é mais forte que o cast do cliente; não a remover.

### P2-05 — Campos numéricos e validações de formulário podem corrigir/descartar entrada silenciosamente

**Estado: confirmado no código.**

Estoque inicial usa `Number(form.quantity) || 0`, convertendo `1,5` ou texto inválido em zero. Vendas filtram linhas inválidas e podem salvar só as restantes. Vários saves fazem `return` sem mensagem. **Impacto:** quantidades/total inesperados ou botão aparentemente sem ação. **Evidência:** `app/plugins/estoque.tsx:107–114`, `app/plugins/vendas.tsx:173–182`, `app/plugins/orcamentos.tsx:168–171`, `app/plugins/catalogo.tsx:45`.

**Correção:** parsing consistente pt-BR, erros por campo e rejeição de documento com linha incompleta, sem descartá-la silenciosamente. Testar decimal, vazio, zero, negativo, número muito grande e colagem de texto. Campos textuais precisam refletir limites SQL para evitar erros tardios.

### P2-06 — Datas recorrentes de contrato derivam do overflow de mês do JavaScript

**Estado: confirmado no algoritmo; cenários de UX dependem de teste.**

`advanceContractDate` usa `Date.setMonth`; uma cobrança em 31/janeiro pode avançar para março. Editar `startDate` não ajusta necessariamente `nextBillingDate`; geração acontece ao abrir Contratos/enviar Chat, não por job de servidor. **Impacto:** vencimentos deslocados, previsões atrasadas ou inconsistentes. **Evidência/arquivos:** `src/store/index.ts:638–643`, `:1148–1189`, `app/plugins/contratos.tsx:153`, `app/_layout.tsx:26`.

**Correção:** definir dia âncora/fim de mês, semântica de alteração de início/período e gatilho após hidratação/retorno ao app. Validar 29/fevereiro, dias 30/31, contrato antigo e mudança de fuso. Automação em servidor é opcional se a geração sob demanda for explicada.

### P2-07 — Falha de fonte pode deixar o aplicativo sem interface recuperável

**Estado: confirmado no código; falha real é potencial.**

Root usa somente `loaded` de `useFonts` e retorna null enquanto false, sem usar o erro ou fallback. **Impacto:** tela vazia persistente se carregamento falhar. **Evidência:** `app/_layout.tsx:15–31`. **Correção:** tratar erro de fonte com fallback/estado recuperável, verificar assets e coordenar splash nativo. Não foi observado crash ou falha de fonte nesta auditoria.

### P2-08 — Foto pode falhar silenciosamente e uploads concorrentes podem deixar órfãos

**Estado: confirmado nos caminhos; ocorrência depende de uso.**

`signedUrl` converte qualquer erro em null; perfil pode ficar sem foto sem explicar a falha. Upload remove foto anterior sem verificar erro de remoção; duas chamadas concorrentes podem deixar arquivo extra. Excluir conta lista no máximo 1.000 arquivos. **Impacto:** avatar ausente, storage residual/custo e exclusão incompleta se houver muitos órfãos. **Evidência:** `src/services/photoService.ts:7–12`, `supabase/functions/photo/index.ts:37–49`, `supabase/functions/delete-account/index.ts:28`.

**Correção:** diferenciar ausência/falha, controlar concorrência/limpeza, paginar exclusão e validar retry após resposta perdida. WebP tem limites e inspeção de dimensões; isso não comprova que toda imagem malformada é segura para decoders nativos. Testar imagens grandes/HEIC e cancelamento no APK.

### P2-09 — A rota genérica tem exclusão sem confirmação remota e hook condicional

**Estado: confirmado; alcance reduzido por não ser a rota principal dos módulos atuais.**

`[id].tsx` retorna antes de `useConfirmedSave` para ID inválido e usa `removeGenericPluginItem` diretamente no callback de exclusão. IDs genéricos usam só `Date.now()`. **Impacto:** se parâmetros mudarem inválido→válido, quebra potencial da ordem de hooks; exclusão visual avança antes da confirmação; duas inclusões no mesmo milissegundo podem colidir. **Evidência:** `app/plugins/[id].tsx:54–91`, `src/store/index.ts:1284`. **Correção:** hooks antes de returns condicionais, confirmação remota nas ações e IDs robustos. Não classificar todos os módulos como incompletos por causa dessa rota residual.

### P2-10 — Não há proteção de navegação autenticada central nas rotas privadas

**Estado: confirmado; acesso útil a dados por deep link não foi comprovado.**

`index` decide redirecionamento, mas Tabs/Stack não usam guarda central de sessão. Scheme `lumio` pode levar diretamente a telas. **Impacto:** UX inconsistente, telas privadas sem usuário e risco de resíduo local se outros mecanismos de limpeza falharem. As RPCs/RLS ainda devem impedir acesso remoto sem identidade; guarda visual não substitui autorização. **Evidência:** `app/index.tsx:24`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app.json`.

**Correção:** proteger grupos privados e testar deep links com logout, sessão expirada, inicialização incompleta e onboarding não concluído. Conferir também diretórios auxiliares dentro de `app/`: o Router usa essa árvore para rotas, incluindo arquivos de componentes que não deveriam ser telas navegáveis.

## P3 — Melhorias futuras

### P3-01 — Cobertura de testes não acompanha todas as invariantes do store real

**Estado: confirmado.** Testes de sincronização tarefa/calendário espelham lógica em vez de executar o store; vários testes visuais inspecionam código. A suíte SQL não aplica 0005/0006, portanto não testa localmente rate limits, storage policies ou privilégios de credenciais. **Impacto:** verde pode esconder regressões como os casos desta auditoria. **Evidência:** `src/store/__tests__/taskCalendarSync.test.ts:3–11`, `scripts/persistence-sql.test.cjs:19`, `scripts/ai-architecture.test.cjs:51`.

**Correção:** adicionar casos dos P0/P1 sobre implementações reais, checagem Deno dos handlers, teste isolado de todas as migrations e E2E mínimo em release. Criar comando agregado/CI. Não é necessário criar uma suíte extensa para ajustes visuais simples.

### P3-02 — Dívida de código/documentação e plugin Android exigem manutenção cuidadosa

**Estado: confirmado.** Comentários dizem que IA/persistência ainda são futuras, apesar do uso real; há componentes antigos de áudio e rotas redirecionadoras. Plugin de barras exige RN exatamente 0.81.5 e gera código Kotlin acessando modal nativo. **Impacto:** manutenção confusa e upgrades podem quebrar prebuild/compilação. **Evidência:** `src/services/onboardingService.ts`, `src/repositories/onboardingRepository.ts`, `app/components/onboarding/VoiceRecorder.tsx`, `app/preferences.tsx`, `plugins/withAndroidSystemBars.cjs:5`.

**Correção:** remover legado comprovadamente não utilizado, atualizar comentários e revalidar plugin em cada upgrade. Não atualizar SDK/RN por iniciativa desta auditoria; a combinação atual está alinhada ao SDK 54. Build Android real continua necessário para validar o Kotlin gerado.

### P3-03 — Observabilidade, exportação e recuperação operacional podem evoluir

**Estado: lacuna confirmada no checkout; monitoramento externo não foi verificado.** Não há integração explícita de crash reporting/exportação de dados no app, nem plano de restauração versionado. **Impacto:** investigação e atendimento ficam manuais. **Evidência:** `package.json`, `app/_layout.tsx`, `app/settings.tsx`, `src/services/businessStateService.ts`.

**Correção:** para grupo pequeno, canal de suporte, versão/build, passos de reprodução e logs sanitizados podem bastar. Antes de escala pública, definir métricas, backup/restore testado, exportação/acesso a dados e prazo de atendimento. Adotar serviço de monitoramento é opcional; evitar inserir dados pessoais/chaves nos logs.

## Cobertura dos fluxos reais

Esta matriz registra o que o código oferece e o que ainda precisa ser demonstrado no APK; não certifica execução manual de todas as telas.

| Área | Fluxo revisado e observações |
| --- | --- |
| Welcome/Auth/Login/Register | Cadastro/login Supabase, validação básica, envio protegido contra duplo toque; confirmar e-mail, suporte para senha esquecida e deep links pendentes. |
| Onboarding | Respostas/progresso remoto, perguntas opcionais, voz, transição, retry, sem IA, relatório e conclusão transacional. Rascunho só existe depois da submissão/preparação; texto apenas digitado em um input não tem garantia de persistência. |
| Relatório/Celebração | Geração, estado sem chave, simulação explícita, edição/confirmação e draft remoto. Saída atrasada após desmontagem é tratada na tela; timeout/compatibilidade de modelo exigem revisão. |
| Chat | Comandos de cadastro, motores financeiros/tarefa/calendário, ambiguidades, cards e menus; não é um chat generativo geral. Histórico é persistido sem executar comandos na restauração; P0-03 e P1-06 permanecem. |
| Tarefas | CRUD, subtarefas, prioridade, pessoas, tags, sugestão de módulos, conclusão e vínculo calendário. Verificar conclusão de obrigação financeira e operação com conflito/retry em release. |
| Calendário/Agenda | Eventos, tarefas derivadas, filtros, seleção de pessoas e atendimento vinculado a orçamento. Agenda usa a tela Calendário; não é um módulo genérico incompleto. Validar cancelamento/conclusão de atendimento e links. |
| Financeiro | Inclusão/edição, filtros, resumo, exclusão em lote/desfazer, fornecedores e compra/estoque. Problemas de ano, realizado e origem descritos nos P1. |
| Apps/Loja | Ativação, ordem, dependências e desativação preservando dados. Não há evidência de compra/pagamento real: “loja” é catálogo de módulos, não integração de cobrança. Testar dependências e retornos aos formulários. |
| Clientes/Fornecedores/Equipe | CRUD, duplicidade por nome e vínculos. Exclusão de cliente diverge do aviso; equipe preserva histórico com comissão paga, mas exclui pendentes ao remover funcionário. |
| Catálogo/Estoque | Produto/serviço, arquivamento, item físico, alertas e movimentos. Arquivamento preserva histórico no código; parsing de quantidades e falta de estoque precisam de teste. |
| Vendas/Orçamentos | Itens, clientes/equipe, baixa de estoque/receita, aprovação e pedido derivado, recusa/expiração. Comissões e linhas descartadas merecem correção; expiração é sob demanda. |
| Contratos/Entregas/Comissões | Previsões/recebimentos, vencimento no calendário, frete, estados de entrega e fechamento de comissão. Fechar comissão não cria despesa e o diálogo informa isso: não é botão sem implementação. Recorrência e integridade pós-edição/exclusão permanecem. |
| Conta/Perfil/Configurações/Recursos/IA | Atualização de dados, foto, negócio, senha, exclusão e gestão server-side de chave. Preferências antigas redirecionam para Settings e não oferecem toggles sem efeito. |

Serviços efetivamente referenciados: Supabase Auth/PostgREST/RPC/Storage/Edge Functions, Gemini para personalização de onboarding, EAS para build e reconhecimento de voz dependente da plataforma. Não foi encontrada integração ativa de pagamentos, push, analytics, transcrição por Edge Function ou servidor próprio adicional. A presença de `expo-audio` e componentes legados não comprova um serviço remoto de transcrição.

## Segurança: controles existentes e limites da conclusão

- Identidade das Edge Functions vem de JWT validado por `auth.getUser`, não de `userId` enviado pelo cliente. Credenciais Gemini são cifradas por AES-GCM com nonce aleatório e secret server-side; grants diretos são revogados em 0006. Limites de payload e uso existem.
- RPCs derivam owner de `auth.uid()`. Tabelas de negócio têm RLS e vínculos compostos por owner, com leitura própria e escrita por RPC. Isso reduz risco de referência entre usuários; a implantação dessas regras precisa ser conferida.
- Fotos usam bucket privado e URL assinada por 1 hora. URLs assinadas continuam sendo credenciais temporárias de acesso e não devem ser publicadas em logs/suporte.
- Respostas externas são validadas na função IA, erros não devolvem corpo bruto do provedor e logs visíveis de IA são metadados. Conteúdo não confiável do onboarding pode influenciar o resultado, mas não recebe ferramentas para executar SQL/comandos; confirmação do relatório continua necessária.
- Journals de negócio/Chat incluem host e usuário, geração invalida respostas atrasadas e logout limpa o store. Rascunhos auxiliares fora desses serviços são a exceção P1-12.
- Sessão é renovada conforme AppState; falhas temporárias não são tratadas automaticamente como logout. Abrir app fechado sem internet depende de verificação remota e pode bloquear o uso até reconectar. **Não há modo offline completo**, como também documenta o relatório de persistência anterior.
- Não foi encontrada service role ou chave Gemini embutida nos arquivos de configuração/aplicativo inspecionados. Chave publicável Supabase não é segredo. Isso não atesta todo o histórico Git, artefato APK ou configurações de contas externas.

## APK, ambiente e distribuição

`eas.json` já tem `preview.distribution = internal`, suficiente para produzir APK no fluxo EAS documentado; **não é um bloqueador faltar `android.buildType: apk` explícito**. `production` é destinado ao fluxo de loja/AAB por padrão. Para teste fechado independente de Metro, usar o perfil preview e conferir o artefato; development client não é o release a enviar. Referência: [APK com EAS](https://docs.expo.dev/build-reference/apk/).

Configuração pública resolve package `com.zluhcastro.lumio`, versão `1.0.0`, owner/project EAS, scheme, ícone/splash e adaptive icons. Não há diretórios nativos presentes no inventário inicial; a compilação dependerá dos config plugins. Nenhum certificado/versionCode remoto foi verificado. Preview não tem autoIncrement explícito; garantir versionCode adequado para atualização por cima da versão anterior. A assinatura precisa ser compatível; trocar certificado obriga outro caminho de instalação e pode causar perda do armazenamento local se houver desinstalação.

O `.env` local contém nomes públicos Supabase. `app.json.extra.supabase` fornece fallback com host real; variáveis EAS podem prevalecer sobre esse fallback. Não foi comparado o valor local/remote em EAS nesta execução. O ambiente do build deve ser intencional e corresponder ao schema verificado. Nunca incluir service role, segredo de cifragem ou chaves pessoais em `EXPO_PUBLIC_*`; valores incorporados ao app são públicos. Referência: [variáveis EAS](https://docs.expo.dev/eas/environment-variables/).

Permissão explícita de áudio está configurada e o image picker desativa câmera no plugin. Dependências/plugins podem adicionar permissões: só o Manifest final prova o conjunto efetivo. Conferir RECORD_AUDIO, permissões de mídia, INTERNET, ausência de permissões desnecessárias e backup/cleartext/debuggable. Não foi identificada necessidade de localização/contatos no código revisado.

Nova arquitetura e navegação nativa estão habilitadas; plugin próprio de barras modifica Activity/modal. Validar teclado, back, gestos, sheets e barras em APK é obrigatório. Splash em Expo Go/dev não certifica resultado release; [docs SplashScreen SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/splash-screen/). Não há configuração completa de EAS Update/`expo-updates`; distribuir novo APK é o mecanismo esperado, sem presumir correção OTA posterior.

## Checklist obrigatório antes de gerar o APK

- [ ] Corrigir P0-01 por migration nova com validação NULL-safe, revisão obrigatória e rejeição de coleções ausentes; demonstrar rollback e preservação dos dados sintéticos.
- [ ] Corrigir P0-02 preservando histórico realizado e alinhando todas as confirmações de exclusão.
- [ ] Corrigir P0-03 com recuperação/rollback de rejeição definitiva do Chat e teste de comando acima do limite.
- [ ] Definir escopo efetivo do primeiro grupo. Se incluir finanças/vendas/comissões/contratos/multidispositivo, resolver os P1 correspondentes antes da entrega, ou impedir esses fluxos temporariamente.
- [ ] Conferir schema/migrations/RLS/grants remoto e código das funções sem expor secrets; registrar que isso corresponde ao projeto que o APK utilizará. Documentação anterior não basta como nova prova.
- [ ] Validar fluxo autenticado e isolamento A/B/anônimo em ambiente isolado. Não executar smoke scripts de escrita/exclusão sobre contas reais.
- [ ] Confirmar configuração de Auth, confirmação de e-mail, SMTP, redirects e orientação de acesso. Contas descartáveis/preparadas são aceitáveis para o grupo pequeno.
- [ ] Alinhar timeouts de IA e verificar modelo com chave de projeto novo; se não oferecer IA ainda, garantir onboarding sem IA e informar a limitação.
- [ ] Disponibilizar aviso de privacidade, contato e condições de teste antes da coleta. Usar dados comerciais fictícios; não inserir dados pessoais/confidenciais no Gemini gratuito.
- [ ] Definir qual perfil/ambiente será usado, manter lockfile, confirmar `.env`/EAS/fallback e não incorporar secrets administrativos.
- [ ] Reexecutar typecheck, testes relevantes e diagnóstico de dependências; incluir os casos desta auditoria. Verificar Deno/Edge em ferramenta apropriada.
- [ ] Registrar package, versionName/versionCode e assinatura que permitirão atualização do APK; preservar cópia segura do material de assinatura.
- [ ] Definir canal de suporte, participantes, versão distribuída e procedimento para suspender testes/recuperar dados. Confirmar backup operacional antes de aceitar dados de valor.

Gerar o artefato para validação interna pode ocorrer antes de todas as correções de UX. **Distribuir a terceiros é uma decisão posterior à instalação e validação abaixo.**

## Checklist de validação no APK instalado

Executar inicialmente em contas novas e dados fictícios. Registrar APK/build, hash do arquivo, Android, modelo, rede e resultados. A aprovação precisa ser do binário que será entregue, sem depender de Metro/Expo Go.

### Instalação e ambiente

- [ ] Instalar preview release em aparelho sem ambiente de desenvolvimento; abrir com Metro desligado.
- [ ] Conferir package/versão/versionCode, certificado, APK debuggable=false e Manifest/permissões/backup. Instalar atualização por cima do APK anterior, preservando dados/sessão.
- [ ] Conferir host Supabase/configuração embutida por evidência sanitizada. Não mostrar tokens/chaves em screenshots.
- [ ] Verificar ícone/adaptive icon/splash/cold launch e fontes; modo sem rede na abertura deve mostrar falha recuperável, sem falsa confirmação de salvamento.
- [ ] Cobrir ao menos Android intermediário e Android recente, navegação por três botões e gestos, teclado/fonte aumentada e retorno após bloqueio de tela.

### Identidade, privacidade e exclusão

- [ ] Cadastro, login, e-mail confirmado/não confirmado, senha incorreta e erros de rede com recuperação.
- [ ] Renovação de sessão, background prolongado, expiração/invalidação e logout; falha temporária não deve apagar rascunhos.
- [ ] A cria registros/histórico/foto/chave; B entra no mesmo aparelho e em outro: nenhum dado, draft ou status de A reaparece.
- [ ] Deep link de tela privada deslogado/expirado não deve expor conteúdo residual nem permitir gravação.
- [ ] Senha alterada e confirmação com senha atual; avaliar comportamento das sessões existentes em outros aparelhos conforme configuração Auth.
- [ ] Exclusão só em conta descartável: senha errada não exclui; sucesso remove dados/foto/chave e purge local; falha em etapa intermediária permite retry coerente.
- [ ] Verificar aviso de privacidade, suporte e remoção no processo de adesão.

### Persistência e falhas — critérios mínimos para liberação

- [ ] CRUD de tarefa, evento, transação, cliente, fornecedor, equipe, catálogo, estoque, venda, orçamento, contrato, entrega e atendimento; ativação/ordem/desativação de Apps. Após sucesso, matar processo/reabrir e conferir em segundo aparelho.
- [ ] Cortar rede antes de enviar e durante commit; repetir toque/retry não pode duplicar receita, comissão, baixa de estoque, evento ou mensagem.
- [ ] Simular resposta perdida após gravação; reabrir e verificar recibo/idempotência e mudanças posteriores de outro aparelho.
- [ ] Fechar app com alterações pendentes; apresentar conteúdo recuperado e confirmar sem repetir a operação.
- [ ] Mesmo campo alterado em dois aparelhos gera decisão explícita; alterações independentes preservam ambas. Exclusão versus edição e venda versus baixa/pagamento precisam preservar invariantes.
- [ ] Rejeição de nome/texto/tamanho/valor/referência inválidos não trava o restante da conta. Verificar especialmente Chat.
- [ ] Testar logout com pendências, escolha de preservar/descartar e login posterior sem perda inesperada.
- [ ] Onboarding interrompido em cada fase recupera resposta/progresso/relatório; concluir deve atualizar registro, preferências e flag conjuntamente.
- [ ] Restauração do Chat mantém ordem/cards e não executa comandos nem permite repetir ações históricas.

### Integridade comercial

- [ ] Cliente/contrato com receita confirmada: excluir/arquivar não apaga histórico prometido.
- [ ] Venda concluída com comissão: editar total/funcionário, pagar, cancelar e reconcluir sem duplicação/incompatibilidade.
- [ ] Editar/excluir/desfazer lançamento derivado de venda, frete, contrato, compra e obrigação mantém origem coerente.
- [ ] Financeiro e Chat retornam mesmo saldo para realizado/previsto, fornecedores pendentes e contratos recebidos.
- [ ] Períodos de anos diferentes não misturam dados; cobrir dezembro/janeiro e cobrança dia 31/fevereiro.
- [ ] Aprovação de orçamento não gera dois pedidos; atendimento/entrega atualiza evento e financeiro de modo coerente; estoque insuficiente impede venda e não deixa catálogo/efeitos parciais.

### Recursos nativos e IA

- [ ] Voz em português: permitir/negar/bloquear microfone, voltar, trocar tela, background, serviço ausente e rede instável; entrada manual sempre disponível. Confirmar se o serviço processa remotamente e informar corretamente.
- [ ] Foto: cancelar picker, imagem grande/HEIC, rede interrompida, upload concorrente e URL expirada, sem crash ou falso sucesso.
- [ ] Sheets/formulários: primeiro Back fecha teclado, descarte é previsível, campos/rodapé acessíveis e sem barras erradas em Android release.
- [ ] Chave IA nova/existente, inválida, sem quota, modelo indisponível, salvar/remover, login em segundo aparelho, timeout e saída tardia.
- [ ] Relatório IA com respostas longas/adversariais, JSON truncado/erro, retry e opção sem IA/simulação. Nenhuma falha deve concluir onboarding falsamente ou consumir chamadas sem controle percebido.
- [ ] Medir abertura, envio e listas com volume sintético; recolher logs Android sanitizados para falha de RN/Kotlin/Hermes e consumo excessivo.

## Ordem recomendada de correção

1. **Contrato de gravação e rejeições:** P0-01 + P0-03 + validação de payloads. Primeiro estabilizar RPC/limites/rollback e testes sobre código real; depois implantar migration nova e confirmar versões cliente/servidor. Evita corrigir cada formulário com regras incompatíveis.
2. **Integridade e histórico comercial:** P0-02 + P1-01/04/05 + datas de contrato. Definir arquivamento, origem dos lançamentos, edição pós-pagamento e invariantes de venda/estoque/comissão/entrega antes de mudar telas e merge.
3. **Datas e cálculo financeiro:** P1-02/03 + P2-06. Definir modelo de data/realização, planejar migração e reaproveitar cálculo entre tela/Chat/documentos; depois corrigir filtros e labels.
4. **Recuperação e isolamento local:** P1-06/10/11/12. Separar drafts por owner, exibir pendências, limpar após exclusão e proteger sessão/backups sem prejudicar recuperação.
5. **IA e adesão ao teste:** P1-07/08/09/14 + P2-03. Timeouts/modelos compatíveis, quota/custos, aviso de dados e fluxo de cadastro. Não exigir IA para concluir onboarding.
6. **Validação de implantação e release:** P1-13 e ambos os checklists. Conferir segurança/configuração real, gerar preview, instalar e executar persistência em dois aparelhos. Só então entregar ao grupo definido.
7. **Escala e manutenção:** P2 de desempenho/limites/fotos/fontes/UX, P3 de testes, legado e operação. Medir antes de decidir reestruturações grandes.

## Teste fechado versus lançamento público

| Tema | APK para grupo restrito | Lançamento público |
| --- | --- | --- |
| Integridade/autorização | P0 resolvidos, isolamento comprovado e teste de persistência obrigatório. | Mesmos requisitos com cobertura/monitoramento maiores. |
| Escopo de módulos | Pode reduzir módulos e usar dados fictícios; restrição deve ser efetiva. | Funcionalidades anunciadas precisam estar coerentes e sustentáveis. |
| Privacidade | Aviso prévio, contato, finalidade, compartilhamento e exclusão; limite de dados de teste. | Acesso permanente no produto, processos completos e declarações exigidas pelas lojas. |
| Instalação | APK release assinado, link para destinatários conhecidos, versão identificável e suporte. | Regras atuais de loja, formato/metadata, classificação, declarações e suporte público. Não verificados nesta auditoria. |
| Auth | Contas preparadas e suporte manual podem servir. | Recuperação/reenvio robustos e proteção contra abuso em escala. |
| Monitoramento | Registro manual de bugs e logs sanitizados pode bastar. | Métricas/crashes, quotas e resposta a incidentes estruturadas. |
| OTA/push/pagamento | Opcionais; não bloqueiam teste. | Só necessários se fizerem parte do produto anunciado. |

**Decisão prática:** corrigir os três P0, resolver ou impedir os P1 do escopo escolhido, fornecer informação de privacidade e comprovar o APK/Supabase em testes isolados. Os testes locais verdes são uma base útil; os achados reproduzidos mostram por que não são, sozinhos, autorização técnica para distribuição.
