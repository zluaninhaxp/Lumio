# Alertas e confirmações do Lumio

A fonte visual é o modal original de `app/onboarding.tsx`: confirmação ao voltar/recomeçar e confirmação para continuar sem IA. A implementação foi extraída para `src/components/app-dialog.tsx`; o onboarding continua controlando visibilidade, salvamento, erro e callbacks localmente.

Foram preservados o fade nativo, backdrop `rgba(18, 39, 32, 0.42)`, `SurfaceStyles.overlay`, largura máxima de 360, radius de 28, offsets dos insets, círculo do ícone de 54, fontes Plus Jakarta Sans, espaçamentos e botões de 50/46. As cores específicas aprovadas ficaram em `DialogTokens`, junto ao tema existente. O conteúdo só ganha rolagem quando ultrapassa a altura disponível.

## Sistema compartilhado

- `AppDialog`: apresentação única, variantes default/warning/destructive, ícone opcional, erro e loading. O onboarding conserva seus ícones refresh/sparkles e sua ação verde original.
- `AppAlert.alert(title, message, actions, options)`: assinatura compatível com as chamadas anteriores, preservando seus callbacks. `AppAlertHost` apresenta os pedidos no layout raiz. Exclusões/desativações/saída conservam a ação vermelha; avisos usam a mesma estrutura.
- A fila evita alertas sobrepostos, inclusive erros disparados pela confirmação. Toques repetidos não repetem o callback nem enfileiram uma confirmação idêntica. O fechamento preserva o conteúdo durante o fade de saída.
- Voltar e backdrop cancelam sem executar a ação principal; o Modal bloqueia a tela atrás. Loading bloqueia ações e cancelamento. Botões expõem papel, label, disabled e busy; textos mantêm o escalonamento do sistema.
- `AppFeedback`: sucesso sem modal, com a superfície escura já usada pelo snackbar do Financeiro. Aplicado aos dados pessoais, negócio, senha e aprovação de orçamento. Erros bloqueantes, permissões, dependências e remoções impedidas continuam exigindo atenção no diálogo compartilhado.

## Auditoria por área

| Área | Classificação e tratamento |
| --- | --- |
| Onboarding | Recomeçar e continuar sem IA usam AppDialog. Falha ao concluir relatório e avisos do gravador usam AppAlert. Relatórios, transições e formulários preservados. |
| Chat | Sem confirmação modal própria; AccountSheet compartilhado cobre logout. Respostas e decisões da conversa preservadas. |
| Tarefas | Confirmação de excluir migrada. Modais de tags, prioridade, filtros, formulário e seletores de relações preservados. Sugestões de criar tarefas continuam ações da tela. |
| Calendário | Formulários e seletores preservados. Exclusão/cancelamento já diretos continuam diretos; nenhuma confirmação nova adicionada. |
| Financeiro | Exclusão com snackbar/desfazer preservada. Formulários, filtros e recebimentos preservados. |
| Apps | Dependências e desativação de todos os módulos migradas. Falhas ao salvar ordem/desativação usam o diálogo de aviso. |
| Módulos | Clientes, fornecedores, equipe, estoque, catálogo, comissões, contratos, entregas, orçamentos, vendas, loja e módulos genéricos auditados. Confirmações e avisos migrados; formulários e mutations preservados. |
| Perfil | Erro de foto usa AppAlert. Dados pessoais/negócio salvos usam feedback sem bloquear. Editores preservados. |
| Configurações | Exclusão de conta usa confirmação destrutiva compartilhada, inclusive web. Editor de senha/exclusão e validações preservados; senha salva usa feedback. |
| Recursos e integrações | Remover chave de IA e erros de remoção migrados. Teste/salvamento da chave, status e navegação preservados. |
| Autenticação | Validações/erros inline dos formulários preservados. Logout e saída com alterações não sincronizadas usam o diálogo destrutivo compartilhado. |

A busca final inclui imports e chamadas de Alert, window.confirm/window.alert, confirm/confirmation/dialog e os usos de Modal. Não restam imports do Alert nativo nem confirmações nativas web em app/src. Os Modals restantes são funcionalidades/seletores, o BottomSheet e o AppDialog compartilhado; nenhum formulário virou alert.

## Android e verificações

Validação no Samsung A36 conectado, usando Expo Go com o código local:

- Capturas do onboarding original e compartilhado: `dialog-visual/onboarding-original.png` e `onboarding-shared.png`. Como a conta já concluiu o onboarding, o redirect foi desabilitado apenas durante a inspeção local e restaurado em seguida. Nenhuma conclusão/reinicialização foi executada na conta.
- Confirmação destrutiva real de desativar Comissões e logout real: abertura e cancelamento, sem efetivar as ações.
- Confirmação comum de pagamento: apresentação e callback testados numa rota temporária com dados em memória, pois não havia comissões pendentes. Cancelar pelo botão, Voltar, backdrop e confirmar com duplo toque resultaram em uma única confirmação local. A rota foi removida.
- Diálogo sobre BottomSheet: abriu na frente do formulário; Voltar fechou apenas o alert, preservando o sheet. Capturas `dialog-over-sheet.png` e `sheet-after-back.png`.
- Fade de entrada/saída registrado em `dialog-visual/interactions.mp4`, junto aos cancelamentos e confirmação.
- Typecheck passou. Testes: onboarding 23, alertas 6, bottom sheet 6, system bars 5. Cobrem callbacks, fila, erro subsequente, cancelamento, duplo toque, loading, nova tentativa e auditoria de imports nativos.

As verificações visuais não executaram exclusão de conta, pagamento real, remoção de chave ou logout. Os handlers originais dessas operações permanecem nos locais de chamada.

## Inventário das chamadas migradas

| Local | Conteudo | Tipo |
| --- | --- | --- |
| app/ai-settings.tsx:111 | Remover chave de IA? | Confirmation |
| app/ai-settings.tsx:130 | Erro | Attention |
| app/onboarding-summary.tsx:60 | Não foi possível concluir | Attention |
| app/profile.tsx:24 | Foto | Attention |
| app/profile.tsx:29 | Dados atualizados | Feedback |
| app/profile.tsx:30 | Negócio atualizado | Feedback |
| app/settings.tsx:34 | Excluir conta definitivamente? | Confirmation |
| app/settings.tsx:40 | Senha atualizada | Feedback |
| app/(tabs)/apps.tsx:33 | Dependência necessária | Attention |
| app/(tabs)/apps.tsx:68 | Não foi possível salvar | Attention |
| app/(tabs)/apps.tsx:73 | Desativar todos os módulos? | Confirmation |
| app/(tabs)/apps.tsx:90 | Não foi possível salvar | Attention |
| app/(tabs)/tarefas.tsx:554 | Excluir tarefa | Confirmation |
| app/plugins/[id].tsx:75 | `Excluir ${def.itemLabel}` | Confirmation |
| app/plugins/[id].tsx:86 | `Desativar ${def.label}` | Confirmation |
| app/plugins/catalogo.tsx:52 | Arquivar item | Confirmation |
| app/plugins/catalogo.tsx:53 | Desativar Catálogo | Confirmation |
| app/plugins/clientes.tsx:86 | Nome já cadastrado | Attention |
| app/plugins/clientes.tsx:92 | Nome já cadastrado | Attention |
| app/plugins/clientes.tsx:133 | Excluir cliente | Confirmation |
| app/plugins/clientes.tsx:146 | Desativar Clientes | Confirmation |
| app/plugins/comissoes.tsx:75 | Confirmar pagamento | Confirmation |
| app/plugins/comissoes.tsx:88 | Desativar Comissões | Confirmation |
| app/plugins/contratos.tsx:161 | Contrato não criado | Attention |
| app/plugins/contratos.tsx:186 | Desativar Contratos | Confirmation |
| app/plugins/contratos.tsx:244 | Excluir contrato | Confirmation |
| app/plugins/entregas.tsx:176 | Entrega não criada | Attention |
| app/plugins/entregas.tsx:194 | Desativar Entregas | Confirmation |
| app/plugins/equipe.tsx:92 | Nome já cadastrado | Attention |
| app/plugins/equipe.tsx:98 | Nome já cadastrado | Attention |
| app/plugins/equipe.tsx:139 | Excluir funcionário | Confirmation |
| app/plugins/equipe.tsx:147 | Funcionário vinculado | Attention |
| app/plugins/equipe.tsx:160 | Desativar Equipe | Confirmation |
| app/plugins/estoque.tsx:122 | Movimento não realizado | Attention |
| app/plugins/estoque.tsx:132 | Excluir item | Confirmation |
| app/plugins/estoque.tsx:137 | Item vinculado | Attention |
| app/plugins/estoque.tsx:142 | Desativar Estoque | Confirmation |
| app/plugins/fornecedores.tsx:98 | Nome já cadastrado | Attention |
| app/plugins/fornecedores.tsx:104 | Nome já cadastrado | Attention |
| app/plugins/fornecedores.tsx:145 | Excluir fornecedor | Confirmation |
| app/plugins/fornecedores.tsx:179 | Desativar Fornecedores | Confirmation |
| app/plugins/orcamentos.tsx:167 | Orçamento encerrado | Attention |
| app/plugins/orcamentos.tsx:192 | Orçamento não aprovado | Attention |
| app/plugins/orcamentos.tsx:197 | Orçamento aprovado | Feedback |
| app/plugins/orcamentos.tsx:213 | Desativar Orçamentos | Confirmation |
| app/plugins/store.tsx:59 | Dependência necessária | Attention |
| app/plugins/vendas.tsx:209 | Venda não registrada | Attention |
| app/plugins/vendas.tsx:220 | Não foi possível cancelar a venda. | Attention |
| app/plugins/vendas.tsx:239 | Desativar Vendas | Confirmation |
| app/plugins/vendas.tsx:296 | Venda vinculada | Attention |
| app/components/account/AccountSheet.tsx:25 | Alterações não sincronizadas | Confirmation |
| app/components/account/AccountSheet.tsx:31 | Erro | Attention |
| app/components/account/AccountSheet.tsx:35 | Sair da conta | Confirmation |
| app/components/onboarding/VoiceRecorder.tsx:59 | Permissão necessária | Attention |
| app/components/onboarding/VoiceRecorder.tsx:80 | Erro | Attention |
