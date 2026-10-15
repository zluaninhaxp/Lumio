# Superfícies do Lumio — segunda passada

## Diagnóstico e referências

A base interna aprovada é `#F8FCFA`. Sobre ela, branco sem contorno perdeu definição. A auditoria encontrou buscas brancas, contornos mint, sombras diferentes para cards equivalentes e sombras verdes em FABs. O Calendário combinava contorno e profundidade; copiar sua sombra isoladamente não resolveria controles e campos.

Referências primárias consultadas:

- [Atlassian: elevation](https://atlassian.design/foundations/elevation/): atribuir superfície e profundidade pelo papel do componente; separar conteúdo elevado de overlays.
- [Atlassian: border](https://atlassian.design/foundations/border/): contornos como recurso de definição e hierarquia.
- [Material: color roles](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md): superfícies tonais neutras como parte da hierarquia, sem depender exclusivamente de sombra.
- [Apple: materials](https://developer.apple.com/design/human-interface-guidelines/materials): distinguir camadas conforme seu papel. Não foi introduzido vidro, blur ou transparência nos cards.
- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/): versão de referência do projeto, consultada antes da implementação.

A decisão para o Lumio é combinar contraste tonal nos controles e contorno discreto no conteúdo. A sombra complementa cards e camadas flutuantes; não é aplicada aos campos e filtros.

## Paleta existente preservada

| Papel | Token / cor |
| --- | --- |
| Página interna e header contínuo | `Colors.appBackground`, `#F8FCFA` |
| Conteúdo branco | `Colors.bgCard`, `#FFFFFF` |
| Navy / mensagem do usuário | `Colors.ink`, `#202B38` |
| Ação / seleção | `Colors.accent`, `#00A878` |
| Mint externo / onboarding | `Colors.mintBackground`, `#F3FFF9` |
| Região inferior / accents existentes | `Colors.bottomSurface`, `#E6F7F1` |
| Feedback | success, warning, danger e seus preenchimentos existentes |

`Colors.primary`, textos secundários, ícones e cores de categorias não foram redesenhados. O contorno antigo mint permanece apenas em elementos semânticos específicos e decoração externa; não define os novos campos ou cards.

## Papéis compartilhados

Implementação central: `src/constants/theme.ts`, com `SurfaceColors`, `SurfaceElevation` e `SurfaceStyles`. Os componentes acrescentam apenas sua geometria e estados semânticos.

| Papel | Superfície | Contorno | Profundidade |
| --- | --- | --- | --- |
| control | branco (`Colors.bgCard`) | `#C9D0D4`, 1 px | nenhuma |
| filter / ação secundária | branco | `#C9D0D4`, 1 px | nenhuma |
| Pequenos controles / badges neutros migrados | branco, papel filter | `#C9D0D4`, 1 px | nenhuma |
| card | branco | `#E1E5E8`, 1 px | suave, mesma receita em todas as telas |
| message | branco | nenhum, conforme decisão anterior | receita semântica própria compartilhada |
| overlay | branco | `#E1E5E8`, 1 px | acima de cards |
| floating | preenchimento semântico existente | preservado | sombra neutra compartilhada |
| backdrop | navy com 40% de opacidade | nenhum | escurecimento compartilhado |

Campos usam tonalidade neutra para continuarem reconhecíveis tanto sobre a página quanto dentro de cards brancos. Cards mantêm branco por serem áreas de leitura; a borda permite reconhecer seus limites sem depender da sombra. Filtros não ganham profundidade. Nenhuma nova superfície verde foi criada.

Estados de controles:

- Default: `SurfaceStyles.control`.
- Focus: `controlFocus`, apenas contorno de ação, consumido pelos estados de foco já existentes em auth e composer.
- Error: `controlError`, contorno de erro disponível no sistema. As validações existentes continuam exibindo seus próprios feedbacks; não foram adicionados handlers ou novas regras de validação.
- Disabled: `controlDisabled`, preenchimento `#ECEFF1` e contorno suave. Campos somente leitura e composer bloqueado consomem o estado. Botões de ação usam `actionDisabled`, preservando verde desabilitado e removendo a sombra.

O sistema define todos os estados, mas não acrescenta comportamento de foco/erro a campos que anteriormente não o expunham.

## Aplicação e exceções auditadas

- Tarefas: busca, cards, filtros, edição inline, subtarefas, tags, seletores, popovers, formulário e FAB.
- Chat: mensagem simples sem borda, cards estruturados com papel card, composer control, menu overlay e envio floating.
- Calendário: calendário e eventos card; filtros e seleções filter; formulários control; BottomSheet overlay.
- Financeiro: resumo e transações card; busca control; filtros filter; seleção overlay; snackbar floating.
- Apps: módulos card. Sugestões mint e botão de adicionar módulos mantêm sua intenção de marca.
- Módulos: cards, buscas, inputs, campos numéricos, chips, ações secundárias, seletores e FABs, incluindo Estoque, Catálogo, Clientes, Fornecedores, Equipe, Contratos, Entregas, Orçamentos, Vendas, Comissões e módulo genérico.
- Conta, perfil e configuração de IA: cartões e campos compartilhados. O campo de chave mantém sua máscara Android e herda o estilo do formulário.
- Relatórios: introdução, conteúdo, confirmação, processamento, erro e respostas usam card/overlay. Os formulários CRUD herdam `taskFormStyles`/`pluginFormStyles`; seus wrappers transparentes não devem criar uma segunda superfície dentro do BottomSheet.

Exceções locais necessárias:

- Background de página, containers transparentes e resets de borda têm papel estrutural.
- Tags coloridas, prioridade, atraso, totais financeiros, feedbacks e estados ativos conservam cores semânticas; não são cards neutros.
- Checkboxes e controles tracejados conservam dimensões/borderStyle, mas seus contornos default usam o token neutro dos filtros.
- Separadores, barras de progresso, handles e skeletons possuem função própria; não são outlines de campo. Rows de skeleton de conteúdo usam card.
- Avatar, icon tiles e ilustrações não recebem sombra de card.
- A máscara da chave API zera borda/background na camada de texto para evitar uma segunda moldura.
- Welcome, celebration, botões ilustrativos do onboarding e balões ilustrados externos conservam seus estilos locais. Não pertencem à hierarquia de cards internos.
- `BottomFade.elevation` é ordem de desenho. Os resets da tab bar preservam a região inferior aprovada e não representam uma elevação de conteúdo.
- Mensagem do usuário mantém navy; a sombra vem de `userMessage`. Mensagem do Lumio consome `message`, sem borda.

Foi repetida a busca por `backgroundColor`, `borderColor`, `borderWidth`, `boxShadow`, `shadowColor`, `shadowOpacity`, `shadowRadius`, `shadowOffset` e `elevation`. Não restam receitas locais de sombra nos cards, campos, overlays ou FABs internos migrados. Tokens antigos exclusivos do Chat e a receita antiga de card foram removidos para evitar duas fontes concorrentes.

## Android e verificação

Expo 54 / RN 0.81 / New Architecture: `boxShadow` outset funciona no Android 9+. A implementação usa elevation moderada como fallback em Android anterior a API 28, sem somar os dois mecanismos. O fallback não foi testado em dispositivo antigo.

Comparação visual realizada no Samsung SM-A366E, Android API 36: Chat, Tarefas com três cards, Calendário, Financeiro e Apps com dois módulos; também formulário de tarefa aberto, sem salvar. Exemplos foram exclusivamente temporários na apresentação, removidos ao fim, sem alterar store, Supabase ou dados do usuário. Calendário/Financeiro foram conferidos com estado vazio; a equivalência dos itens preenchidos foi auditada pelo consumo dos mesmos tokens.

Capturas e comparação: `tmp/surface-comparison.html`. A passagem visual não cobre cada estado de cada módulo, nem teclado virtual: o aparelho não o abriu durante as verificações anteriores. Nenhum handler de teclado, navegação, animação ou negócio foi alterado nesta passagem.

Validação técnica: `npm.cmd run typecheck` aprovado; `npm.cmd run test:onboarding` com 23 testes aprovados. O harness de onboarding passou a carregar o tema real com React Native simulado, em vez de um mock incompleto sem os novos tokens.


## Corre??o pontual: superf?cies brancas

`SurfaceColors.control` referencia `Colors.bgCard`. O papel control conserva borda e elevation aprovados, passando a ter exatamente o mesmo acabamento do papel filter branco. Nenhuma receita de sombra ou eleva??o foi alterada. Pequenos controles de Tarefas, atribui??o no Chat e bot?es de fechar dos seletores/relat?rio deixaram de consumir o preenchimento isolado tonal e passaram a consumir `SurfaceStyles.filter` completo. O token tonal n?o possui mais consumidores nas telas.

Auditoria de backgrounds: os ?nicos cinzas funcionais restantes s?o estados desabilitados, skeletons, ?cones e separadores. As cinco abas e o formul?rio de tarefa foram conferidos no Android; as telas secund?rias foram auditadas pelos tokens compartilhados. Nesta corre??o Tarefas/Financeiro foram conferidos sem dados, sem criar fixtures. Capturas em `tmp/white-surface-*.png`.
