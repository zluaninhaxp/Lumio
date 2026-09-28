# Auditoria de persistência e segurança (24/09/2026)

## Inventário verificado

| Dados | Categoria | Implementação atual | Destino necessário |
| --- | --- | --- | --- |
| Usuários, senhas e sessão fictícia | autenticação e segredo | `userRepository`, `authRepository`, `authService` usam `AsyncStorage` quando Supabase não está configurado | Supabase Auth; migração de contas legadas requer comprovação de posse da senha, sem transportar a senha em texto claro para uma tabela |
| Sessão Supabase | autenticação | SDK Supabase com `AsyncStorage` para refresh token | mecanismo de sessão do SDK, preferivelmente armazenamento protegido por plataforma; não é banco de dados de usuário |
| Respostas, contexto, perfil, plugins | dado do usuário e preferências | `onboardingRepository` usa `onboarding_records` com fallback local | tabela `onboarding_records` com RLS e migração idempotente dos registros legados |
| Marcadores aprendidos | dado do usuário | `learnedIntentRepository` usa `learned_intent_markers` com fallback local em erros remotos | tabela existente com RLS; migração idempotente dos marcadores legados |
| Perfil, papel, telefone e foto | dado do usuário e imagem | tabela `profiles`; campo `photo` aceita URI arbitrária | perfil com validação de campos; foto em bucket privado com validação e URL temporária |
| Chave pessoal Gemini | segredo do usuário | `SecureStore` ou fallback XOR/HMAC em `AsyncStorage`, com chaves de ofuscação no bundle; chamadas Gemini saem do cliente | serviço backend com chave criptografada em repouso e invocação proxy com autenticação e rate limit |
| Tarefas, eventos, transações, estoque, catálogo, clientes, pedidos, entregas, contratos, orçamentos, fornecedores, equipe, comissões, atendimentos, itens genéricos | dados persistentes do usuário | `src/store/index.ts`: Zustand em memória, sem persistência | tabelas de domínio com FKs por proprietário e RLS, operações transacionais e hidratação após login |
| Mensagens, formulários, estado de carregamento e navegação | estado temporário | Zustand/React em memória | memória, com descarte no logout |
| Preferências de conta | preferência | constante `AccountStorageKeys.PREFERENCES` sem uso encontrado | modelar por campo/perfil quando houver fluxo real |
| Assets de mascote e ícones | dado público da aplicação | arquivos versionados em `assets/` | bundle público |
| URL e chave `sb_publishable_...` | configuração pública | `app.json` e variáveis `EXPO_PUBLIC_*` | podem permanecer públicas; nenhuma service role key encontrada no código examinado |

## Achados de segurança

- As tabelas existentes têm RLS por `auth.uid()` para leitura/escrita de perfil, onboarding e marcadores. `businesses` e `business_members` só permitem leitura conforme vínculo. A política de `onboarding_records` não inclui exclusão, embora o cliente tente excluí-lo.
- O cliente envia `user_id` para operações Supabase. As policies atuais impedem acesso cruzado nas três tabelas, mas serviços futuros devem derivar identidade da sessão validada, não do parâmetro.
- O fallback local de autenticação guarda senha em texto puro e cria token fictício. Uma build sem configuração Supabase não atende aos requisitos de segurança.
- A chave Gemini é recuperável de um fallback com segredo embutido no bundle e é enviada diretamente ao provedor pelo aplicativo. Não há backend de IA nem rate limit confiável.
- Não há backend para as entidades do Zustand. Fechar o aplicativo perde esses dados. Mesmo com Supabase configurado, isso não cumpre o critério entre dispositivos.
- `profiles.photo` é texto livre. Não há pipeline de upload, verificação de bytes, limites ou bucket privado no fluxo atual.
- A exclusão de conta em `authService` exclui `profiles` e encerra a sessão, mas não exclui `auth.users`; o usuário poderá voltar a autenticar. Precisa de função administrativa autenticada e testes.
- A proteção contra abuso de login/cadastro depende das configurações hospedadas de Supabase Auth; não há limites de IA, upload ou escritas do aplicativo.

## Plano de migração seguro

1. Disponibilizar e testar migrations de tabelas de domínio e policies em ambiente Supabase isolado. Cada registro deve carregar proprietário derivado de `auth.uid()` ou associação de negócio validada. FKs compostas devem impedir referências entre proprietários.
2. Criar funções/Edge Functions para IA, segredos, uploads e exclusão de conta. Configurar rate limits em armazenamento compartilhado no servidor, validação de entrada e respostas sem segredos.
3. Alterar serviços e telas para leituras/escritas remotas com loading, retry e sincronização. Remover a rota de conta local apenas depois de fornecer migração de contas antigas. Não há forma segura de vincular automaticamente uma conta local a uma identidade Supabase sem autenticar novamente o titular.
4. Migrar registros legados por chave, sob sessão autenticada, com validação e identificador de migração. Confirmar conteúdo persistido antes de apagar a chave local. Falhas devem conservar os dados locais para nova tentativa e não autorizar novas gravações ali.
5. Após migração de credenciais pessoais para serviço criptografado, remover a ofuscação e os segredos embutidos no bundle. Revogar chaves que possam ter sido expostas.
6. Testar isolamento A/B, sem sessão, IDs manipulados, concorrência, upload, limites, logout, idempotência e interrupção da migração. Executar varredura final de código e bundle.

## Estado da implementação (24/09/2026)

- `0004_business_state.sql` cria relações separadas para 16 coleções de domínio, preferências, revisão, FKs compostas por proprietário e RPCs transacionais `get_business_state` / `replace_business_state`. Os IDs legados de texto são preservados. Os campos centrais são gerados e validados no banco; os campos opcionais continuam em JSON por registro, não em uma tabela única do Zustand.
- `businessStateService.ts` hidrata o Zustand após autenticação, observa mudanças, grava snapshots com revisão e desfaz mudanças rejeitadas. Há banner de salvamento/erro e tentativa de flush ao ir para segundo plano. Logout limpa coleções, onboarding e mensagens da memória.
- Autenticação fictícia foi removida de `authService`; Supabase Auth é obrigatório. `onboardingRepository` e `learnedIntentRepository` não gravam mais em armazenamento local. A migração legada lê registros antigos, exige identidade autenticada e confirmação remota antes de excluir cópias. Contas locais com ID diferente só são vinculadas quando o usuário fornece a mesma senha antiga durante login/cadastro Supabase.
- `0005_private_services.sql` cria credenciais cifradas, rate limit compartilhado, bucket privado, políticas restritivas de storage e validações adicionais. `ai` intermedeia Gemini e usa AES-GCM com chave apenas no ambiente da função; `photo` valida WebP por bytes e dimensões; `delete-account` revalida senha e chama Auth Admin. Os limites implementados são: IA geração 20/h, teste 10/h, gravação/remoção de chave 10/h, status 60/h, fotos 12/h, URL de foto 120/h, exclusão 5/h, snapshots 600/h e escritas diretas de perfil/onboarding/marcadores 300/h por usuário e tabela.
- A UI redimensiona fotos para até 512 px e comprime em WebP antes de enviar binário, limitado a 1 MB. O servidor gera o nome, controla o bucket e fornece URL assinada por uma hora.
- O segredo de ofuscação XOR/HMAC antigo e a chamada direta ao Google foram removidos do cliente. Chaves antigas do SecureStore/fallback não são atribuíveis com segurança a uma conta específica: o usuário precisa cadastrá-las novamente. Após confirmação remota da nova chave, a cópia antiga é apagada. Chaves pessoais expostas em versões anteriores devem ser revogadas pelo titular no Google AI Studio.

### Limites e riscos ainda presentes

- **As migrations e Edge Functions não foram aplicadas/implantadas.** O ambiente local contém somente URL e chave pública; não há credencial administrativa nem CLI local para validar contra a instância. Até a implantação, login que dependa do novo RPC falhará.
- A escrita do Zustand continua otimista para preservar contratos síncronos das telas. O app confirma o salvamento por indicador, tenta flush em segundo plano e reverte erros, mas encerramento forçado antes da resposta da rede pode perder uma edição recente. Para garantia estrita de confirmação antes de cada ação, as ações de UI precisam migrar para operações assíncronas aguardadas.
- Exclusões de estoque, equipe e vendas agora bloqueiam a remoção quando há movimentos ou comissões pagas, preservando o histórico. Clientes e fornecedores limpam vínculos opcionais. Ainda é necessário testar todos os fluxos de CRUD contra as FKs implantadas; outros vínculos legados podem resultar em snapshot rejeitado e reversão na UI.
- O teste A/B remoto, a verificação de rate limit/Edge Functions em instância de desenvolvimento, o build nativo e a execução real das migrations seguem pendentes. Não foi verificada a versão do runtime Edge em implantação.
- O teste unitário de migração cobre confirmação, repetição e falha antes da exclusão. O caso de conflito entre cópia local e remota conserva a cópia local e exige reconciliação manual. Contas antigas com senha diferente da conta Supabase não são migradas automaticamente.
- Não há rotação automatizada de `AI_ENCRYPTION_KEY`. Antes de trocar essa chave, recriptografe as credenciais existentes ou solicite recadastro aos usuários.
- Supabase Auth precisa ter limites de login/cadastro/recuperação configurados no projeto hospedado; isto não é configurável pelo código do aplicativo.
- `npm audit --omit=dev` reportou 29 alertas nas dependências instaladas (15 altos, 14 moderados), incluindo dependências transitivas do Expo CLI. A atualização principal sugerida pelo audit é Expo 57, fora da versão 54 exigida pelo projeto; esses alertas precisam de triagem separada antes da publicação.

### Validação executada

- `npm run typecheck`: passou.
- `npm run test:security:local`: cinco testes passaram (migração e verificação de WebP).
- `npm test`: 271 passaram e 2 falharam em `src/engine/__tests__/commandEngine.test.ts` (fora dos arquivos alterados nesta intervenção).
- `npx expo export --platform web`: passou. Busca no bundle gerado não encontrou `AI_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, segredo XOR antigo nem endpoint direto Gemini. A chave `sb_publishable_*` aparece e é configuração pública.
- `scripts/security-smoke.mjs` está pronto para exercitar isolamento A/B, referência cruzada, sessão anônima, revisão, IA, upload e exclusão após implantação. Ainda não foi executado.

### Aplicação no projeto de desenvolvimento correto

1. Instalar/autenticar a CLI Supabase e vincular o projeto de desenvolvimento: `npx supabase login` e `npx supabase link --project-ref foruzsalsyqmccutvhdu` **somente se essa referência for o projeto de desenvolvimento pretendido**.
2. Aplicar `0004_business_state.sql` e `0005_private_services.sql` com `npx supabase db push`. Verificar as migrations existentes `0001`–`0003` no histórico antes do push.
3. Criar uma chave aleatória de 32 bytes, codificar em Base64 e configurar `AI_ENCRYPTION_KEY` como segredo da Edge Function (`npx supabase secrets set --env-file <arquivo-privado>`). Nunca usar `EXPO_PUBLIC_*` nem versionar o arquivo.
4. Implantar `npx supabase functions deploy ai`, `npx supabase functions deploy photo` e `npx supabase functions deploy delete-account`.
5. Em instância isolada, fornecer `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` **somente ao processo de teste**, depois executar `npm run test:security:remote`. Configurar no Dashboard os limites de Supabase Auth para login, cadastro e recuperação de senha.

### Checklist final

- [x] Migrations criadas
- [ ] Migrations aplicadas
- [ ] RLS habilitado na instância
- [ ] Policies testadas na instância
- [ ] Dados Zustand recuperados remotamente em dois dispositivos
- [x] Hidratação implementada no aplicativo
- [x] Logout limpa estado privado em memória
- [x] Autenticação local insegura removida do fluxo ativo
- [ ] Migração legada completa para todos os usuários e chaves
- [x] Gemini removido do cliente
- [ ] Segredo protegido server-side na instância
- [ ] Rate limit server-side implantado e testado
- [ ] Upload privado implantado e testado
- [x] Compressão de imagem implementada no cliente
- [ ] Exclusão real de conta implantada e testada
- [ ] Testes A/B remotos realizados
- [ ] Testes remotos de abuso realizados
- [x] Typecheck aprovado
- [x] Suíte completa de testes aprovada (273/273 em 24/09/2026)
- [ ] Build nativo aprovado
- [x] Varredura do bundle web realizada

## Fechamento local de 24/09/2026

Esta seção substitui o estado de validação local anterior; os achados históricos acima descrevem o estado antes da implementação. Nenhuma migration foi aplicada e nenhuma Edge Function foi implantada nesta etapa.

- Revisados os arquivos locais `0001`–`0005`, as três funções, `businessStateService`, `legacyMigrationService` e o smoke script. `0001` cria tabelas e trigger de Auth; `0002` acrescenta campos de perfil; `0003` cria marcadores e altera payloads de onboarding existentes. Esse `UPDATE` de `0003` precisa ser avaliado contra dados reais antes de aplicá-lo a um banco existente. `0004` cria novas tabelas, policies e RPCs. `0005` cria tabelas privadas, triggers, bucket/policies e restrições `NOT VALID`; estas últimas ainda são exigidas para linhas alteradas após a migration, de modo que perfis com foto legada precisam de tratamento antes de atualizar o perfil. A compatibilidade com o schema remoto e ausência de colisões de nomes não foram verificadas.
- Nenhum projeto Supabase de desenvolvimento foi confirmado. Este workspace não tem CLI Supabase, link local, credencial administrativa ou variáveis `SUPABASE_*` disponíveis. A URL e chave pública do app não comprovam o ambiente de destino. Assim, não foi possível consultar `migration list`, comparar schemas, fazer `db push`, configurar secrets, publicar funções ou executar `test:security:remote`.
- O parser de comandos tinha colisão preexistente entre menu e alias de inclusão; a implementação foi corrigida sem alterar os testes. `npm test`: 273/273. `npm run typecheck`: passou. `npm run test:security:local`: 5/5. `npx expo export --platform web` e `--platform android`: passaram. A exportação Android valida o bundle JS, não equivale a build nativo instalável. Não há script de lint configurado.
- A ação explícita de salvar negócio aguarda `businessStateService.commit()` antes do aviso de sucesso. O banner global continua indicando salvamento ou erro para as demais ações otimistas. Um encerramento forçado antes da confirmação ainda pode perder a última edição; a confirmação individual de todos os fluxos exigiria alteração assíncrona de cada ação de UI e não foi feita nesta etapa.
- Busca em `app`, `src`, `assets`, `scripts`, `supabase`, configuração e bundles exportados: nenhuma referência a `AI_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou endpoint direto Gemini foi encontrada no bundle. Os nomes dos segredos aparecem apenas no código de servidor e no script de teste. Isso não substitui inspeção de um build distribuído.
- O smoke script remoto cobre isolamento A/B, chamadas anônimas, IDs manipulados, FK, revisão, tentativa de upload cruzado, rejeição de foto inválida, rate limit de escrita de chave, não retorno da chave e exclusão Auth. Ele ainda não cobre upload válido com leitura de URL privada, geração de IA com credencial válida, todos os limites de taxa nem a migração legada executada remotamente. Esses cenários continuam [ ] mesmo após eventual execução do script sem ampliação dos testes.

### Sequência de implantação no desenvolvimento

1. Confirmar fora desta conversa o project ref de **desenvolvimento** e autenticar a CLI Supabase. Não reutilizar automaticamente o ref presente na configuração do app.
2. Consultar `npx supabase projects list`; vincular com `npx supabase link --project-ref <DEV_REF>`; confirmar `npx supabase migration list`. Antes do push, comparar `0001`–`0003` com o histórico remoto e consultar schema, policies, funções, bucket e registros legados afetados. Resolver qualquer divergência sem `db reset` nem reparo cego do histórico. Fazer backup verificável do projeto de desenvolvimento.
3. Inspecionar o SQL pendente com `npx supabase db push --dry-run`. Aplicar `npx supabase db push` apenas após confirmar que o alvo e o histórico correspondem e que `0004`/`0005` não colidem com objetos existentes. Confirmar novamente o histórico e os objetos criados.
4. Gerar `AI_ENCRYPTION_KEY` localmente com RNG criptográfico de 32 bytes e Base64, em arquivo temporário fora do Git, sem exibi-la. No PowerShell: `$secretPath = Join-Path $env:TEMP 'lumio-supabase-secrets.env'; $keyBytes = [byte[]]::new(32); [System.Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes); [System.IO.File]::WriteAllText($secretPath, 'AI_ENCRYPTION_KEY=' + [Convert]::ToBase64String($keyBytes))`. Aplicar com `npx supabase secrets set --env-file $secretPath --project-ref <DEV_REF>` e remover o arquivo com `Remove-Item -LiteralPath $secretPath`. Não imprimir a chave, versionar o arquivo, nem usá-la em `EXPO_PUBLIC_*`. Não girar a chave após haver credenciais cifradas sem plano de recifragem.
5. Implantar, nessa ordem, `npx supabase functions deploy ai --project-ref <DEV_REF>`, `photo` e `delete-account` com a mesma opção. Verificar no projeto as variáveis padrão de Supabase das funções, `AI_ENCRYPTION_KEY`, autenticação e permissões, sem imprimir seus valores.
6. Em projeto isolado, fornecer URL, chave pública e service role somente ao processo de teste e executar `npm run test:security:remote`. O script cria e exclui usuários de teste; conferir seu relatório e executar separadamente os cenários ainda não cobertos. Não rodá-lo contra produção.
7. Em dois dispositivos/instalações limpas apontando para o desenvolvimento: A cria tarefa, evento, transação e altera perfil; fecha o app. B entra na mesma conta e confere todos os dados; altera um item. A reabre e confirma a alteração. Registrar resultado antes de marcar persistência entre dispositivos como concluída.

### Evidência remota pendente

- [ ] Project ref de desenvolvimento e histórico remoto confirmados
- [ ] `0001`–`0003` conciliadas com schema e dados remotos
- [ ] `0004`/`0005` aplicadas sem perda de dados
- [ ] Secret configurado e funções implantadas
- [ ] Isolamento A/B, sem autenticação, IDs manipulados, RLS e policies testados
- [ ] IA autenticada, rate limits e segredo não recuperável testados na instância
- [ ] Upload privado válido e tentativa de namespace alheio testados
- [ ] Exclusão real de conta e migração idempotente testadas remotamente
- [ ] Teste obrigatório entre dois dispositivos concluído
- [ ] Build nativo instalável validado

## Inspeção remota de desenvolvimento (24/09/2026)

Project ref confirmado e consultado: `foruzsalsyqmccutvhdu`. A CLI autenticada respondeu às consultas. Não foi executado `db push`, `migration repair`, alteração de secrets ou deploy.

- `npx supabase migration list --linked` retornou migrations locais `0001`–`0005` sem qualquer versão remota registrada.
- Consultas read-only encontraram no remoto exatamente as tabelas base `profiles`, `businesses`, `business_members`, `onboarding_records` e `learned_intent_markers`; colunas, constraints, função `handle_new_user`, trigger `on_auth_user_created`, policies e RLS habilitado correspondem às migrations `0001`–`0003` inspecionadas. Logo, o schema base existe, mas o histórico remoto não registra essas migrations.
- A migration `0003` remove `learnedIntentMarkers` de `structured_profile`. Foram encontrados 5 registros de onboarding e zero ocorrências dessa chave, portanto esse trecho não removeria dados atualmente armazenados.
- Não foram encontrados nomes de tabelas/trigger/policies de `0004`–`0005` no remoto. O bucket `profile-photos` não existe. Consultas agregadas encontraram zero perfis com foto fora do novo formato, zero perfis fora dos limites de campo, zero payloads de onboarding fora dos limites e zero marcadores fora dos limites.
- O dump de schema remoto não foi concluído porque o CLI exige Docker/Podman, indisponível neste computador. A comparação foi feita com catálogos via Management API; portanto não equivale a um diff integral de todos os objetos gerenciados.
- **Bloqueio deliberado:** há divergência entre estado do banco (schema de `0001`–`0003` já aplicado) e histórico (sem registros). Conforme a instrução de parar diante de conflito de migrations, não rodei `db push` nem `migration repair`. O próximo passo requer decisão explícita sobre reconciliar o histórico marcando `0001`–`0003` como aplicadas (sem reexecutar seus SQLs) ou disponibilizar ambiente/fonte autoritativa que explique a ausência do histórico. Não apagar nem regravar linhas do histórico.
- Como as migrations não foram aplicadas, `AI_ENCRYPTION_KEY` não foi gerada/configurada, nenhuma Edge Function foi implantada e o smoke test remoto não foi executado.

## Correção do smoke remoto (24/09/2026)

- O primeiro `npm run test:security:remote` avançou até a checagem do upload acima do limite; o endpoint respondeu `503` em vez de `413`. As funções remotas `ai`, `photo` e `delete-account` estavam ativas. No handler `photo`, o cancelamento do stream excedente era aguardado sem tratar rejeição; isso podia cair no `catch` geral e virar `503`.
- Ajustei a leitura para tolerar falha de cancelamento e preservar o retorno `413`; implantei somente `photo` no projeto confirmado. A listagem read-only confirmou `photo` ativa na versão 2. O smoke completo ainda precisa ser repetido pelo operador no terminal que já contém as três variáveis de ambiente; não foi marcado como aprovado.
- A repetição ainda retornou `503`, portanto a hipótese do cancelamento não foi confirmada como causa. O smoke script concluiu as verificações seguintes sem outras falhas. Corrigi a captura diagnóstica: a tentativa anterior de ler o corpo exigia `context instanceof Response`, então a ausência de texto no terminal não prova que a resposta HTTP estava vazia. A origem ainda está pendente de diagnóstico; não marcar upload como validado.
- O JSON bruto do log da invocação mostrou `request.pathname=/functions/v1/photo`, JWT autenticado, `request.headers.content_length=1048577`, status 503, resposta de 0 bytes e `execution_time_ms=160009`. Isso confirma que a execução alcançou o runtime e ficou presa até o timeout; a chamada de `reader.cancel()` aguardada era a causa compatível com esse comportamento. Alterei-a para não bloquear a resposta e movi a rejeição pelo `Content-Length` antes do rate limit. Publiquei `photo` versão 3 e confirmei-a com `functions list`. O smoke precisa ser repetido para validar que o retorno agora é 413.
- O log bruto pós-deploy para request ID `01a0d3d0-7b74-71b0-a32e-6028a108769a` mostra 503 após `160011 ms`, resposta de 0 bytes, `execution_id`, `function_id` e `deployment_id` nulos, e nenhum log da função. A versão ativa era `photo` 3 e seu fonte implantado foi confirmado. Pela classificação documentada pelo Supabase, IDs de execução/função vazios apontam falha interna de gateway/plataforma, sem evidência de resposta gerada pelo handler. O limite de upload permanece não validado remotamente; não fazer novas alterações de código com base neste evento. Solicitar investigação ao Supabase com o request ID e horário UTC.

## Otimização de foto no cliente (24/09/2026)

- A seleção não limita o tamanho do arquivo original. O cliente redimensiona a maior dimensão para até 512 px, preservando proporção, e gera WebP em até cinco tentativas com qualidades 0,85, 0,70, 0,55, 0,40 e 0,30. Somente o Blob final de até 1.048.576 bytes é enviado. Se nenhuma tentativa couber no limite ou o processamento falhar, o usuário recebe erro e não ocorre upload.
- O indicador de carregamento existente em `app/profile.tsx` envolve seleção, processamento, envio e obtenção da URL assinada. A Edge Function e as regras de Storage permanecem como antes.
- O smoke remoto aceita 413 da função ou 503 do gateway apenas como rejeição do teste de bypass, e verifica que perfil e Storage do usuário de teste não receberam foto. Quando recebe 503, avisa explicitamente que a resposta 413 da função ainda não foi verificada. O operador executou a versão revisada no terminal configurado: o upload excessivo recebeu 503, as verificações de não persistência passaram e o script concluiu com sucesso os testes de isolamento A/B, acesso anônimo, FK e revisão. A resposta 413 do handler permanece sem confirmação remota.
- Verificação local: `npm run typecheck` passou; dois testes da compressão adaptativa passaram; `npm run test:security:local` passou (5 testes); `npm test` passou (273 testes). O smoke remoto revisado também passou no terminal do operador, com a ressalva de que o gateway respondeu 503 ao payload excessivo. Ainda falta executar em dispositivo o fluxo com originais de 2 MB e 5 MB e confirmar upload e leitura autorizada do WebP privado.
