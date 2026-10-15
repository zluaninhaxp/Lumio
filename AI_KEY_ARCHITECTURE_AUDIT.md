# Auditoria da chave de IA — Lumio

Data: 28/09/2026. Projeto Supabase vinculado: `foruzsalsyqmccutvhdu`.

## Escopo e evidências

A busca e leitura do fluxo foram feitas antes das alterações de produção. Foram examinados app, services, hooks, contexts, store, providers, cliente Supabase, configuração Expo, nomes das variáveis de ambiente, scripts, legado, SQL, migrations e Edge Functions. Valores de segredos não foram registrados. Não existe `.env.example` no checkout. A configuração cliente contém somente URL/chave pública do Supabase; persistir a sessão de autenticação continua permitido e é independente da chave do Gemini.

Também foram examinados a função efetivamente implantada, metadados dos secrets, estrutura da tabela, grants e policies do projeto vinculado. A função antiga baixada era idêntica à local por SHA-256. Existiam duas credenciais antes da auditoria, mantidas intactas após os testes. Não foram lidos seus valores para o cliente nem rotacionado o segredo de criptografia.

## Fluxo encontrado antes da correção

| Operação | Caminho real | Origem/destino |
| --- | --- | --- |
| Configurar | `app/ai-settings.tsx` → `handleSave` → `secureKeyStorage.setApiKey` → Edge `ai`, `set_key` | JWT → `owner_id`; AES-GCM → `ai_credentials`. A função aceitava qualquer string do tamanho permitido, sem validar no provedor. |
| Testar | Settings → `aiProvider.testKey` → `geminiProvider` → Edge `ai`, `test` | A função buscava a credencial cifrada do usuário autenticado; não usava o input digitado. Prompt simples pedindo `ok`. |
| Verificar | Settings → `refreshKeyInfo` → `secureKeyStorage.hasApiKey` → Edge `ai`, `status` | Existência da linha do usuário. `hasKey` era estado de tela, atualizado somente no mount, sem vínculo com a conta. |
| Gerar | Onboarding → Settings → `/celebration` → `extractBusinessProfile` → `geminiProvider.generate` → Edge `ai`, `generate` | Mesmo JWT/tabela/decifragem do teste, mas prompt montado no cliente, saída JSON maior e parsing no cliente. |
| Configurar depois | `app/profile.tsx` → mesma `/ai-settings` | Mesmo service/backend, sem iniciar automaticamente uma nova personalização. |
| Logout/troca | `AuthContext` → `authService.logout`/login/register; store de negócio limpo | O estado local da tela de IA não era explicitamente associado à identidade. Consulta atrasada e tela mantida montada podiam preservar o status anterior. |

O nome `secureKeyStorage` e os textos da celebração estavam desatualizados: a implementação auditada já salvava no backend. O módulo continha somente remoção tardia dos nomes legados `@lumio/ai-api-key` (SecureStore, serviço `lumio-ai`) e `@lumio/ai-api-key-fallback` (AsyncStorage), executada depois de salvar/remover. Não lia ou migrava uma chave local nesse checkout.

Outros armazenamentos auditados: `src/lib/supabase.ts` persiste a sessão de autenticação; `storageService`/`legacyMigrationService` acessam dados antigos de contas/negócio; Zustand mantém dados do negócio em memória. Nenhum desses caminhos grava/lê uma chave de IA atualmente. Não foi encontrado fallback de chave em `.env`, Expo, Redux/Zustand persist ou localStorage.

## 1. Falso “chave configurada”

Defeito confirmado no código: Settings fazia a consulta uma vez, com callback sem dependência do usuário, mantinha um boolean de tela e aceitava respostas assíncronas sem verificar se a sessão ainda era a mesma. Assim, o status de A podia permanecer ou chegar depois da troca para B. O onboarding tampouco consultava o status real na transição para IA.

Não foi encontrado um backend buscando a chave de outro usuário: a consulta antiga já filtrava pelo usuário obtido do JWT. Não houve evidência de segredo retornado ao app. A corrida entre sessões é uma causa demonstrável no código; a sequência exata do relato no Android não foi reproduzida durante esta execução, pois o aparelho não estava conectado ao finalizar a auditoria.

Correção: quatro estados, consulta no foco vinculada ao `userId`, bloqueio síncrono do status de outra conta, invalidação de requisições antigas, confirmação de sessão antes/depois da chamada e formulário remontado por identidade. O teste automatizado cobre resposta tardia de A após B entrar.

## 2. Onde a chave era armazenada e lida

Backend: `public.ai_credentials`, PK `owner_id` → `auth.users`, `nonce`, `ciphertext`, `key_version`, `updated_at`. Criptografia AES-GCM via Web Crypto, nonce aleatório de 12 bytes e chave server-side de 32 bytes em Base64 no secret `AI_ENCRYPTION_KEY`. Esse mecanismo foi reutilizado, sem rotação ou criptografia nova.

Não havia coluna plaintext `api_key`. A função recuperava e decifrava somente no servidor. O segredo do Gemini é enviado ao Google em `x-goog-api-key`, nunca em URL ou resposta normal ao app. Dispositivos antigos podem ter cópias de versões anteriores; agora os dois nomes conhecidos são excluídos ao iniciar, autenticar e sair, sem leitura/migração.

## 3. Por que “Testar conexão” podia funcionar

No código auditado, teste e geração já usavam a mesma credencial do banco e a mesma Edge Function. A hipótese de dois locais diferentes de chave não se confirmou.

O teste anterior exigia apenas uma resposta curta não vazia, sem schema JSON. Isso prova acesso ao provedor com a chave salva, mas não prova que uma personalização extensa esteja dentro do prazo, completa ou válida. O teste também não validava uma chave recém-digitada ainda não salva.

Agora o teste aceita opcionalmente uma chave transitória e não a persiste. Sem draft, usa exatamente a credencial do banco utilizada pela geração. Salvar também valida no mesmo caminho do provedor antes da gravação.

## 4. Por que a personalização podia falhar

Falhas concretas encontradas:

- `JSON.parse` lançava `SyntaxError`, mas o retry do cliente só tratava `AIProviderError('bad-format')`; JSON malformado não recebia a correção prevista.
- A função não validava schema nem `finishReason`, podendo devolver JSON truncado como sucesso.
- Timeout, erro de banco/decifragem e exceções de rede caíam em um único `service_unavailable`, escondendo a origem.
- A função não respondia ao preflight CORS do navegador.
- O callback de foco da celebração dependia de `phase`. Ao entrar em `missing-key`, podia disparar novas tentativas enquanto a tela seguia focada, consumindo limite sem configurar uma chave.

Esses defeitos foram corrigidos. Não há resposta histórica do provedor que permita afirmar qual deles causou a falha específica relatada. A validação final com chave válida e Gemini real ainda está pendente; não foi substituída por uma afirmação de sucesso baseada em mock.

## 5. Arquitetura implementada

`app → invokeAiBackend → JWT validado no servidor → owner_id → credencial AES-GCM → Gemini → resposta validada → app`.

Uma função `ai` implementa `status`, `set_key`, `delete_key`, `test`, `generate`. Todos os payloads têm campos permitidos; IDs arbitrários e chave/prompt no payload de geração são rejeitados. A identidade vem de `admin.auth.getUser(JWT)`, não de parâmetros do cliente.

`status` retorna apenas `{ configured: boolean }`. Não confunde erro de consulta com ausência de chave. A UI distingue `loading`, `configured`, `notConfigured`, `error`. Ao continuar, o onboarding confirma novamente o status; se configurado, permite personalizar sem pedir outra chave.

`set_key` valida com Gemini, cifra e grava para a sessão autenticada. O input fica somente em React state e é limpo após sucesso; autofill é desativado. Troca de conta remonta o formulário. O app não recebe a chave armazenada, nem sufixo dela.

`generate` recebe apenas o DTO das respostas. O prompt existente foi movido para módulo server-side, mantendo seu conteúdo. O servidor valida o contexto e todos os campos usados da taxonomia, ignora partes de pensamento, exige resposta completa, faz no máximo uma tentativa corretiva e retorna somente o JSON validado. Os prazos são limitados, e erros de sessão, ausência de chave, consulta, chave inválida, quota, provedor, timeout, backend e formato têm mensagens distintas.

Logs registram somente ação permitida, autenticação, presença, origem, início/sucesso e código de erro controlado. Não registram key, JWT, prompt, respostas do usuário, corpo de erro do provedor ou identificadores pessoais.

As sete etapas, falas, mascotes, composer e caminho confirmado “Continuar sem IA” foram preservados. Configuração posterior usa a mesma tela/service/backend. O fallback explícito de relatório simulado já existente continua separado e identificado como simulação; não há fallback de chave nem armazenamento local de segredo.

## 6. Arquivos desta correção

- `app/ai-settings.tsx`: status por conta/foco, test de draft/salvo, limpeza do input, autofill desligado, formulário por identidade.
- `app/onboarding.tsx`: consulta de status na transição, estados de erro/loading, chave existente segue para personalização.
- `app/celebration.tsx`: corrigido retry no foco, proteção de resultado atrasado após desmontagem, texto server-side.
- `src/services/ai-backend.ts`, `ai-key-service.ts`: comunicação autenticada central e operações da chave.
- `src/hooks/use-ai-key-status.ts`: quatro estados, ownership e invalidação.
- `src/services/legacy-ai-key-cleanup.ts`, `src/contexts/AuthContext.tsx`: exclusão dos nomes legados sem migração.
- `src/ai/aiProvider.ts`, `geminiProvider.ts`, `aiOnboardingService.ts`: geração com DTO e erros tipados; removidos invocação duplicada e retry client-side.
- `supabase/functions/ai/index.ts`, `_shared/onboarding-prompt.ts`, `_shared/ai-validation.ts`: backend, prompt e contrato validado.
- `supabase/migrations/0006_ai_credentials_privileges.sql`: privilégios do banco.
- `scripts/ai-architecture.test.cjs`, `ai-security-remote.mjs`, `onboarding-flow.test.cjs`, `security-smoke.mjs`, `package.json`: testes e comandos alinhados ao contrato novo.

As alterações anteriores em `app/welcome.tsx` e `src/data/onboarding-messages.ts` já estavam no workspace; não fazem parte da auditoria da chave. Nenhum commit foi criado nesta tarefa.

## 7. Mudanças aplicadas no Supabase

Migration `0006` aplicada após `migration list` e `db push --dry-run` confirmarem que somente ela estava pendente. Função `ai` implantada pelo CLI no projeto vinculado. Nenhuma outra função foi alterada; a criptografia e as duas credenciais existentes foram preservadas. O handler continua exigindo usuário autenticado e o gateway mantém a verificação JWT existente.

Conferência remota: RLS ativo, zero grants de cliente sobre `ai_credentials`, zero policies de cliente, duas credenciais existentes e zero contas temporárias de auditoria restantes.

## 8. Migration

`0006_ai_credentials_privileges.sql`: RLS permanece habilitado; revoga todos os privilégios de `PUBLIC`, `anon`, `authenticated` na tabela de credenciais; mantém `SELECT/INSERT/UPDATE/DELETE` server-side para `service_role`. Também remove grants diretos de cliente em `private_rate_limits`; a RPC protegida continua disponível exclusivamente ao servidor.

## 9. Policies e RLS

Nenhuma policy permissiva foi criada, e RLS não foi desativado. As tabelas privadas já não tinham policies para o cliente, mas herdavam grants amplos, incluindo `TRUNCATE`, que não é protegido pelo RLS. Esses grants foram removidos. O smoke remoto confirmou bloqueio do SELECT direto até para usuário autenticado.

## 10. Legado removido

Removido `src/services/secureKeyStorage.ts`, métodos mortos de suporte/máscara e o `testKey` duplicado no provider. Removidos estado independente `hasKey`/`supported`, tratamento silencioso de falha como ausência/suporte e estilos sem uso. O prompt client-side e seu arquivo antigo foram removidos; há apenas a versão server-side. A limpeza legada somente apaga os dois nomes conhecidos e nunca os lê ou associa a uma conta.

## 11. Testes executados

- `npm run test:ai`: 7 testes passaram; handler real com IO/provedor simulados, criptografia real Web Crypto, isolamento, draft sem persistência, validação, erros, JSON truncado, JWT, CORS, payloads, troca de sessão e hook real.
- `npm run test:onboarding`: 10 testes passaram; sete etapas, preservação/volta de respostas, confirmação de skip, Settings, status configurado, erro de consulta, navegação, teste de draft sem avançar e limpeza do input após salvar.
- Suite existente de engines/store: 273 testes passaram com Node `--experimental-strip-types --experimental-test-isolation=none` (a opção evita o spawn bloqueado no ambiente).
- `tsc --noEmit`: passou.
- Exportação web Expo: passou. Busca no bundle não encontrou `AI_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, endpoint direto Google nem montagem do prompt.
- `ai-security-remote.mjs` no Supabase vinculado: 17 verificações passaram, incluindo Auth real, conta nova, ausência de chave, erro de chave inválida retornado pelo Google, não persistência de draft inválido, privilégio negado, ownership e A → logout → B sem chave. Duas contas temporárias foram criadas e removidas.

O teste remoto sem chave válida usa uma linha cifrada sintética apenas para testar status/ownership/removal, nunca para decifragem ou geração. Não deve ser descrito como geração real. A suite com provedor simulado cobre todo o percurso de geração e o JSON devolvido, mas não substitui Gemini real.

## 12. Ação manual restante

Não é necessário aplicar SQL ou implantar a função manualmente no Dashboard: isso já foi feito. Para fechar o critério completo pedido, falta executar test/save/generate com uma chave válida em uma sessão autorizada, conferir o resultado e logout/nova conta. Foi solicitada uma sessão preparada no Android, sem envio de chave/senha na conversa; no último check não havia dispositivo ADB conectado nem aba do navegador aberta.

Alternativa para um ambiente de teste confiável: `npm run test:ai:remote` com URL, chave pública e credencial administrativa somente no processo server-side. Opcionalmente `LUMIO_AI_TEST_KEY` em memória faz o script percorrer o fluxo real completo. Não colocar essas credenciais em arquivos versionados, bundle ou `EXPO_PUBLIC_*`. O script exclui suas contas isoladas em `finally`.

## 13. Secrets/env do backend

Já existentes/verificados por metadados: `AI_ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e variáveis padrão fornecidas pelo Supabase. Nenhum novo secret de produção foi necessário. A chave pessoal do Gemini pertence à linha cifrada de cada usuário, e não a uma variável global da função. Não rotacionar `AI_ENCRYPTION_KEY` sem recifrar as linhas existentes: a troca isolada impediria decifragem.

Referências primárias consultadas: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/), [CORS em Edge Functions](https://supabase.com/docs/guides/functions/cors), [limites de Edge Functions](https://supabase.com/docs/guides/functions/limits), [Gemini generateContent](https://ai.google.dev/api/generate-content).

## Acompanhamento de geração real em 30/09/2026

O usuário tentou gerar o relatório com a chave configurada e recebeu HTTP 502 com `error: provider_unavailable`. Isso comprova falha na chamada ao Gemini após a credencial ser encontrada; o campo antigo não incluía o HTTP original do provedor, então não comprova se foi 400, 404, 500 ou 503.

O handler foi atualizado para distinguir requisição inválida (400), pré-condição da conta (400), modelo indisponível (404), indisponibilidade do provedor (5xx/408) e falha de transporte, sem encaminhar corpo cru ou segredo. Erros transitórios recebem uma única tentativa adicional com espera curta e jitter; erros de cliente e cota não são repetidos. A resposta segura inclui `providerStatus` numérico quando o Gemini devolve erro HTTP. Para a geração estruturada com Gemini 2.5 Flash, o `thinkingBudget` foi limitado a 1024, preservando o orçamento de saída da taxonomia.

Essa versão foi implantada no projeto vinculado. Passaram nove testes locais de arquitetura de IA, dez testes de fluxo do onboarding, typecheck, export web e as 17 verificações remotas de isolamento e chave inválida. A geração válida com a chave pessoal continua aguardando uma nova tentativa do usuário; não há evidência de sucesso real para declará-la concluída.

Referências para esta correção: [erros e retry do Gemini](https://ai.google.dev/gemini-api/docs/troubleshooting), [thinkingBudget do Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

### Nova tentativa real e fallback

Na tentativa seguinte, o usuário confirmou `{ "error": "provider_unavailable", "providerStatus": 503 }`: o Gemini devolveu HTTP 503 mesmo com a credencial encontrada e a tentativa adicional. O Google informa que o Gemini 2.5 Flash tem acesso limitado para projetos novos e recomenda modelos mais recentes. A geração estruturada agora tenta `gemini-3.5-flash-lite` quando o 2.5 Flash devolve 503; a chave do usuário, o prompt e a validação do resultado são mantidos. O teste e salvamento da chave continuam usando o modelo original. A alternativa recebe uma única tentativa, para limitar a latência e não multiplicar requisições em caso de indisponibilidade. Não há fallback para erro de cota, chave rejeitada ou entrada inválida.

A função foi implantada como versão 6. Passaram dez testes locais de IA, dez de onboarding e typecheck. Após uma tentativa com `provider_timeout` e outra com HTTP 502, o usuário confirmou que a geração funcionou na emulação web. Isso confirma uma geração real bem-sucedida com a chave configurada, mas não identifica se aquela requisição usou o modelo principal ou o fallback; não houve nova implantação entre as tentativas.

Referências: [modelos Gemini](https://ai.google.dev/gemini-api/docs/models), [Gemini 3.5 Flash-Lite e suporte a saída estruturada](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [erro 503 do Gemini](https://ai.google.dev/gemini-api/docs/troubleshooting).

### Latência após a primeira geração bem-sucedida

O usuário confirmou que o relatório passou a ser gerado, mas percebeu uma espera considerável. Na versão 6, o 2.5 Flash era chamado primeiro e o 3.5 Flash-Lite apenas após HTTP 503, o que podia somar a espera da primeira chamada à da segunda. A versão 7 publicada inverte essa ordem para a geração: começa pelo 3.5 Flash-Lite e usa o 2.5 Flash como alternativa para HTTP 503, timeout ou modelo não disponível. Teste/salvamento da chave permanecem no 2.5 Flash. A saída estruturada continua passando pela mesma validação. Passaram 11 testes de IA, 10 de onboarding e typecheck. O ganho de tempo real ainda precisa ser medido na sessão do usuário.
