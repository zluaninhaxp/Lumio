# Auditoria visual do Lumio — diagnóstico

Data: 9 de outubro de 2026. Plataforma: Android físico, aplicativo aberto no Expo Go, projeto Expo SDK 54 / React Native 0.81.5. Nenhuma correção implementada nesta auditoria.

## A. Resumo executivo

O Lumio tem identidade reconhecível e uma base de tokens real: off-white, superfícies brancas, mint, verde de marca, contraste escuro e formas orgânicas. A maturidade é intermediária: cores e elevação estão mais centralizadas que a estrutura dos controles, a tipografia e os estados de interação.

O principal problema sistêmico é acessibilidade de contraste. Textos auxiliares e placeholders usam um cinza muito claro; a cor de marca funciona como identidade, mas não como cor universal para textos pequenos. Há também controles com áreas de toque pequenas, buscas que misturam a fonte do sistema e a fonte da marca, e diferenças de foco e de botões entre formulários.

As telas de conta têm acabamento visual mais integrado, enquanto os módulos ainda concentram decisões locais. Isso não justifica eliminar diferenças semânticas: cards de registro, listas de navegação, painéis contextuais e diálogos têm funções distintas. A superfície das respostas do Chat está padronizada na versão observada; a diferença corrigida antes desta auditoria não é tratada como problema atual.

O relatório consolidado registra **19 achados: 0 P0, 3 P1, 12 P2 e 4 P3**. Os 18 anteriores foram preservados; o complemento acrescenta VIS-019, sobre descarte de rascunho ao usar Voltar com teclado aberto. Dois dos P1 são globais de contraste; o terceiro envolve textos pequenos de alerta. VIS-010 ganhou evidência de sobreposição da área tocável de FABs com a navegação nativa e maior prioridade dentro de P2. Esta conclusão se limita à cobertura abaixo, não constitui certificação de acessibilidade nem validação de todos os estados do produto.

## B. Cobertura da auditoria

### Ambiente e método da primeira rodada

- Aparelho conectado por ADB: resolução física 1080 × 2340; densidade 450 dpi; aproximadamente 384 × 832 dp antes de insets. Escala de fonte do sistema encontrada: **0,8**. A configuração foi mantida.
- Inspeção por screenshots, hierarquia Android, navegação entre abas, abertura e cancelamento de formulários e leitura de código. Foi reutilizado o aplicativo já em execução.
- Navegação, foco, digitação do gatilho `/` e cancelamento foram usados sem enviar mensagens ou salvar registros. Não houve alteração de conta, chave, módulos, configurações do Android ou banco de dados.
- Evidências novas estão em `docs/auditoria-visual/`. Capturas com nomes de clientes ou identificação pessoal não foram incluídas no conjunto entregue. Perfil e menu de conta foram inspecionados, mas não têm screenshot público neste relatório.
- As alterações de código de tarefas anteriores já existiam no início: `app/(tabs)/chat.tsx` e `app/components/chat/BotMessageCard.tsx`. Não foram editadas nesta auditoria. Nenhum commit, instalação ou ajuste automático foi executado.

### Inventário de rotas de produto

O inventário usa os arquivos reais de `app/`, as declarações de `app/_layout.tsx`, o layout das abas e os redirecionamentos. Arquivos de componentes em `app/components/` não são contabilizados como telas de produto só por estarem no diretório de rotas.

| Tela / rota real | Estados analisados | Android | Código | Limitações |
|---|---|---|---|---|
| `/` — `app/index.tsx` | splash e encaminhamento por sessão | Não nesta rodada | Sim | Não reiniciado: encaminhamento também atualiza estado local |
| `/welcome` | composição, CTAs, dimensionamento | Sim, cópia isolada | Sim | Conta original preservada; evidência 21 |
| `/login`, `/register` | campos de login/cadastro; login com foco, teclado, erro e busy | Sim, cópia isolada | Sim | Autenticação simulada, sem cadastro real; 22/24/26/27/28 |
| `/auth` | redireciona por `mode` para login/cadastro | Não | Sim | Rota legada, sem interface própria |
| `/onboarding` | introdução e conclusão com respostas sintéticas pré-carregadas | Parcial, cópia isolada | Sim | Sequência completa de perguntas não percorrida; 23/25 |
| `/celebration` | processamento, loading e erro de geração | Sim, cópia isolada | Sim | Serviço de IA simulado; sem consumo ou integração real; 53/60 |
| `/onboarding-report-intro` | entrada e sucesso da geração simulada | Sim, cópia isolada | Sim | Extração sintética; 54 |
| `/onboarding-summary` | resumo longo, expansão, editor preenchido, teclado e scroll até ações finais | Sim, cópia isolada | Sim | Não validados todos os editores de categorias nem aplicação persistida do relatório; 55–59 |
| `/(tabs)/chat` | conteúdo existente, texto e registro; composer desfocado/focado; `/`; teclado de letras/símbolos; fechar | Sim | Sim | Sem novo envio; fallback analisado no código; sem conversa extensa fabricada |
| `/(tabs)/tarefas` | vazio; nova tarefa; disabled; foco e teclado; cancelar | Sim | Sim | Sem criação, conclusão ou edição de tarefa real |
| `/(tabs)/calendario` | mês aberto; dia sem itens; novo compromisso; seletores iniciais; cancelar | Sim | Sim | Sem evento real; colapso, listas extensas e edição não exercitados |
| `/(tabs)/financeiro` | mês vazio; resumo; filtros; nova transação; disabled; cancelar | Sim | Sim | Sem transação, seleção em lote, exclusão ou undo |
| `/(tabs)/apps` | módulos ativos, sugestões, scroll | Sim | Sim | Não ativados/desativados/reordenados módulos |
| `/plugins/store` | ativos, disponíveis e dependência de Comissões | Sim | Sim | Nenhuma ativação |
| `/plugins/estoque` | lista com item, ações de entrada/saída visíveis e formulário de criação | Sim | Sim | Movimentação e edição não executadas; novo formulário em 72 |
| `/plugins/catalogo` | lista com item, filtros, busca e formulário de criação com tipo/unidade/estoque | Sim | Sim | Edição e salvamento não exercitados; 70 |
| `/plugins/clientes` | lista sintética e formulário de criação | Sim | Sim | Expansão e edição ainda não exercitadas; nenhuma identidade real entregue; 71 |
| `/plugins/fornecedores` | vazio, lista, novo, edição, expansão de notas longas, swipe e alerta de exclusão | Sim, cópia isolada | Sim | Exclusão não confirmada; sem CRUD persistido; 29–31/62–65 |
| `/plugins/equipe` | vazio, lista, novo, edição, teclado, Voltar, reabertura e criação sintética | Sim, cópia isolada | Sim | Criação apenas em memória; 33–35/61/73–76 |
| `/plugins/vendas` | vazio, lista com venda aberta/concluída, novo, edição, itens e seletor de cliente | Sim, cópia isolada | Sim | Sem concluir/cancelar venda ou testar estoque/financeiro integrado; 36–39/66 |
| `/plugins/orcamentos` | vazio, lista pendente, novo e edição preenchida | Sim, cópia isolada | Sim | Sem aprovar, cancelar ou converter em venda; 40–42/67 |
| `/plugins/contratos` | vazio, lista ativa, novo, periodicidade e edição preenchida | Sim, cópia isolada | Sim | Sem cancelar contrato ou gerar cobrança; 43–45/68 |
| `/plugins/entregas` | vazio, lista com endereço extenso, novo e edição preenchida | Sim, cópia isolada | Sim | Sem transição de status; vínculo da fixture não serve para avaliar consistência de pedido; 46–48/69 |
| `/plugins/comissoes` | vazio, resumo/lista pendente, confirmação e histórico após fechamento sintético | Sim, cópia isolada | Sim | Dependências habilitadas apenas na cópia; sem pagamento real; 49–52 |
| `/plugins/[id]` | interface genérica e formulário no código | Não | Sim, revisão estática | Sem instância aberta nesta rodada |
| Avatar — `AccountSheet` | aberto; atalhos; fechamento por navegação | Sim, sem captura entregue | Sim | Identificação pessoal não anexada; logout não executado |
| `/profile` | identificação, dados e negócio | Sim, sem captura entregue | Sim | Sem upload de foto ou edição/salvamento |
| `/settings` | segurança/conta; editor de senha; foco/teclado; cancelar | Sim | Sim | Sem mudança de senha ou exclusão |
| `/resources` | integração IA | Sim | Sim | Sem alteração de integração |
| `/ai-settings` | verificação de status, formulário e ajuda | Sim | Sim | Sem testar conexão, inserir/remover chave ou salvar; captura mostra loading |
| `/account`, `/preferences` | redirecionam para perfil/configurações | Não | Sim | Rotas legadas, sem interface própria |
| Alertas — `AppDialog` / `AppAlertHost` | confirmação de fechamento de comissão e exclusão de fornecedor | Sim, cópia isolada | Sim | Não validados textos extensos, foco assistido e todos os tipos de alerta; 51/64 |
| Feedback — `AppFeedbackHost`, `UndoSnackbar` | posicionamento e estados no código | Não | Sim | Sucesso/undo não disparados |
| Seletores, pickers, detalhes avançados | estrutura de Tags, Calendar, Tasks, Finance e documentos | Parcial: controles iniciais nos formulários | Sim | Não se afirma validação de todos os popovers/seletores |

### Método do complemento e preservação do ambiente

O complemento foi executado no mesmo Android físico Samsung SM-A366E, Android 16/API 36. Para alcançar telas sem encerrar a sessão real, foi usada uma cópia temporária do projeto, com identidade de auditoria e Metro separado. Os componentes visuais de produto foram reutilizados; autenticação, armazenamento de onboarding e geração de IA receberam substitutos locais. Não foram copiadas credenciais de ambiente. Supabase ficou desabilitado nessa cópia e os dados foram sintéticos, com nomes de exemplo e e-mails `example.invalid`.

Os módulos foram habilitados somente no store da cópia, por meio do mecanismo de ativação existente, respeitando dependências; Equipe/Vendas e cadastros de referência sustentaram os estados de Comissões e documentos. Não houve mudança de módulos da conta real. A criação de funcionário e o fechamento de comissão ocorreram apenas no estado sintético. Loading e erro de login/IA são estados reais da interface alimentados por respostas simuladas: não validam o servidor, a autenticação real ou a qualidade de uma extração de IA.

A maioria das capturas adicionais usa fonte 1,0; Welcome inicial usa 0,8. As tentativas em 1,3/2,0 e viewport de 320 dp não produziram um conjunto limpo e confiável de evidências: houve sessão sem escala atualizada, menu do Expo Go sobreposto ou saída da experiência. Essas imagens foram descartadas e esses cenários **não são contados como visualmente validados**. A resolução física 1080 × 2340, densidade 450 dpi e escala original 0,8 foram restabelecidas. O Metro original foi preservado; o servidor e a cópia de auditoria foram encerrados/removidos ao concluir.

Comparação SHA-256 dos 198 arquivos de `app/` e `src/` com o início do complemento não identificou alteração no código original. As mudanças preexistentes em Chat/BotMessageCard continuam fora do escopo. Foram mantidos somente o relatório consolidado e evidências adicionais; sem correções, commits ou alterações permanentes em conta/dados.

### Limites de conclusão — cobertura consolidada

- **Autenticação/onboarding:** Welcome, login e cadastro foram vistos no Android; login teve loading, erro e teclado. Não houve cadastro ou login em servidor real, recuperação de senha, validação de todos os erros de campo ou confirmação por e-mail. Onboarding foi visto na introdução e conclusão com respostas pré-carregadas, não nas seis perguntas completas com teclado/progresso.
- **Relatórios:** geração/loading/erro simulados, entrada de sucesso, resumo longo expandido e edição geral com teclado/scroll foram vistos. Não foram validados todos os editores de categorias, a aplicação persistente do relatório, todas as classes de erro remoto nem o caminho sem chave de IA.
- **Módulos:** os sete antes inativos tiveram listas vazias/preenchidas; seis possuem evidências de formulários de criação e edição. Comissões teve confirmação e histórico. Não se afirma CRUD completo, cobrança, pagamento, conversão de orçamento, mudança de status de venda/entrega ou integração entre estoque/financeiro. O pedido vinculado à fixture de Entregas não atende ao filtro de pedidos concluídos do seletor; o rótulo “Não atribuído” da captura 69 não foi classificado como defeito do produto.
- **Outros fluxos:** formulários de criação de Catálogo, Clientes e Estoque foram acrescentados; respectivas edições e movimentações permanecem pendentes. Listas preenchidas/edição de Tarefas, Calendário e Financeiro, seleção em lote e undo ainda não tiveram o complemento visual. O Chat mantém a evidência original, sem nova conversa extensa ou reprodução de VIS-013. A rota genérica `/plugins/[id]` permanece estática. Redirecionamentos legados não têm interface própria.
- **Componentes/feedback:** seletor de cliente e alertas de comissão/exclusão foram abertos; criação sintética e histórico confirmam resultados visíveis na lista. Não equivalem a teste de `AppFeedbackHost`/`UndoSnackbar`, de todos os seletores, menus, pickers ou alertas com texto extenso.
- **Acessibilidade/plataforma:** Voltar nativo foi exercitado com teclado aberto. Não foram validados fonte 1,3/2,0, tela menor, rotação, TalkBack, alto contraste, redução de movimento ativada, teclado flutuante, navegação por gestos, Android antigo, iOS ou build de release. VIS-007 continua risco identificado pelo código. Nenhum tempo de resposta ou taxa de frames foi medido.

As novas capturas mostram estados diferentes e dados sintéticos. A captura de tentativa de validação sem mudança de estado e as tentativas de escala/dimensão inválidas não integram as evidências entregues. Falhas da infraestrutura temporária não foram convertidas em achados do Lumio.

### Índice das evidências

| Captura | Uso |
|---|---|
| [01 — Tarefas](auditoria-visual/01-tarefas.png) | vazio, busca, header e navegação |
| [02 — Calendário](auditoria-visual/02-calendario.png) | mês, dia selecionado, filtros e empty state |
| [03 — Financeiro](auditoria-visual/03-financeiro.png) | resumo, filtros e empty state |
| [04 — Apps](auditoria-visual/04-apps.png) | hierarquia de módulos e sugestões |
| [05 — Estoque](auditoria-visual/05-estoque.png) | lista, tipografia e ações |
| [06 — Catálogo](auditoria-visual/06-catalogo.png) | tipo pendente, filtros e tipografia |
| [08 — Configurações](auditoria-visual/08-configuracoes.png) | conta, header e ação destrutiva |
| [09 — Editor de senha](auditoria-visual/09-senha.png) | campos e botões |
| [10 — Senha com teclado](auditoria-visual/10-senha-teclado.png) | foco e adaptação ao teclado |
| [11 — Nova tarefa](auditoria-visual/11-nova-tarefa.png) | labels, chips e botões |
| [12 — Tarefa com teclado](auditoria-visual/12-tarefa-teclado.png) | conteúdo acessível com IME |
| [13 — Novo compromisso](auditoria-visual/13-novo-evento.png) | seletores e hierarquia |
| [14 — Nova transação](auditoria-visual/14-nova-transacao.png) | valor, campos, tags e botões |
| [15 — Recursos](auditoria-visual/15-recursos.png) | header e superfície da conta |
| [16 — IA](auditoria-visual/16-ia.png) | header, loading e texto auxiliar |
| [17 — Loja](auditoria-visual/17-loja.png) | cards, dependências e barra nativa |
| [18 — Chat](auditoria-visual/18-chat.png) | texto e registro na superfície atual |
| [19 — Comandos](auditoria-visual/19-chat-comandos.png) | painel integrado e scroll |
| [20 — Comandos/símbolos](auditoria-visual/20-chat-simbolos.png) | painel com outro modo do teclado |

### Evidências adicionais do complemento

São **55 capturas adicionais válidas**, totalizando **74 evidências** com as 19 anteriores. Lacunas na sequência numérica correspondem a capturas descartadas, não a testes omitidos do índice.

| Captura | Estado efetivamente observado no Android |
|---|---|
| [21 welcome](auditoria-visual/21-welcome.png) | Welcome: identidade, CTAs e composição |
| [22 login](auditoria-visual/22-login.png) | Login: estado inicial |
| [23 onboarding intro](auditoria-visual/23-onboarding-intro.png) | Onboarding: introdução |
| [24 login loading](auditoria-visual/24-login-loading.png) | Login: loading simulado |
| [25 onboarding conclusao](auditoria-visual/25-onboarding-conclusao.png) | Onboarding: conclusão com respostas pré-carregadas |
| [26 login teclado](auditoria-visual/26-login-teclado.png) | Login: foco e teclado Samsung |
| [27 login erro](auditoria-visual/27-login-erro.png) | Login: erro simulado e senha mascarada |
| [28 cadastro](auditoria-visual/28-cadastro.png) | Cadastro: campos e ação principal |
| [29 fornecedores vazio](auditoria-visual/29-fornecedores-vazio.png) | Fornecedores: vazio |
| [30 fornecedores lista](auditoria-visual/30-fornecedores-lista.png) | Fornecedores: lista sintética e FAB |
| [31 fornecedores formulario](auditoria-visual/31-fornecedores-formulario.png) | Fornecedores: criação |
| [33 equipe vazio](auditoria-visual/33-equipe-vazio.png) | Equipe: vazio |
| [34 equipe lista](auditoria-visual/34-equipe-lista.png) | Equipe: lista sintética e FAB |
| [35 equipe formulario](auditoria-visual/35-equipe-formulario.png) | Equipe: criação |
| [36 vendas vazio](auditoria-visual/36-vendas-vazio.png) | Vendas: vazio |
| [37 vendas lista](auditoria-visual/37-vendas-lista.png) | Vendas: aberta/concluída e FAB |
| [38 vendas formulario](auditoria-visual/38-vendas-formulario.png) | Vendas: criação com itens |
| [39 seletor cliente](auditoria-visual/39-seletor-cliente.png) | Seletor de cliente: opções, busca e criação |
| [40 orcamentos vazio](auditoria-visual/40-orcamentos-vazio.png) | Orçamentos: vazio |
| [41 orcamentos lista](auditoria-visual/41-orcamentos-lista.png) | Orçamentos: lista pendente e FAB |
| [42 orcamentos formulario](auditoria-visual/42-orcamentos-formulario.png) | Orçamentos: criação |
| [43 contratos vazio](auditoria-visual/43-contratos-vazio.png) | Contratos: vazio |
| [44 contratos lista](auditoria-visual/44-contratos-lista.png) | Contratos: ativo, ações e FAB |
| [45 contratos formulario](auditoria-visual/45-contratos-formulario.png) | Contratos: criação e periodicidade |
| [46 entregas vazio](auditoria-visual/46-entregas-vazio.png) | Entregas: vazio |
| [47 entregas lista](auditoria-visual/47-entregas-lista.png) | Entregas: endereço longo e FAB; vínculo da fixture não valida domínio |
| [48 entregas formulario](auditoria-visual/48-entregas-formulario.png) | Entregas: criação |
| [49 comissoes vazio](auditoria-visual/49-comissoes-vazio.png) | Comissões: vazio |
| [50 comissoes lista](auditoria-visual/50-comissoes-lista.png) | Comissões: resumo e pendência sintética |
| [51 comissoes confirmacao](auditoria-visual/51-comissoes-confirmacao.png) | Comissões: confirmação de fechamento |
| [52 comissoes historico](auditoria-visual/52-comissoes-historico.png) | Comissões: histórico após fechamento somente em memória |
| [53 relatorio loading](auditoria-visual/53-relatorio-loading.png) | Relatório: processamento/loading com IA simulada |
| [54 relatorio intro](auditoria-visual/54-relatorio-intro.png) | Relatório: entrada após geração simulada |
| [55 relatorio resumo longo](auditoria-visual/55-relatorio-resumo-longo.png) | Relatório: resumo longo recolhido |
| [56 resumo expandido](auditoria-visual/56-resumo-expandido.png) | Relatório: resumo expandido |
| [57 relatorio editor](auditoria-visual/57-relatorio-editor.png) | Relatório: editor geral preenchido |
| [58 relatorio editor teclado](auditoria-visual/58-relatorio-editor-teclado.png) | Relatório: editor com teclado |
| [59 relatorio editor final](auditoria-visual/59-relatorio-editor-final.png) | Relatório: fim do editor e ações acessíveis por scroll |
| [60 relatorio erro](auditoria-visual/60-relatorio-erro.png) | Relatório: erro de geração simulado |
| [61 equipe edicao](auditoria-visual/61-equipe-edicao.png) | Equipe: edição preenchida |
| [62 fornecedor expandido](auditoria-visual/62-fornecedor-expandido.png) | Fornecedores: observações longas expandidas |
| [63 fornecedor acoes](auditoria-visual/63-fornecedor-acoes.png) | Fornecedores: swipe e ação destrutiva |
| [64 fornecedor exclusao](auditoria-visual/64-fornecedor-exclusao.png) | Fornecedores: alerta de exclusão; operação não confirmada |
| [65 fornecedor edicao](auditoria-visual/65-fornecedor-edicao.png) | Fornecedores: edição preenchida |
| [66 vendas edicao](auditoria-visual/66-vendas-edicao.png) | Vendas: edição preenchida |
| [67 orcamento edicao](auditoria-visual/67-orcamento-edicao.png) | Orçamento: edição preenchida |
| [68 contrato edicao](auditoria-visual/68-contrato-edicao.png) | Contrato: edição preenchida |
| [69 entrega edicao](auditoria-visual/69-entrega-edicao.png) | Entrega: edição preenchida; Não atribuído decorre da fixture |
| [70 catalogo formulario](auditoria-visual/70-catalogo-formulario.png) | Catálogo: criação, tipo/unidade/controle de estoque |
| [71 cliente formulario](auditoria-visual/71-cliente-formulario.png) | Clientes: criação sobre lista sintética |
| [72 estoque formulario](auditoria-visual/72-estoque-formulario.png) | Estoque: criação e campos de quantidade |
| [73 equipe retorno teclado](auditoria-visual/73-equipe-retorno-teclado.png) | Equipe: retorno à lista após um Voltar com IME aberto |
| [74 equipe teclado](auditoria-visual/74-equipe-teclado.png) | Equipe: rascunho digitado com teclado |
| [75 equipe rascunho descartado](auditoria-visual/75-equipe-rascunho-descartado.png) | Equipe: reabertura com rascunho descartado |
| [76 equipe criacao sucesso](auditoria-visual/76-equipe-criacao-sucesso.png) | Equipe: criação sintética refletida na lista |

## C. Inventário do design system

| Área | Fonte atual | Padrão / lacuna |
|---|---|---|
| Tema | `src/constants/theme.ts` | Uma entrada central; StyleSheet, sem biblioteca externa de tema |
| Fundos | `Colors.bg`, `appBackground`, `chatBackground`, `bottomSurface` | `#F3FFF9` no fluxo inicial, `#F8FCFA` interno, `#E6F7F1` inferior; diferenças intencionais |
| Superfícies | `SurfaceStyles` | control/filter com borda; card com borda sutil; list e message sem borda; overlay; tonal; floating |
| Elevação | `SurfaceElevation` | Sombra de message mais forte que card/list; fallback por elevation em Android < 9. Não é necessário igualar funções diferentes |
| Cores semânticas | `Colors` | accent/success compartilham verde; navy em ink/bubbleUser; primary é quase preto. Falta separar verde de marca de verde de texto acessível |
| Tipografia | `Typography`, `FontSize` | Plus Jakarta Sans 400–800; tamanhos 11/13/15/17/20/24/32/40. Falta escala de estilos completos com line-height e papel semântico |
| Espaçamento | `Spacing` | 4/8/12/16/20/24/32; ainda há offsets e gaps locais |
| Radius | `Radius`, `DialogTokens` | 8/12/16/20/cápsula; diálogo aprovado 28. Controles semelhantes variam sem contrato comum |
| Ícones | Ionicons | Mesma biblioteca predominante; preenchidos e outlines cumprem funções diferentes. Nenhuma incompatibilidade global comprovada |
| Inputs | MessageComposer, AuthScreen, EditorField, taskFormStyles, buscas locais | Superfície compartilhada, estados e dimensão parcialmente diferentes |
| Botões | implementações locais + estilos de formulário | Não há primitivo único com contrato comum de tamanho, busy, disabled e foco |
| Cards | SurfaceStyles e componentes de domínio | Tokens de profundidade centralizados; estrutura local |
| Conta | AccountHeader, AccountRow, AccountSection, BusinessBadge | Família compartilhada e coerente; header de IA usa variante distinta |
| Formulários | taskFormStyles / pluginFormStyles / InformationEditor | Reuso existente; `pluginFormStyles` sobrescreve estilos locais ao final em várias telas |
| Modais | BottomSheet, ModalKeyboardViewport, ModalScrollView, AppDialog | Inset/teclado tratados; também há pickers locais em Tarefas |
| Alertas | AppAlertHost → AppDialog | Um fluxo compartilhado de confirmação; tokens próprios documentados |
| Feedback | AppFeedbackHost e Finance/UndoSnackbar | Sucesso global e undo financeiro têm papéis distintos; contrato de posicionamento não unificado |
| Formas orgânicas | BottomSurface, ReportBackdrop, welcome | Inferior nas abas e fundo de conta/relatório; ausência nos módulos não é automaticamente erro |
| Movimento | Reanimated e Animated/PanResponder | Sem tokens globais de duração; redução de movimento aplicada em alguns componentes, ausente no BottomSheet |

## D. Inconsistências globais

### VIS-001 — Texto auxiliar e placeholders com contraste insuficiente

**Local:** estados vazios, buscas, Tags, Apps e IA; texto pequeno em superfície clara. **Severidade:** P1. **Tipo:** acessibilidade.

**Descrição:** `Colors.textMuted` é usado para conteúdo que precisa ser lido, não apenas decoração. **Evidência:** Android e código; capturas 01/02/03/04/11/16. `#AAAAAA` sobre branco = 2,32:1; sobre `#F8FCFA` = 2,25:1. **Padrão esperado:** texto pequeno relevante com contraste mínimo de 4,5:1 como referência WCAG. **Possível causa:** token único atende simultaneamente texto secundário, placeholders e elementos dispensáveis. **Recomendação:** separar texto auxiliar legível de decoração e revisar usos; não escurecer componentes disabled automaticamente. **Abrangência:** global, inclusive categorias de transação e badges. **Confiança:** alta. **Arquivos relacionados:** `src/constants/theme.ts`, `app/components/TagSelector.tsx`, `app/components/Calendar/EmptyState.tsx`, `app/components/Finance/FinanceEmptyState.tsx`, `app/(tabs)/tarefas.tsx`, `app/ai-settings.tsx`.

### VIS-002 — Verde de marca usado como cor de texto pequeno

**Local:** CTAs ativos, chips, tabs, badges e links. **Severidade:** P1. **Tipo:** acessibilidade / dívida de design system.

**Descrição:** a marca verde é também o tom de links, labels e preenchimentos de botões com texto branco. **Evidência:** Android e código, 04/06/09/11/13/17; branco sobre `#00A878` = 3,06:1; verde sobre `#E6F7F1` = 2,76:1. **Padrão esperado:** distinguir cor de marca, texto interativo e preenchimento acessível; texto pequeno normalmente exige 4,5:1. **Possível causa:** ausência de tokens específicos de foreground/background para ações. **Recomendação:** preservar a marca e estudar variantes mais escuras para texto e CTAs, validando todos os estados. **Abrangência:** global; botões, conta, tabs e comandos. **Confiança:** alta. **Arquivos relacionados:** `src/constants/theme.ts`, `src/components/account-menu.tsx`, `src/components/app-dialog.tsx`, `app/(tabs)/_layout.tsx`, `app/components/Forms/pluginFormStyles.ts`.

### VIS-003 — Buscas e metadados dos módulos misturam famílias tipográficas

**Local:** Estoque, Catálogo, Fornecedores, Equipe, Vendas e Contratos; busca e descrição. **Severidade:** P2. **Tipo:** inconsistência.

**Descrição:** algumas buscas/metadados omitem `fontFamily`, enquanto buscas de Tarefas/Financeiro declaram Plus Jakarta Sans. **Evidência:** ambos; comparar 01 com 05/06. O código de `searchInput` nos módulos não define família. **Padrão esperado:** função equivalente usa a mesma família, salvo justificativa explícita. **Possível causa:** TextInput/Text não herdam um padrão global da marca. **Recomendação:** definir um contrato compartilhado de busca e estilos de metadata; manter tamanho apropriado por densidade. **Abrangência:** família de módulos. **Confiança:** alta. **Arquivos relacionados:** `app/plugins/estoque.tsx`, `app/plugins/catalogo.tsx`, `app/plugins/fornecedores.tsx`, `app/plugins/equipe.tsx`, `app/plugins/vendas.tsx`, `app/plugins/contratos.tsx`, `app/components/Finance/SearchBar.tsx`.

### VIS-004 — Botões de formulário têm tamanhos e estados diferentes

**Local:** criar tarefa/evento/transação versus alterar senha/perfil. **Severidade:** P2. **Tipo:** inconsistência / acessibilidade.

**Descrição:** botões de `taskFormStyles` usam padding vertical 8 e texto 13, sem minHeight; InformationEditor usa minHeight 50 e texto 15. **Evidência:** Android e código, 09 versus 11/13/14. Com fonte 0,8 os botões compactos ficam visivelmente menores. **Padrão esperado:** ações equivalentes com contrato de altura mínima e hierarquia consistente. **Possível causa:** reuso por estilos em vez de componente com variantes de estado. **Recomendação:** estudar contrato comum para ações de formulário, com mínimo de toque e tratamento de busy/disabled. **Abrangência:** formulários de Tasks, Calendar, Finance e módulos. **Confiança:** alta. **Arquivos relacionados:** `app/components/Tasks/taskFormStyles.ts`, `app/components/Forms/pluginFormStyles.ts`, `src/components/information-editor.tsx`, `app/components/Finance/QuickAddForm.tsx`.

### VIS-005 — Foco visual depende do componente usado

**Local:** MessageComposer/AuthScreen versus EditorField e inputs de formulário. **Severidade:** P2. **Tipo:** inconsistência de estado.

**Descrição:** composer e autenticação aplicam `controlFocus`; o editor de senha permanece com a mesma borda ao focar, mostrando apenas cursor. **Evidência:** ambos, 10 versus 19; ausência de estado de foco em EditorField/taskFormStyles. **Padrão esperado:** feedback de foco consistente para controles equivalentes, sem necessidade de transformar todos em verde forte. **Possível causa:** somente a superfície foi compartilhada, não o contrato de interação. **Recomendação:** definir foco comum e contrastante; validar teclado físico e navegação assistida posteriormente. **Abrangência:** formulários de conta e CRUD. **Confiança:** alta. **Arquivos relacionados:** `src/components/message-composer.tsx`, `src/components/auth-screen.tsx`, `src/components/information-editor.tsx`, `app/components/Tasks/taskFormStyles.ts`.

### VIS-006 — Áreas de toque pequenas em controles secundários

**Local:** fechar edição, voltar/mais nos módulos, células do calendário e chips. **Severidade:** P2. **Tipo:** acessibilidade.

**Descrição:** fechar edição tem 34×34 dp; calendário tem círculo 34 e padding vertical total 8, resultando em 42 dp de altura da célula; vários ícones de header têm somente padding 4. Não há hitSlop nessas implementações. **Evidência:** código e controles renderizados em 02/09/05; dimensões extraídas dos estilos, não medidas por pixels da screenshot. **Padrão esperado:** referência Android de área tocável ≥48×48 dp, independentemente do tamanho do ícone. **Possível causa:** dimensão visual tratada como dimensão de interação. **Recomendação:** estudar expansão de alvo/minHeight preservando aparência e evitando alvos sobrepostos. **Abrangência:** transversal; cada ocorrência precisa de revisão de layout. **Confiança:** alta nas dimensões citadas. **Arquivos relacionados:** `src/components/information-editor.tsx`, `app/components/Calendar/CalendarDayCell.tsx`, `app/plugins/estoque.tsx`, `app/plugins/catalogo.tsx`, `app/components/Tasks/taskFormStyles.ts`.

### VIS-007 — Falta contrato de expansão tipográfica para controles de altura fixa

**Local:** buscas, filtros financeiros e células do calendário; fonte ampliada. **Severidade:** P2. **Tipo:** risco de acessibilidade / responsividade.

**Descrição:** buscas de altura 44, filtro financeiro com container 42 e texto em círculos 34 podem ficar comprimidos com fontes maiores. **Evidência:** somente código; não foi reproduzido truncamento por fonte ampliada. **Padrão esperado:** texto deve crescer ou refluír com o controle; riscos precisam de teste real. **Possível causa:** height fixa sem contrato específico de escala. **Recomendação:** validar 1,0/1,3/2,0 em ambiente autorizado e dimensões menores antes de decidir ajustes. **Abrangência:** global em chrome/seletores compactos. **Confiança:** média como risco, não bug confirmado. **Arquivos relacionados:** `app/(tabs)/tarefas.tsx`, `app/components/Finance/FinanceFilterChips.tsx`, `app/components/Finance/SearchBar.tsx`, `app/components/Calendar/CalendarDayCell.tsx`.

### VIS-008 — Voltar muda de linguagem no mesmo fluxo de conta

**Local:** Recursos → Inteligência Artificial. **Severidade:** P2. **Tipo:** inconsistência.

**Descrição:** Recursos usa botão mint arredondado com sombra e seta verde; IA usa chevron preto sem essa superfície. **Evidência:** ambos, comparação 15/16; AccountHeader possui variantes `refined`/padrão. **Padrão esperado:** continuidade visual em páginas da mesma família, salvo intenção documentada. **Possível causa:** IA não utiliza a variante refined adotada nas telas de conta. **Recomendação:** revisar escolha de variante e formalizar quais fluxos usam cada header; não substituir a hierarquia das abas por headers de conta. **Abrangência:** conta/IA; também comparar relatório e autenticação futuramente. **Confiança:** alta. **Arquivos relacionados:** `app/account/_shared.tsx`, `app/resources.tsx`, `app/ai-settings.tsx`, `src/components/back-button.tsx`.

## E. Achados por tela

### VIS-009 — Avisos pequenos usam cores que não atingem contraste de texto

**Local:** Loja/Comissões, ações destrutivas da conta, badges de prazo. **Severidade:** P1. **Tipo:** acessibilidade.

**Descrição:** texto de dependência é amarelo/laranja pequeno sobre branco; texto destrutivo usa danger em superfície branca. **Evidência:** ambos, 17 e 08. `#F59E0B`/branco = 2,15:1; `#E05555`/branco = 3,75:1. **Padrão esperado:** mensagens relevantes continuam legíveis com 4,5:1 para texto pequeno; não depender da cor para distinguir criticidade. **Possível causa:** tokens de status também utilizados como texto. **Recomendação:** criar futuros pares semânticos de texto/fundo para warning e danger; manter rótulos/ícones. **Abrangência:** alertas de estoque, prazos e ações destrutivas. **Confiança:** alta. **Arquivos relacionados:** `app/plugins/store.tsx`, `src/components/account-menu.tsx`, `app/components/Calendar/EventListItem.tsx`, `src/constants/theme.ts`.

### VIS-010 — Conteúdo da Loja passa por trás da navegação nativa

**Local:** Loja de módulos, scroll de conteúdo. **Severidade:** P2. **Tipo:** acabamento de safe area.

**Descrição:** na captura o início do próximo card aparece atrás dos botões nativos Android, em vez de haver uma superfície inferior que separe a área de interação do conteúdo. **Evidência:** ambos, 17; SafeAreaView usa somente `top`, content usa paddingBottom fixo 100. **Padrão esperado:** respeitar inset inferior e definir conscientemente o tratamento edge-to-edge. **Possível causa:** proteção do último item por padding fixo, sem tratamento visual durante scroll. **Recomendação:** revisar inset/superfície inferior; testar se último botão fica totalmente acessível. Não foi comprovado botão inacessível. **Abrangência:** Loja; módulos com mesma estratégia são candidatos, não ocorrências confirmadas. **Confiança:** alta para a sobreposição visual, média para a causa. **Arquivos relacionados:** `app/plugins/store.tsx`, `src/components/system-bars.tsx`, `src/utils/systemBarAppearance.ts`.

**Revisão justificada pelo complemento:** a abrangência deixa de ser apenas candidata. Os FABs de Fornecedores, Equipe, Vendas, Orçamentos, Contratos e Entregas ocupam a faixa da navegação nativa de três botões, conforme 30/34/37/41/44/47. A hierarquia Android apresentou área do FAB `[866,2126][1024,2284]`, enquanto a faixa nativa começa aproximadamente em y=2205. O toque na região inferior, em y=2220, não abriu o formulário; na parte superior, em y=2160, abriu. O botão permanece utilizável pela porção superior; não se afirma bloqueio total. Nesses módulos, `SafeAreaView` protege somente `top` e o FAB tem `bottom: 24` fixo. A evidência agora inclui perda parcial de área tocável. **Severidade permanece P2**, mas prioridade sobe para o segundo grupo da seção I. A recomendação futura passa a incluir FAB/inset inferior e validação de toque nos módulos citados. A observação inicial de ausência de botão inacessível refere-se à primeira rodada na Loja.

### VIS-011 — Empty state do Calendário compete com o FAB

**Local:** Calendário expandido, dia vazio. **Severidade:** P3. **Tipo:** oportunidade estética / composição.

**Descrição:** a instrução de adicionar compromisso fica muito próxima do FAB; o botão ocupa a mesma faixa de leitura e reduz o respiro à direita. **Evidência:** Android, 02. **Padrão esperado:** instrução e ação com proximidade útil, sem competição visual. **Possível causa:** calendário ocupa grande parcela vertical e empty state usa padding uniforme; FAB absoluto. **Recomendação:** estudar respiro inferior ou redistribuição do estado vazio nesse estado específico. **Abrangência:** Calendário em mês expandido; telas menores podem agravar, ainda não testadas. **Confiança:** média; avaliação de composição, sem bloqueio comprovado. **Arquivos relacionados:** `app/components/Calendar/EmptyState.tsx`, `app/components/Calendar/FAB.tsx`, `app/(tabs)/calendario.tsx`.

### VIS-012 — Cortes horizontais pouco explicados em tags e atalhos

**Local:** Nova tarefa/compromisso/transação; chips horizontais. **Severidade:** P3. **Tipo:** oportunidade de descoberta.

**Descrição:** última opção aparece cortada e as barras horizontais são ocultadas. O corte pode sinalizar scroll, mas não há orientação consistente. **Evidência:** ambos, 11/13/14; TagSelector usa ScrollView horizontal sem indicador e texto em uma linha. **Padrão esperado:** alternativas fora da tela devem ser descobertas sem parecer texto quebrado. **Possível causa:** scroll horizontal compacto com rótulos longos. **Recomendação:** avaliar affordance de continuidade ou wrap em grupos curtos; preservar scroll horizontal onde ele faz sentido. **Abrangência:** Tags e atalhos de data. **Confiança:** média; não é bug de truncamento da lista. **Arquivos relacionados:** `app/components/TagSelector.tsx`, `app/components/Tasks/TaskDateSelector.tsx`, `app/components/Finance/QuickAddForm.tsx`.

### VIS-013 — Cards do Chat truncam conteúdo sem expansão

**Local:** BotMessageCard, títulos e contexto longos. **Severidade:** P2. **Tipo:** risco de conteúdo / acessibilidade.

**Descrição:** título limita a três linhas, contexto a duas; não há expansão no componente. **Evidência:** código; não foi criado registro longo para reproduzir. **Padrão esperado:** informação essencial consultável integralmente, mantendo a composição compacta. **Possível causa:** limites de linhas fixos aplicados a todos os kinds. **Recomendação:** estudar expansão ou acesso a detalhes conforme o tipo, sem remover compactação indiscriminadamente. **Abrangência:** todos os kinds do card (tarefas, eventos, finanças, cadastros e módulos). **Confiança:** alta para truncamento programado, média para impacto em cada kind. **Arquivos relacionados:** `app/components/chat/BotMessageCard.tsx`, `app/(tabs)/chat.tsx`.

### VIS-014 — Fundo orgânico da conta e módulos têm níveis diferentes de acabamento

**Local:** conta versus módulos internos. **Severidade:** P3. **Tipo:** oportunidade estética.

**Descrição:** conta usa fundo orgânico e superfícies de navegação sem borda; módulos usam layout mais rígido de header/busca/cards. A diferença pode ser apropriada à densidade, mas ainda não há regra explícita de família. **Evidência:** ambos, 08/15 comparados a 05/06. **Padrão esperado:** mesma identidade com variação funcional documentada. **Possível causa:** refinos recentes de conta e implementações locais anteriores de módulos. **Recomendação:** avaliar continuidade de ritmo, ícones e respiro antes de adicionar decoração. **Abrangência:** módulos internos. **Confiança:** média; preferência de composição, não erro objetivo. **Arquivos relacionados:** `app/account/_shared.tsx`, `app/components/onboarding/report-processing.tsx`, `app/plugins/estoque.tsx`, `app/plugins/catalogo.tsx`.

## F. Problemas de acessibilidade

Prioridade: VIS-001, VIS-002 e VIS-009 (contraste), VIS-006 (toque), VIS-007 (fonte ampliada ainda não testada) e VIS-013 (acesso a conteúdo longo). VIS-005 afeta previsibilidade do foco.

Referências usadas: [WCAG 2.2 — contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG — contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) e [Android — acessibilidade e alvos de toque](https://developer.android.com/guide/topics/ui/accessibility/apps). WCAG foi usada como critério reconhecido de avaliação; não como declaração formal de conformidade de um app nativo.

Contrastes calculados em sRGB: linearização de canais; luminância `0,2126R + 0,7152G + 0,0722B`; razão `(LmaisClara + 0,05)/(LmaisEscura + 0,05)`. Valores abaixo arredondados para exibição; foreground/background vieram do código, não de pixels antialiasados.

| Par | Contraste | Interpretação |
|---|---:|---|
| textMuted / branco | 2,32:1 | insuficiente para texto relevante pequeno |
| textMuted / appBackground | 2,25:1 | insuficiente |
| branco / accent | 3,06:1 | insuficiente para rótulos pequenos; não condena automaticamente texto grande |
| accent / accentLight | 2,76:1 | insuficiente para texto pequeno e vários ícones essenciais |
| danger / branco | 3,75:1 | insuficiente para texto pequeno |
| warning / branco | 2,15:1 | insuficiente |
| textSecondary / branco | 5,33:1 | atende referência de 4,5:1 |
| composerPlaceholder / branco | 3,41:1 | revisar placeholder pequeno; menos crítico que textMuted, mas ainda abaixo de 4,5:1 |
| controlBorder / branco | 1,56:1 | candidato para revisar identificação de campos; borda sutil isolada não prova falha quando outros sinais identificam o controle |

Componentes inativos são exceção de contraste na referência WCAG: a baixa opacidade do botão Adicionar disabled não foi registrada como violação por si só. Estados financeiros têm rótulos/sinais além das cores; não foi comprovada dependência exclusiva de vermelho/verde. Bolinhas de eventos do calendário merecem avaliação futura com dados reais e TalkBack, sem concluir falha nesta rodada.

### VIS-015 — Redução de movimento não é tratada no BottomSheet compartilhado

**Local:** sheets de conta, Calendar, Finance e módulos; abrir/fechar/arrastar. **Severidade:** P2. **Tipo:** acessibilidade / dívida de movimento.

**Descrição:** BottomSheet executa spring/translateY com Animated e PanResponder sem consulta à preferência de redução de movimento; outros componentes já usam useReducedMotion/ReduceMotion. **Evidência:** código; abrir/fechar foi observado, mas preferência do sistema não foi alterada. **Padrão esperado:** política de movimento consistente e respeitosa à preferência do usuário. **Possível causa:** implementações de movimento evoluíram separadamente. **Recomendação:** definir política comum, testar em release e só então avaliar migração técnica. Não se afirma stutter sem medição. **Abrangência:** transversal pelo reuso do BottomSheet. **Confiança:** alta para ausência do tratamento, média para impacto perceptivo. **Arquivos relacionados:** `app/components/Calendar/BottomSheet.tsx`, `app/components/onboarding/report-processing.tsx`, `app/components/onboarding/lumio-speech-bubble.tsx`, `app/(tabs)/chat.tsx`.

## G. Problemas técnicos de padronização

Varredura de 101 arquivos TS/TSX em `app/` e `src/components/`, total de 19.865 linhas. As contagens são **linhas candidatas**, não violações confirmadas: uma linha pode conter vários valores; geometria de ilustração, branco de foreground e números iguais aos tokens podem ser legítimos.

| Busca | Linhas candidatas | Por 100 linhas |
|---|---:|---:|
| Hexadecimal local | 190 | 0,96 |
| fontSize numérico local | 41 | 0,21 |
| borderRadius numérico local | 83 | 0,42 |
| padding/margin/gap numérico | 238 | 1,20 |
| shadow legado ou elevation positivo | 19 | 0,10 |

Não se aplica nota automática de qualidade: a busca de spacing inclui valores da escala; sombras com elevation zero removem elevação; versões antigas do Android têm fallback intencional. Os exemplos confirmados estão nos achados, não no total bruto.

### VIS-016 — Tokens de fonte não centralizam hierarquia completa

**Local:** estilos de headers, labels, metadata e body por tela. **Severidade:** P2. **Tipo:** dívida de design system.

**Descrição:** família/tamanho são tokenizados, mas peso, line-height e função visual continuam combinados localmente. Primários variam entre quase preto e navy sem regra semântica explícita para texto. **Evidência:** código e comparações entre telas; theme separa Typography/FontSize sem variantes textuais completas. **Padrão esperado:** estilos semânticos que preservem variações justificadas de hierarquia. **Possível causa:** sistema nasceu como coleção de valores, não contratos de papel. **Recomendação:** mapear headline/body/label/caption e cores de texto; migrar somente funções equivalentes. **Abrangência:** global. **Confiança:** alta para a dívida; não classifica diferenças de todos os títulos como erro. **Arquivos relacionados:** `src/constants/theme.ts`, `app/account/_shared.tsx`, `app/plugins/catalogo.tsx`, `src/components/auth-screen.tsx`.

### VIS-017 — Estilos locais antigos e compartilhados coexistem por sobrescrita

**Local:** formulários dos módulos; `...pluginFormStyles` ao final do StyleSheet. **Severidade:** P2. **Tipo:** dívida técnica de padronização.

**Descrição:** Catálogo declara modal/card/input/chip locais e depois sobrescreve várias propriedades por pluginFormStyles, que também inclui taskFormStyles. Exemplo: chipActive local preto versus efetivo verde. **Evidência:** código e 06 com filtro ativo verde. **Padrão esperado:** origem de estilo efetivo explícita, sem definições contraditórias que pareçam influenciar a interface. **Possível causa:** migração incremental com aliases preservados. **Recomendação:** em tarefa futura, mapear chaves efetivamente sobrescritas e remover ambiguidade após validar todos os estados; não alterar agora. **Abrangência:** módulos que usam pluginFormStyles, com Catálogo como exemplo confirmado. **Confiança:** alta. **Arquivos relacionados:** `app/plugins/catalogo.tsx`, `app/components/Forms/pluginFormStyles.ts`, `app/components/Tasks/taskFormStyles.ts`.

## H. Oportunidades de melhoria estética

VIS-011, VIS-012 e VIS-014 são oportunidades de composição, não defeitos funcionais. Recomenda-se discutir essas decisões depois de contraste e interação. A extensão mint do composer, o input arredondado, o mascote e as superfícies de mensagens aprovadas devem continuar como referência; não há motivo para convertê-los em cards com borda.

### VIS-018 — Empty states não têm uma regra comum de escala e ritmo

**Local:** Tarefas, Calendar e Finance; vazio inicial. **Severidade:** P3. **Tipo:** oportunidade estética / consistência leve.

**Descrição:** Calendar usa círculo 64/ícone 32; Finance usa 56/28; a composição vertical varia bastante com a presença de resumo/calendário. Parte da diferença é funcional, mas tamanho do símbolo e espaçamento título/descrição não estão expressos como variantes. **Evidência:** ambos, 01/02/03. **Padrão esperado:** família reconhecível com versões compacta e ampla, sem forçar igual posição vertical em telas diferentes. **Possível causa:** componentes independentes de empty state. **Recomendação:** documentar quando usar cada escala e comparar a experiência em telas menores antes de unificar componentes. **Abrangência:** estados vazios do app e módulos. **Confiança:** média; refinamento de sistema, sem erro de layout comprovado. **Arquivos relacionados:** `app/(tabs)/tarefas.tsx`, `app/components/Calendar/EmptyState.tsx`, `app/components/Finance/FinanceEmptyState.tsx`, `app/plugins/equipe.tsx`, `app/plugins/comissoes.tsx`.

### VIS-019 — Voltar com teclado aberto fecha o formulário e descarta o rascunho

**Local:** formulário de novo funcionário em Equipe; navegação nativa Android com teclado aberto. **Severidade:** P2. **Tipo:** interação / preservação de conteúdo.

**Descrição:** depois de digitar “Equipe Teste” no campo Nome, um único acionamento de Voltar nativo fechou o teclado e o sheet, retornando à lista vazia. Ao reabrir Novo funcionário, o nome estava vazio. O comportamento foi reproduzido duas vezes no estado sintético. **Evidência:** Android e código; sequência [74 — rascunho com teclado](auditoria-visual/74-equipe-teclado.png), [73 — lista após Voltar](auditoria-visual/73-equipe-retorno-teclado.png) e [75 — formulário reaberto vazio](auditoria-visual/75-equipe-rascunho-descartado.png). **Padrão esperado:** com IME aberto, Voltar deve permitir retirar o teclado sem perder imediatamente o conteúdo em edição; descarte deve ser previsível. **Possível causa:** `Modal.onRequestClose` chama `close()` sem distinguir estado do teclado; `openAdd` reinicializa os campos. **Recomendação futura:** revisar prioridade de fechamento do teclado/sheet e política de descarte de rascunho; revalidar com navegação por gestos e build de release antes de implementar. **Abrangência confirmada:** Equipe neste Android/Expo Go; o editor de relatório também fechou durante o uso de Voltar com teclado, mas a perda de conteúdo foi documentada integralmente apenas em Equipe. O reuso de BottomSheet indica outras ocorrências possíveis, não confirmadas. **Confiança:** alta no comportamento reproduzido, média na generalização. **Arquivos relacionados:** `app/components/Calendar/BottomSheet.tsx` (`onRequestClose`) e `app/plugins/equipe.tsx` (`openAdd`). Não houve correção.

### Novas evidências para achados anteriores — sem novos IDs

- **VIS-001 / VIS-002:** placeholders de login/cadastro, buscas dos sete módulos e CTAs de seus formulários ampliam a cobertura visual de cores já auditadas. Evidências 22/28/29/31/35/38/42/45/48; os cálculos anteriores continuam válidos, sem novo problema de contraste contado.
- **VIS-003 / VIS-004 / VIS-005:** buscas/metadados e família de formulários antes vistos apenas pelo código agora aparecem no Android. Comparar 30/34/37/44 com 31/35/38 e o campo focado de login em 27. Mantidas severidades e recomendações.
- **VIS-009:** a ação “Cancelar” no contrato ativo (44) amplia evidência visual de warning; ações/alerta de exclusão de fornecedor (63/64) complementam estados destrutivos. Não há novo cálculo ou classificação automática de disabled.
- **VIS-018:** vazios adicionais de Fornecedores/Equipe/Vendas/Orçamentos/Contratos/Entregas/Comissões (29/33/36/40/43/46/49) permitem comparar ritmo da família. Variações funcionais não foram transformadas em novos defeitos.
- **VIS-007 / VIS-013 / VIS-015:** continuam explicitamente sem reprodução visual do cenário específico de fonte ampliada, truncamento longo do Chat ou redução de movimento ativada. Não foram elevados a ocorrências confirmadas.

### Observações positivas acrescentadas

O resumo longo do relatório permite expansão e rolagem (55/56); o editor geral mantém conteúdo e ações finais acessíveis por scroll (57–59). Fornecedores expande observações longas (62). Os formulários de módulos reutilizam a família de superfícies, labels e ações existente; seletor de cliente e alertas de confirmação usam componentes compartilhados (39/51/64). A criação sintética em Equipe aparece na lista (76), e o fechamento sintético de comissão aparece no histórico (52). Estas observações validam somente os estados percorridos, não a conclusão de todas as operações de domínio.

## I. Priorização recomendada

| Ordem | IDs | Motivo |
|---|---|---|
| 1 | VIS-001, VIS-002, VIS-009 | Contraste mensurável, alta abrangência e impacto na leitura |
| 2 | VIS-019, VIS-010, VIS-006, VIS-004 | Preservação de rascunho, FAB parcialmente sobreposto à navegação nativa e interação dos formulários; VIS-010 sobe pela abrangência e evidência de toque |
| 3 | VIS-007, VIS-013 | Verificar fonte ampliada e acesso a textos longos antes de confirmar solução |
| 4 | VIS-003, VIS-005, VIS-008 | Inconsistências reproduzidas de família, foco e continuidade de conta |
| 5 | VIS-015, VIS-016, VIS-017 | Política de movimento, semântica tipográfica e limpeza de origens efetivas |
| 6 | VIS-011, VIS-012, VIS-014, VIS-018 | Decisões de composição com menor impacto e maior subjetividade |

## J. Plano sugerido de correções futuras — não executado

1. **Fechar lacunas remanescentes:** aproveitar as evidências sintéticas já entregues; usar conta de teste e build de release para autenticação real, sequência completa de onboarding, todos os editores do relatório, operações integradas entre módulos e estados ainda listados na seção B. Não repetir listas/formulários já cobertos sem mudança relevante.
2. **Aprovar semântica acessível de cores:** separar marca de texto interativo e texto de status; construir matriz de foreground/background, inclusive pressed/focus/disabled. Preservar identidade verde/mint/navy.
3. **Contratos de controles:** alturas de toque, tipografia e estados compartilhados para buscas, campos e ações de formulário. Migrar famílias progressivamente, sem redesenhar telas já aprovadas.
4. **Responsividade e safe areas:** testar 320–384 dp, fonte 1,0/1,3/2,0, teclado de letras/símbolos/flutuante, orientação e navegação por gestos. Verificar final de listas, formulário extenso e foco em últimos campos.
5. **Conteúdo e continuidade:** investigar VIS-019 e acesso a cards longos; revisar variante de header da IA; tratar Loja/FABs e estados vazios em comparação lado a lado. Preservar a expansão já observada no resumo e em Fornecedores.
6. **Dívida de sistema:** reduzir sobrescritas, documentar variantes de empty states e política de movimento. Só depois discutir ornamentação e densidade estética.
7. **Reauditar:** screenshots comparáveis, contraste recalculado e relatório de regressões. Nenhum item deve ser considerado resolvido apenas por mover um valor para token.

### Observações positivas e diferenças intencionais

- Chat: cards de texto e registro já compartilham SurfaceStyles.message; respostas mantêm hierarchy interna apropriada a seus dados.
- Painel `/`: largura total e continuidade com composer observadas; lista limitada e rolável. Uma opção parcialmente visível é consequência do viewport, não evidência de perda de comandos.
- Nova tarefa e editor de senha: nas capturas com teclado, campos e ações permaneceram visíveis; não foi reproduzido input desaparecendo.
- Navegação principal: identidade consistente, abas legíveis e superfícies inferiores suaves; barra nativa escura sobre fundo claro. A restrição de contraste dos labels verdes continua em VIS-002.
- Badges de registro versus botões; card/list/message/overlay; abas versus páginas de detalhe têm diferenças de função. Não se recomenda equalizar sombras, ícones ou títulos de todos eles.
- Alertas e relatórios contam com reuso existente. Arquivos antigos de onboarding detectados não foram assumidos como interface ativa sem referência de uso.

**Conclusão:** auditoria exclusivamente diagnóstica consolidada, com os 18 achados originais preservados e VIS-019 acrescentado. Nenhuma correção de produto ou mudança permanente de conta/dados foi implementada; as configurações temporárias do Android foram restauradas. As lacunas restantes estão discriminadas na seção B, sem apresentar inspeção estática ou tentativa inválida como teste visual concluído.
