# Etapa 2 — registro para continuidade

Trabalho interrompido a pedido do usuário em 09/10/2026. **A Etapa 2 está parcialmente implementada e não está concluída.** Escopo autorizado: VIS-019, VIS-010, VIS-006 e VIS-004, conforme `docs/auditoria-visual-lumio.md`. Não houve commits, publicação ou alteração deliberada de dados reais. O relatório da auditoria não foi reescrito.

## Contexto que deve ser preservado

- O workspace já continha alterações da Etapa 1 de contraste, além de mudanças anteriores no Chat. O `git diff` atual mistura essas alterações com a Etapa 2: não revertê-lo integralmente e não atribuir todas as mudanças deste diff à Etapa 2.
- A validação visual da Etapa 1 foi dispensada pelo usuário antes desta etapa; isso não dispensa a validação Android solicitada para a Etapa 2.
- As instruções do projeto exigem consultar a documentação versionada do Expo SDK 54 antes de escrever código; ela foi consultada nesta sessão. Foram usadas as skills Expo overview/design system já carregadas.

## Alterações implementadas neste último pedido

### VIS-019 — fechamento e rascunhos

`app/components/Calendar/BottomSheet.tsx`:

- Adicionado `draft?: unknown` para acompanhar valores editáveis controlados pelo componente pai.
- Ampliado `BottomSheetHandle` com `requestClose()`, que representa um pedido de fechamento do usuário. `close()` continua sendo o fechamento programático que dispensa confirmação, destinado aos fluxos de salvamento já existentes.
- No pedido de fechamento nativo, Android com teclado visível chama `Keyboard.dismiss()` e retorna, sem iniciar o fechamento do formulário.
- Pedidos de fechamento com alterações não salvas usam `AppAlert`, com as ações “Continuar editando” e “Descartar”. Essa proteção alcança o backdrop, o arraste e os controles conectados a `requestClose()`.
- Adicionado bloqueio de confirmações duplicadas e uma verificação de sessão para uma confirmação antiga não fechar um formulário reaberto.
- Ao pedir confirmação depois de um arraste, a janela retorna à posição original. A dispensa definitiva continua usando a animação existente.
- Mantido o bloqueio de dispensa quando `dismissible` é falso.

Novo `src/components/sheet-draft.tsx`:

- Contexto `SheetDraftContext` e hook `useSheetDraft()` registram mudanças de formulários cujo estado fica dentro do BottomSheet.
- São registrados os valores editáveis; expansão de seções não é tratada como alteração de dados.

Formulários conectados à proteção:

- Módulos `app/plugins/equipe.tsx`, `clientes.tsx`, `fornecedores.tsx`, `catalogo.tsx`, `estoque.tsx`, `contratos.tsx`, `entregas.tsx`, `vendas.tsx`, `orcamentos.tsx` e `[id].tsx`: adicionados refs e valores `draft`; controles Cancelar dos formulários passaram a chamar `requestClose()`. Estoque possui proteção separada para cadastro e movimentação. O segundo sheet de Fornecedores, usado como seletor, não recebeu draft de cadastro.
- `TaskForm.tsx`, `EventForm.tsx`, `QuickAddForm.tsx` e `AppointmentForm.tsx`: adicionados registros via `useSheetDraft()`; Cancelar encaminha o pedido de fechamento ao contexto.
- `src/components/information-editor.tsx`: recebeu `draft`, encaminha Cancelar/Fechar a `requestClose()` e mantém fechamento programático no handle público.
- `app/profile.tsx`, `app/settings.tsx` e `app/components/onboarding/report-detail.tsx`: passam os respectivos campos editáveis ao InformationEditor.
- As rotas de salvamento e de navegação que já preservavam rascunhos não foram deliberadamente substituídas. Ainda precisam de verificação de regressão, especialmente Financeiro e vínculos com módulos.

### VIS-010 — área segura inferior

- `app/components/Calendar/FAB.tsx`: adicionado `respectBottomInset`, com `useSafeAreaInsets()`. Quando ativo, o botão usa `bottom: Spacing.xl + insets.bottom` e `right: Spacing.xl + insets.right`. Mantidos tamanho, ícone, cor e sombra. Adicionados papel e nome de acessibilidade.
- Os dez módulos que renderizam FAB ativaram essa opção. O valor padrão é falso para preservar consumidores nas abas, cujos contêineres já tratam a navegação.
- `app/plugins/store.tsx`: SafeAreaView passou a consumir também a borda inferior, usando os insets reais da biblioteca.

### VIS-006 — áreas interativas

- Cabeçalhos de módulos e Loja: controles existentes com estilos `icon`, `iconBtn`, `iconButton` e `backBtn` passaram a ter caixas de toque de 48 × 48, mantendo os tamanhos dos ícones. Isso inclui Comissões, embora ela não tenha formulário de cadastro.
- `src/components/back-button.tsx`: botão compartilhado passou de 44 × 44 para 48 × 48; ícone preservado.
- InformationEditor, TaskPeopleSelector e TaskOrderSelector: aplicado `hitSlop={7}` aos botões de fechar de 34 × 34 e altura mínima de 48 no cabeçalho. É necessário conferir o alcance efetivo do hitSlop no Android, pois o limite do pai pode restringi-lo.
- TaskDateSelector: controles de fechar e navegar meses passaram a ter 48 × 48; cabeçalhos receberam altura mínima de 48; células receberam altura mínima de 48.
- CalendarDayCell e CollapsibleCalendar: células receberam altura mínima de 48; navegação de meses recebeu 48 × 48. Círculos e tamanhos de texto foram preservados.
- Receberam mínimo de altura/largura de 48 os estilos de chips selecionados em Calendar/FilterChips, Calendar/AppointmentForm, Finance/FinanceFilterChips, Tasks/TaskDateSelector, Tasks/TaskForm, TagSelector, Forms/pluginFormStyles e na tela Tarefas. A ampliação foi feita no próprio controle, sem hitSlop horizontal que invadisse os vizinhos.
- **A revisão de todos os controles ainda está pendente.** Há outros estilos de chips, presets e seletores a conferir. A largura das sete colunas do calendário também precisa ser medida: altura mínima de 48 não garante largura de 48 em todas as telas.

### VIS-004 — botões de formulário

- Novo `src/components/form-action-styles.ts`: `FormActionStyles` centraliza ações primárias/secundárias, altura mínima de 50, padding vertical, alinhamento, radius, tipografia semibold de 15 e estado disabled com opacidade 0,5. Reutiliza cores e superfícies existentes.
- `app/components/Tasks/taskFormStyles.ts`: ações passaram a referenciar esses estilos. Tarefas, eventos, atendimentos e Financeiro herdam a padronização.
- `app/components/Forms/pluginFormStyles.ts`: acrescentados aliases de `cancelButton`, `cancelButtonText` e `saveBtnDisabled`, alcançando formulários de módulos que usavam nomes diferentes.
- InformationEditor usa os mesmos estilos, preserva a variante destrutiva e o texto de loading existente. Sua ação de salvar informa `accessibilityState` com disabled/busy durante salvamento.
- Não foram implementados novos fluxos assíncronos nos formulários síncronos. Os estados normal/loading/disabled ainda precisam ser conferidos visualmente, assim como overrides locais dos estilos compartilhados.

## Testes executados e resultados

| Verificação | Resultado efetivo |
| --- | --- |
| `npx tsc --noEmit` | Passou na última execução concluída, após as alterações de produto descritas acima. |
| `node scripts/bottom-sheet-layout.test.cjs` | 6 testes passaram. Cobrem cálculo de viewport, teclado e insets; não equivalem a teste visual no aparelho. |
| `node scripts/app-alert.test.cjs` | 6 testes passaram após ajustar o mock de tema para fornecer `ControlOpacity.pressed`, introduzido na Etapa 1. Nenhuma alteração de funcionamento do AppAlert foi feita nessa correção do teste. |
| `node scripts/color-contrast.test.cjs` | 226 verificações passaram, preservando as correções de contraste da Etapa 1. |
| Novo `node scripts/bottom-sheet-dismissal.test.cjs` | **4 passaram e 1 falhou.** O teste que verifica alterações registradas pelo formulário interno esperava uma confirmação e recebeu zero. A causa ainda não foi investigada: pode estar no código ou no fixture de hooks. Não tratar a proteção dos formulários internos como validada. |

O novo teste de dispensa executa o BottomSheet transpilado com mocks de React/React Native. Os casos aprovados cobrem primeiro/segundo Voltar com teclado simulado, confirmação sem duplicação, manter/descartar, fechamento após salvar, valores revertidos e confirmação antiga. São testes automatizados simulados, **não validações Android**.

## Android: o que efetivamente ocorreu

- Preparada uma cópia temporária isolada em `%TEMP%\lumio-interaction-stage2`, com node_modules via junction, porta Metro 8082, autenticação sintética, Supabase desativado e módulos habilitados apenas nessa cópia.
- A cópia usa “Pessoa de teste”, “Negócio de teste” e e-mail `teste@example.invalid`. Nenhum mecanismo de mock ou habilitação foi adicionado ao aplicativo principal.
- Metro conseguiu empacotar `audit-entry.js` para Android. Houve captura da tela inicial/splash. As capturas temporárias de `artifacts/` foram removidas na preparação do commit, pois não comprovavam as correções; as evidências citadas pela auditoria em `docs/auditoria-visual/` foram preservadas.
- **Não foi concluída nenhuma validação visual das correções no Android.** Não foram confirmados no aparelho: teclado/Voltar, preservar rascunho, confirmação de descarte, FABs, scroll, loading/disabled ou navegação por gestos.
- O trabalho foi interrompido antes de completar a navegação na cópia de teste. Não considerar a captura da splash evidência das correções.

## Estado do ambiente ao pausar

- O processo Metro da cópia, sessão de execução 69623, foi encerrado com Ctrl+C.
- A remoção do reverse ADB 8082 e o retorno à experiência original em 8081 foram tentados, mas **o aparelho já estava desconectado** (`no devices/emulators found`). Portanto, o retorno visual à aplicação original não foi confirmado.
- A cópia temporária foi preservada para facilitar a retomada; não é código de produção. Sua versão de código corresponde à cópia feita após os ajustes de toque; mudanças futuras no workspace precisam ser copiadas para ela antes de validar.
- A configuração original de fontes, resolução e densidade do Android não foi alterada nesta etapa. Não foram modificadas preferências reais de módulos nem dados da conta.
- Permanecem scripts auxiliares no TEMP: `lumio-stage2*.cjs` e `lumio-stage2-expression.js`. Não executar novamente os scripts de migração: várias substituições não são idempotentes.
- Os arquivos novos de produto são `sheet-draft.tsx` e `form-action-styles.ts`; o novo teste é `bottom-sheet-dismissal.test.cjs`. Esses arquivos foram incluídos no commit de continuidade solicitado depois da pausa.

## Próximos passos para concluir, sem ampliar o escopo

1. Investigar a falha do teste de formulário interno antes de considerar VIS-019 resolvido. Conferir baseline e registro de draft na abertura/reabertura e em formulários montados dentro do Modal.
2. Verificar cancelamento do Financeiro, limpeza/preservação de rascunhos e navegação para criar vínculos. Conferir também salvar, editar, cancelar e fechamento durante loading.
3. Completar a revisão VIS-006: chips restantes, fechar/voltar/menu e medidas reais das células. Evitar áreas de toque sobrepostas ou prometer 48 de largura quando a grade não comporta esse valor.
4. Conferir se todos os botões equivalentes usam os estilos compartilhados e se nenhum override local reduz altura/tipografia ou quebra loading/disabled.
5. Reconectar o Android; usar novamente a cópia isolada com dados sintéticos. Validar primeiro Voltar apenas fechando teclado, segundo Voltar/Cancelar/arraste/backdrop com confirmação e “Continuar editando” preservando o conteúdo.
6. Medir e tocar a parte inferior dos FABs; conferir Loja e formulários com scroll. Testar navegação de três botões e por gestos quando disponível, sem deixar configurações modificadas.
7. Reexecutar typecheck e os testes relevantes após as correções pendentes. Registrar apenas comportamentos realmente verificados no aparelho.
8. Encerrar a cópia e restaurar/remover o reverse 8082, preservando o servidor original 8081. Não executar outros achados, redesign, commits ou publicação sem nova instrução.
