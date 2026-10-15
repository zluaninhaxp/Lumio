# Persistência e sincronização do Lumio — relatório consolidado

Data: 14/10/2026. Implementação no workspace local; migrations 0007–0009 aplicadas com sucesso ao projeto Supabase vinculado, cujo host corresponde ao configurado no `.env`. Nenhuma credencial foi alterada. O backfill previsto da tabela de preferências foi executado; não foram alterados registros de negócio por operações manuais.

## Resultado e causa do desaparecimento

O código anterior permitia que o estado local e a interface avançassem antes da confirmação remota; o Chat mantinha seu histórico na memória da tela. A restauração dependia de autenticação/hidratação e existiam autoridades concorrentes para preferências. Essas falhas explicam caminhos de perda aparente após reload. Não foi reproduzida a ocorrência específica no segundo aparelho com uma conta Supabase autenticada; diferenças de usuário, projeto ou configuração no build instalado continuam hipóteses a verificar nesse aparelho.

As seis etapas foram implementadas no código. O schema necessário também está implantado no projeto vinculado e passou pela verificação do histórico remoto. A gravação autenticada no app e a sincronização real entre dois dispositivos ainda precisam de teste ponta a ponta.

## Alterações por etapa

1. **Gravações:** `businessStateService.ts` serializa commits, consulta a revisão remota, aguarda confirmação e mantém operações e identificadores nas tentativas seguintes. Tarefas, Calendário, Financeiro, módulos e ações do Chat passam por limites de confirmação. Formulários mantêm seus dados e evitam múltiplos envios; encerramento, navegação e feedback de sucesso dependem do commit. Uma rejeição definitiva de validação permite revisar a operação, invertendo apenas sua preparação quando não há conflito com alterações posteriores.
2. **Autenticação:** `AuthContext.tsx`, `authService.ts`, `sessionErrors.ts`, `authFetch.ts` e `supabase.ts` distinguem indisponibilidade temporária de invalidação explícita. Erros de rede/hidratação oferecem recuperação sem logout. Há bloqueio de respostas atrasadas de outra conta, lock do cliente, limites de tempo para requisições e renovação de tokens conforme o ciclo de vida nativo.
3. **Dispositivos:** `syncMerge.ts` compara a base confirmada, o rascunho atual e a versão remota. Alterações independentes são combinadas; mesmo campo, exclusão versus edição, referências removidas e operações relacionadas de estoque/financeiro geram conflito explícito. Conflitos financeiros exigem recuperar o grupo remoto e refazer a operação; alterações independentes são preservadas. Há atualização ao retornar ao primeiro plano e consulta periódica enquanto o estado está limpo.
4. **Chat:** `chatHistoryService.ts`, `chatSerialization.ts` e `types/chat.ts` carregam mensagens por usuário e persistem mensagens/cards na mesma transação das ações de negócio. IDs estáveis e recibos evitam duplicação mesmo quando a resposta da gravação se perde. A restauração não executa processadores nem recria registros. Escolhas históricas aparecem desativadas; escolhas da sessão ativa mantêm sua experiência. O serializador usa campos permitidos e remove padrões explícitos de credenciais; não inclui configurações/chaves de IA.
5. **Preferências/onboarding:** `business_preferences` passa a ser a autoridade para ativação, ordenação, categorias, taxonomia, sugestões dispensadas e marcadores aprendidos. O progresso da coleta e o relatório ainda não concluído também são recuperáveis em outro aparelho. `onboarding_records` conserva as respostas e o contexto legado; conclusão grava registro, preferências e flag de perfil atomicamente. Backfill preserva valores canônicos existentes. Perfil continua na tabela `profiles`, com confirmação de atualização e erro explícito quando faltam campos necessários.
6. **Validação:** testes de serviços reais com IO controlado, testes do contexto de autenticação e execução de SQL em PostgreSQL local via PGlite. Também foram executadas as suítes existentes, TypeScript e exportação Expo para web, Android e iOS. A exportação verifica JavaScript/assets e Hermes; não equivale a compilar ou instalar um APK/IPA.

## Fontes de verdade

| Informação | Autoridade após confirmação | Estado local |
| --- | --- | --- |
| Tarefas, eventos, transações e registros de módulos | Tabelas de negócio Supabase, via RPC/revisão | Zustand para apresentação e preparação |
| Configuração e preferências dos módulos | `business_preferences` | Zustand hidratado do remoto |
| Perfil e conclusão do onboarding | `profiles` | Contexto autenticado |
| Respostas/contexto do onboarding | `onboarding_records` | Compatibilidade e coleta |
| Progresso e relatório pendente | Preferências canônicas | Rascunho em andamento |
| Histórico do Chat | `chat_messages`, isolada por usuário | Histórico carregado + mensagens pendentes |
| Confirmação idempotente de operação | `business_commit_receipts` | ID do pedido pendente |

AsyncStorage mantém sessão e rascunhos não confirmados, separados por projeto e usuário. Rascunhos não são apresentados como gravações concluídas e exigem internet para confirmar. Não há modo de salvamento offline. Dados que nunca saíram da memória de uma instalação antiga não podem ser recuperados retroativamente por estas mudanças.

## Migrations aplicadas

- `0007_chat_history.sql`: histórico, isolamento RLS, restrições de payload e commit atômico de negócio/Chat.
- `0008_canonical_preferences.sql`: backfill seguro de preferências e conclusão atômica do onboarding.
- `0009_commit_receipts.sql`: recibos idempotentes por usuário/pedido, sem uma segunda cópia do conteúdo de negócio.

O `db push --dry-run` inicial listou apenas estas três migrations. `db push --linked` aplicou 0007, 0008 e 0009 em sequência. A listagem posterior confirmou 0001–0009 correspondentes entre local e remoto, e um segundo dry-run retornou `upToDate: true`, sem itens pendentes. Funções anteriores foram preservadas por sobrecargas. Escrita direta nas novas tabelas é revogada; as RPCs verificam o usuário autenticado. O teste SQL local comprovou isolamento, recusa a anônimos/escrita direta, rollback integral por erro de referência/payload, conflito de revisão e reenvio idempotente. Esse teste emula papéis e `auth.uid()`; não substitui o teste autenticado do aplicativo.

## Evidência de testes

- `npm run typecheck`: aprovado.
- `npm run test:persistence`: 17 testes de persistência, 5 de autenticação e 1 suíte SQL com múltiplas verificações, aprovados.
- Engine/store: 273 testes aprovados, usando `--experimental-test-isolation=none` devido à restrição de criação de subprocessos do ambiente.
- Onboarding: 23 testes aprovados. Sugestões de tarefas: 6 testes aprovados.
- Suítes existentes de superfícies, voz, etapas visuais, bottom sheet, foco de modal, barras do sistema, alertas, segurança local e arquitetura de IA executadas na validação.
- Exportação Expo SDK 54: bundles locais para web/Android/iOS; artefatos em `.cache/persistence-build`.

Casos cobertos incluem falha de rede sem apagar alterações, duplo envio, alterações durante commit, journal após reload, respostas de conta anterior, merge entre dispositivos, conflito de estoque com vendas relacionadas, resposta perdida seguida de edição em outro dispositivo, restauração de mensagens sem execução e onboarding em um segundo cliente.

## Pendências externas e limites

1. Executar em dois aparelhos com a mesma conta: CRUD de cada domínio, reload, retorno ao primeiro plano, perda de rede durante gravação, renovação de sessão e conflitos. Android físico e Supabase autenticado não foram validados ponta a ponta nesta execução.
3. Confirmar que os builds instalados usam o mesmo host Supabase e usuário. O mecanismo de configuração existente foi preservado; variáveis incorporadas no build podem diferir entre instalações. Credenciais não foram impressas nem alteradas.
4. Builds antigos ainda podem gravar usando o fluxo anterior. Distribuir a versão corrigida aos dispositivos envolvidos para obter os novos limites de confirmação e conflitos.
5. Snapshots continuam sendo a arquitetura existente; não houve substituição do Zustand ou reconstrução das tabelas. Grandes volumes de histórico/snapshots podem exigir otimização futura. Históricos antigos que eram apenas memória não são importáveis após já terem desaparecido.

As alterações visuais que já existiam no workspace foram preservadas. A interface recebeu somente estados necessários de sincronização, erro, recuperação e bloqueio de envio.

Referências consultadas: [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) e [Supabase com React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native).
