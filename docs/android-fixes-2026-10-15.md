# Correções dos testes Android — 15/10/2026

As 10 correções foram implementadas. TypeScript, testes locais e exportação do bundle Android foram validados. Não houve commit/push, publicação, build EAS ou alteração de dados reais.

## Resultado por item

| Item | Causa e correção | Status e validação |
| --- | --- | --- |
| 1. Login | `PersistenceFeedback` substituía a árvore inteira quando `ready=false/loading=true`, desmontando o formulário e perdendo seus erros. O conteúdo permanece montado durante a autenticação. Credenciais inválidas/conta inexistente recebem mensagem amigável distinta de conexão indisponível. O splash inicial aguarda `ready` antes de decidir a rota. | Implementado. Testes de erro, readiness e conservação da árvore da tela passaram. Conferir formulário e teclado no APK. |
| 2. Privacidade | A exigência de dados fictícios era incompatível com o uso normal solicitado. Texto informa fase de testes, uso normal, finalidade, autenticação, armazenamento remoto, proteção local, limitações, retenção e provedores opcionais, sem garantia absoluta. A recomendação específica para não enviar dados sensíveis à IA permanece. | Implementado. Versão do aviso atualizada; testes de consentimento e onboarding passaram. A região e os ciclos operacionais dos provedores continuam dependendo da responsável, conforme o texto informa. |
| 3. Avisos de persistência | O banner global exibia o estado interno `saving` e perfil/senha geravam avisos rotineiros. Esses avisos foram removidos. Erros relevantes, conflitos e recuperação continuam disponíveis; códigos SQL permanecem nos objetos internos, não nas mensagens ao usuário. O aviso de aprovação de orçamento foi preservado porque explica a próxima ação comercial. | Implementado. Testes de alertas, confirmação, rollback, conflitos e persistência passaram. |
| 4. Loading | Tarefas, Financeiro e Calendário simulavam espera por temporizadores ou skeletons estáticos mesmo com dados já hidratados. Esperas artificiais foram removidas; operações reais usam `ActivityIndicator` circular no próprio formulário/botão. A tela permanece visível e os controles de duplicação continuam ativos. | Implementado. TypeScript, exportação Android, regressões de forms, modais, superfícies e prevenção de duplicação passaram. Validar movimento e dimensões no APK. |
| 5. Módulos ativos | `moduleIcon` usava `mintBackground`. Agora usa a superfície branca `bgCard`. | Implementado. Regressões de superfícies e contraste passaram. |
| 6. Rolagem do Chat | O acompanhamento não distinguia adequadamente a leitura do histórico e dependia do tamanho do conteúdo. A lista acompanha mudanças de conteúdo/layout/teclado enquanto está no final, interrompe ao arrastar para mensagens antigas e retoma ao voltar ao fim ou enviar. Clipping de subviews foi desativado para reduzir cortes de cards longos no Android. | Implementado. Teste dos callbacks cobre crescimento, leitura anterior e retomada. A geometria real do teclado, cards e mensagens longas exige APK. |
| 7. Ícone | Os assets configurados ainda eram os ícones padrão do Expo. Novos PNGs 1024×1024 usam a arte original `login-Lumio.png`, centralizada com margem verde, sem redesenho. Ícone legado usa 82% do canvas; foreground adaptativo e monocromático usam 60% para a área segura do launcher. Originais foram preservados. | Implementado. Inspeção visual e dimensões/alpha passaram. É necessário gerar e instalar novo APK para validar máscaras e cache do launcher. |
| 8. Saudação | A construção longa e artificial foi substituída por “Oi! 👋 Me conte o que você quer organizar: gastos, tarefas ou compromissos. Vamos juntos!”. | Implementado. Incluída no bundle Android. |
| 9. Calendário | O uso de `toISOString` convertia a data local para UTC e o “hoje” ficava congelado no mount. Agora usa componentes locais, atualiza na virada e no retorno ao foreground, preserva seleção deliberada e navegação de mês e usa a data completa na semana compacta. Removido clipping dos círculos e padding extra da fonte; o estilo selecionado prevalece sobre estilo externo. | Implementado. Testes cobrem São Paulo, UTC+14, mês/ano, ano bissexto, semana que cruza mês e virada do dia. O desenho do numeral selecionado exige conferência no APK com fontes ampliadas. |
| 10. Envio do Chat | O par usuário/resposta só era exibido depois do commit. Agora o texto aparece e o campo limpa imediatamente; fila local serializa a preparação dos turnos e usa a persistência existente em segundo plano. Falhas mantêm o texto e oferecem retry discreto. IDs, journal, transação e request idempotente são preservados. Respostas e cards de comandos só aparecem após confirmação remota. Rejeição definitiva preserva o texto e desfaz a preparação rejeitada. Histórico recuperado não reexecuta comandos. | Implementado e validado localmente. Testes dos callbacks reais cobrem envio rápido, toque duplo, ordem, rede indisponível, resposta perdida, retry sem executar novamente e rejeição definitiva. A gravação no Supabase implantado e a recuperação entre dispositivos reais permanecem pendentes: não há conta isolada/credenciais de teste disponíveis. |

## Verificações executadas

- Documentação versionada consultada antes das mudanças: https://docs.expo.dev/versions/v54.0.0/ e referências de configuração e SecureStore do SDK 54.
- `npm run typecheck`: passou.
- Suíte de motores e store: 273 testes nos 16 arquivos passaram. `npm test` encontrou `spawn EPERM` ao criar processos no sandbox; os mesmos arquivos foram executados individualmente com `node --experimental-strip-types`, todos com sucesso.
- Scripts locais: 187 testes em 20 scripts TAP passaram, incluindo 23 de persistência/Chat, 8 de autenticação, 5 de calendário, SQL real via PGlite, onboarding, prelaunch, voz, modais, alertas, superfícies e regressões visuais estruturais.
- `scripts/color-contrast.test.cjs`: 226 verificações passaram. Total: 460 testes automatizados, além das verificações de contraste.
- `npx expo export --platform android --max-workers 1 --output-dir .tmp-android-export`: passou com bundle Hermes. A primeira tentativa encontrou `spawn EPERM` no compilador Hermes; a execução local autorizada fora dessa restrição concluiu. Exportar o bundle não equivale a compilar/instalar um APK.
- Assets de instalação: PNGs 1024×1024; canto opaco no ícone legado e transparente nas camadas adaptativa/monocromática. Inspeção visual do ícone realizada.
- `git diff --check`: sem erros.

Os testes de persistência usam backend controlado em memória e SQL PostgreSQL via PGlite. Eles comprovam o comportamento local e o contrato das migrations; não comprovam que o ambiente Supabase atualmente implantado tem todas as migrations e permissões corretas. Nenhum teste gravou em dados reais.

## Pendências no APK e ambiente remoto

1. Gerar/instalar um APK com estes assets e conferir ícone normal, circular, adaptativo e temático. Não foi feito build pago nem publicação.
2. Com conta isolada de teste, conferir login inválido e sem conexão, permanência no formulário e spinner animado.
3. Enviar várias mensagens curtas/longas e cards, abrir/fechar teclado e ler histórico anterior sem saltos; conferir fonte do calendário em tamanhos normal e ampliado.
4. Confirmar no Supabase de teste que `chat_messages` recebe as mensagens; fechar/reabrir o app e entrar na mesma conta em outro aparelho. Conferir a mesma ordem e ausência de duplicações.
5. Interromper a rede antes e depois da confirmação de um comando; recuperar com retry e conferir que tarefa/receita/estoque é alterado uma única vez e que não aparece sucesso antecipado.
6. Recuperação de mensagens apenas aguardando na fila após encerramento: seu texto é preservado; comandos ainda não preparados não são executados automaticamente ao restaurar o histórico. Se não houver resposta confirmada, revisar os registros e reenviar o comando quando necessário. Não foi implementado modo offline completo.
7. Repetir mudança de mês e virada do dia no dispositivo, inclusive retomada do app após ficar em segundo plano.

`adb devices` não encontrou aparelho conectado e não há emulador disponível no PATH. As validações visuais nativas e o ciclo remoto real, portanto, não são declarados como concluídos.

## Arquivos alterados e adicionados

- `app.json`
- `app/(tabs)/apps.tsx`
- `app/(tabs)/calendario.tsx`
- `app/(tabs)/chat.tsx`
- `app/(tabs)/financeiro.tsx`
- `app/(tabs)/tarefas.tsx`
- `app/ai-consent.tsx`
- `app/onboarding.tsx`
- `app/plugins/[id].tsx`
- `app/plugins/catalogo.tsx`
- `app/plugins/clientes.tsx`
- `app/plugins/contratos.tsx`
- `app/plugins/entregas.tsx`
- `app/plugins/equipe.tsx`
- `app/plugins/estoque.tsx`
- `app/plugins/fornecedores.tsx`
- `app/plugins/orcamentos.tsx`
- `app/plugins/vendas.tsx`
- `app/profile.tsx`
- `app/recover-access.tsx`
- `app/settings.tsx`
- `assets/lumio-app-icon-padded.png`
- `docs/android-fixes-2026-10-15.md`
- `docs/icone-lumio.md`
- `scripts/android-calendar.test.cjs`
- `scripts/app-alert.test.cjs`
- `scripts/bottom-sheet-fixture.cjs`
- `scripts/card-surfaces.test.cjs`
- `scripts/generate-app-icons.ps1`
- `scripts/onboarding-flow.test.cjs`
- `scripts/persistence.test.cjs`
- `scripts/persistence-auth.test.cjs`
- `scripts/task-suggestions.test.cjs`
- `scripts/visual-stage3.test.cjs`
- `scripts/visual-stage4.test.cjs`
- `scripts/visual-stage5.test.cjs`
- `scripts/visual-stage5-style-baseline.json`
- `scripts/visual-stage6.test.cjs`
- `scripts/visual-stage6-replaced-styles.json`
- `scripts/visual-style-evaluator.cjs`
- `src/components/app-dialog.tsx`
- `src/components/Calendar/AppointmentForm.tsx`
- `src/components/Calendar/CalendarDayCell.tsx`
- `src/components/Calendar/CollapsibleCalendar.tsx`
- `src/components/Calendar/EventForm.tsx`
- `src/components/Calendar/SkeletonLoader.tsx`
- `src/components/Finance/FinanceSkeleton.tsx`
- `src/components/Finance/QuickAddForm.tsx`
- `src/components/information-editor.tsx`
- `src/components/persistence-feedback.tsx`
- `src/components/Tasks/TaskForm.tsx`
- `src/constants/privacy.ts`
- `src/hooks/useCalendarState.ts`
- `src/services/authError.ts`
- `src/services/businessStateService.ts`
- `src/services/chatHistoryService.ts`
- `src/types/chat.ts`
- `src/types/errors.ts`
