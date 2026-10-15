# Retomada — correções de pré-lançamento do Lumio

Data: 14/10/2026 (America/Sao_Paulo)

## Atualização da retomada — 14/10/2026

O estado abaixo foi retomado a partir de `8a0d207`, branch `develop`, inicialmente limpa. As correções desta rodada, incluindo componentes movidos para `src/components/`, rotas, splash única e ícone, foram preparadas para o commit `fix: consolidar correcoes pre-lancamento e rotas do Lumio`. Consulte `git log` para identificar o hash; push ainda pendente.

- Os três pontos da revisão final foram reproduzidos em testes que falharam antes da correção e passaram depois: recibo de exclusão de A encerrando B; despesa com flags pendentes incoerentes; fotos legadas/subpastas não removidas. Corrigidos em `authService`, `localPrivacy`, store e handler `delete-account`.
- O cadastro agora encaminha para confirmação/reenvio quando signup não retorna sessão (P1-14).
- Os handlers `ai`/`delete-account` e helper `secure` têm checagem Deno efetiva, sem `@ts-nocheck`; sete erros foram corrigidos. `npm run typecheck:edge` requer Deno no PATH. O TypeScript do app exclui o runtime Edge e cópias locais em `.cache`.
- Auditoria principal atualizada com tabela de estado; criados [relatório de preparação do APK](relatorio-preparacao-apk.md) e [pacote concreto de revisão do deploy](deploy-pre-lancamento/revisao.md), com SQL exato, diffs, hashes e redirects Auth.
- Passaram TypeScript, 25 testes pré-lançamento, 273 motores/store, persistência (17+5+1), IA (11), segurança local e fluxos afetados. Exportação Android/Hermes e prebuild isolado aprovados. Evidências locais em `.cache/prelaunch`; não são versionadas.
- Java foi encontrado no Android Studio/JBR; Gradle 8.14.3 foi obtido. `assembleRelease` falhou antes da compilação por `AccessDeniedException` ao mover cache Groovy para diretório imutável, inclusive fora do sandbox e com tentativas de mitigação. Não há APK novo.
- Android USB disponível: Galaxy M31/SM-M315F, Android 12. Tem Expo Go; não tem package Lumio instalado. Nenhuma instalação/desinstalação, limpeza de dados ou validação visual do novo binário foi feita.

**Próximo passo:** revisar/aprovar os artefatos concretos antes de migration/deploy; resolver o cache Gradle ou usar fluxo de preview assinado aprovado e seguir a matriz no APK. Não aplicar SQL, deploy ou alterações Auth automaticamente. Nenhuma escrita remota, chamada paga IA, exclusão de conta real ou build EAS foi executado nesta retomada. Os itens das seções seguintes são o registro da interrupção anterior; usar esta atualização e os novos relatórios como estado atual.

**Atualização após aprovação da usuária:** Supabase CLI 2.121.0 confirma projeto `foruzsalsyqmccutvhdu`; migrations 0001–0010 estão alinhadas. `ai` v8 e `delete-account` v2 foram implantadas e estão ACTIVE com `verify_jwt=true`; `photo` continua v3. Não houve alteração Auth nem chamada paga. A build local ainda falha no cache Gradle; consulte o relatório de preparação antes de distribuir.

## Estado ao interromper anteriormente

O trabalho está salvo no commit local `fix: preparar correcao pre-lancamento do Lumio` (veja o hash no `git log`). A branch é `develop`. Nenhum push foi feito. Arquivos ignorados como `.env`, `.cache`, `node_modules` e estado local do Expo não fazem parte do commit.

O objetivo autorizado é corrigir os P0/P1 identificados em `docs/auditoria-pre-lancamento.md`, sem alterar dados do Supabase de produção e sem realizar deploy externo sem aprovação explícita. A usuária também autorizou tratar a recorrência de contratos P2-06 junto ao restante. A interface e os módulos existentes devem ser preservados.

## O que já foi preparado

- Correções de validação e atomicidade dos commits de negócio, proteção do journal do Chat e recuperação de conflitos/rejeições.
- Validação remota do snapshot e migration incremental `supabase/migrations/0010_strict_business_commit.sql`. **A migration ainda não foi aplicada no Supabase.**
- Isolamento de sessões/drafts por conta, armazenamento local criptografado no Android, remoção de dados locais após exclusão confirmada e recuperação de senha por PKCE.
- Proteção de backup Android no config plugin e perfil APK de preview em `eas.json`.
- Preservação e reconciliação de lançamentos derivados, datas financeiras sem inferir ano, recorrência mensal de contratos e proteção contra edição incoerente de comissões.
- Limites/timeouts nas chamadas de IA, atualização local da Edge Function de IA e exclusão de conta com paginação. **As versões corrigidas das Edge Functions ainda não foram implantadas.**
- Aviso de privacidade com responsável, suporte e retenção informados pela usuária, além de consentimento antes de enviar respostas de onboarding à IA.
- Testes locais novos e existentes atualizados.

## Evidência técnica já obtida

- `npm run typecheck` passou.
- `npm run test:prelaunch` passou com 22 testes.
- A suíte dos motores/store passou com 273 testes; persistência, AuthContext, SQL, IA, onboarding e verificações de interface também passaram nas execuções documentadas na auditoria.
- Expo export Android/Hermes foi concluído.
- `expo prebuild --platform android --no-install` passou numa cópia isolada; Manifest e regras de backup gerados foram inspecionados.
- Verificações remotas foram somente leitura: migrations 0001–0009 alinhadas; migration 0010 local pendente; RLS habilitado nas 27 tabelas examinadas; bucket de fotos privado; grants amplos encontrados e revogados pela migration proposta; funções remotas ainda diferem das versões locais corrigidas.
- Presença de nomes de secrets foi verificada sem imprimir valores. Isso não comprova validade ou decryptabilidade das chaves.
- Não foi compilado nem instalado um APK novo. O aparelho conectado não foi usado para teste deste build. Não houve chamadas pagas à IA, gravações/exclusões de dados reais, aplicação de SQL remoto, deploy de Edge Function, alteração de Auth/secrets, commit anterior ou push.

## Pendências antes de entregar a testadores

1. Revisar o diff e este estado de retomada; resolver os últimos pontos de código mencionados abaixo antes de concluir a correção.
2. Atualizar o relatório principal `docs/auditoria-pre-lancamento.md` para separar achados originais de estado atual (corrigido localmente, pendente de deploy, ou pendente de teste) e criar `docs/relatorio-preparacao-apk.md` com veredito, checklist, evidências e sequência de correção.
3. Completar testes finais, export Android/Hermes e prebuild numa cópia isolada depois das últimas mudanças. Java/Gradle/Deno não estavam disponíveis; por isso o APK real e o typecheck das Edge Functions ainda carecem de execução apropriada.
4. Antes de qualquer publicação remota, mostrar à usuária o SQL exato da migration 0010 e o diff das duas funções (`ai`, `delete-account`), junto com os redirects Auth que precisam estar permitidos. A usuária deve aprovar essas operações externas após revisar o artefato concreto.
5. Depois de implantar com aprovação, repetir leitura de versão/grants/configuração sem expor secrets; configurar/confirmar allowlist de redirects de autenticação no Dashboard.
6. Gerar um APK assinado de preview, conferir certificado/versionCode/Manifest/backup e instalar. Rodar a matriz de dois usuários, persistência e falhas descrita no relatório. Somente então concluir se o binário pode ser distribuído no grupo fechado.

## Revisão de código ainda não concluída

Foi identificado ao preparar a interrupção que `finishDeletionCleanup()` precisa ser revisado para não encerrar a sessão de outra conta caso exista recibo de limpeza da conta anterior. Conferir também todos os casos de confirmação de despesas vinculadas a tarefa e o filtro de extensão de fotos na Edge Function de exclusão. Corrigir somente se uma regressão reproduzível confirmar a necessidade e acrescentar caso de teste correspondente.

## Dados de privacidade fornecidos pela usuária

- Responsável: Luana Samara Nogueira de Castro, desenvolvedora do projeto.
- Contato de suporte/privacidade: `luanacastro325@gmail.com`.
- Retenção proposta: até 90 dias depois do encerramento dos testes, com possibilidade de exclusão antecipada mediante solicitação.

O texto de privacidade já registra essas informações, mas retenção operacional, remoção de backups e requisitos legais/jurisdicionais precisam ser confirmados antes de aceitar dados reais; não se deve declarar implementação que ainda não foi comprovada.

## Retomar em outro dispositivo

Sincronize a branch `develop` depois que o push for feito pela usuária ou pelo fluxo autorizado, abra `docs/retomada-correcao-pre-lancamento.md` e `docs/auditoria-pre-lancamento.md`, confirme `git status` e continue das pendências acima. Não confiar em artefatos de `.cache`, pois são locais e ignorados. Não aplicar migration nem fazer deploy automaticamente: revisar e solicitar aprovação concreta primeiro.
