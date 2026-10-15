# Refatoração visual interna — primeira etapa

## Migração exclusiva da paleta interna — estado vigente

- Reutilizado o off-white frio #F8FCFA do tema original em Colors.appBackground; chatBackground referencia a mesma base. Colors.bg e mintBackground mantêm #F3FFF9 para a experiência externa e superfícies secundárias.
- Aplicado appBackground às cinco abas, headers estruturais de Tarefas/Financeiro, filtros que continuam a página, conta/perfil/preferências/configuração de IA pelo shell AccountScreen, páginas de módulos e fundo da navegação interna. BottomFade agora usa a mesma base neutra, inclusive sua cor transparente.
- Usos restantes de Colors.bg em abas, módulos e formulário de conta foram classificados como superfícies secundárias e renomeados para mintBackground, preservando seu valor. Cards sugeridos de Apps continuam accentLight (#E6F7F1); ícones/chips mint, cards brancos, bordas, estados ativos/disabled e textos foram auditados sem necessidade de novas cores.
- Colors.bottomSurface, curva, sombras, branco das superfícies, navy, verde, vermelho, dimensões, espaçamentos, radius e handlers preservados. Welcome, autenticação, onboarding e relatórios não migraram para off-white nesta tarefa interna.
- Conferência nas cinco abas do Android físico: tmp/palette-neutral-chat.png, tmp/palette-neutral-tasks.png, tmp/palette-neutral-calendar.png, tmp/palette-neutral-finance.png e tmp/palette-neutral-apps.png. A conta apresentou estados vazios de Tarefas e Apps nesta revisão, portanto cards preenchidos nessas abas foram auditados pelo código, não pela captura. Calendário e resumo financeiro brancos observados. TypeScript passou.

## Superfície inferior compartilhada — revisão atual

- BottomSurface concentra preenchimento sólido e a curva baixa existente; Colors.bottomSurface (#E6F7F1) é usado no composer, navegação, container intermediário e área segura inferior. Removido o gradiente da navegação.
- A costura clara persistiu após igualar os preenchimentos; desapareceu ao alinhar também o fundo do KeyboardAvoidingView e sceneStyle. Não foi adicionada linha ou máscara para encobrir a junção.
- No Chat, BottomSurface envolve o composer na mesma posição e com o mesmo padding; nas demais abas, fornece apenas o background da tab bar com a curva acima. Sem altura extra de composer, mudanças de rotas ou handlers. Decoração usa pointerEvents none e overflow visible.
- Conferidas no Samsung conectado as cinco abas e retorno ao Chat, junção contínua, curva e distância dos FABs. Capturas: tmp/bottom-shared-chat.png, tmp/bottom-shared-tasks.png, tmp/bottom-shared-calendar.png, tmp/bottom-shared-finance.png, tmp/bottom-shared-apps.png.
- Validação de teclado virtual pendente: campo recebeu foco, mas o sistema reportou mInputShown=false e não abriu o teclado nesta sessão. KeyboardAvoidingView e tabBarHideOnKeyboard preservados. Nenhuma mensagem enviada. TypeScript e git diff --check passaram.

## Correção de paleta mint — estado atual

- Substituído o fundo quente da revisão anterior pelo mint #F3FFF9 já usado no onboarding (Colors.chatBackground).
- Superfície inferior e preenchimento da curva usam Colors.accentLight (#E6F7F1); navegação começa no mesmo token e suaviza até Colors.mintBackground. Nenhum novo hexadecimal mint foi criado.
- Sombras ContentShadows, bordas neutras, branco das superfícies, navy do usuário, espaçamento, radius, geometria da curva, composer, header e handlers mantidos integralmente. As descrições anteriores de fundo #F3F2EF são histórico, não a paleta vigente.
- Conferido no Android físico: balão branco continua perceptivelmente elevado sobre mint, com superfície inferior mais presente e transição orgânica preservada. Captura atual: tmp/chat-mint-palette.png. TypeScript passou.

## Hierarquia de superfícies do Chat — revisão validada

- A planicidade vinha do fundo quase branco (#FAF9F7), superfícies brancas sem bordas e sombras com pouca diferença entre mensagem e objeto. Não foi encontrado clipping nos wrappers botRow, botContent ou cardsContainer; overflow hidden está restrito ao avatar. A lista recorta naturalmente nas bordas do viewport, mas possui padding lateral/vertical e espaçamento para as sombras.
- Colors.chatBackground passa a #F3F2EF. Colors.bubbleBot e Colors.bgCard continuam brancos. chatSurfaceBorder (#E6E5E2) e chatCardBorder (#DCDDD9) definem bordas neutras de 1 ponto.
- ContentShadows continua sendo a fonte única: mensagem com deslocamento inferior de 4 pontos e card de 7 pontos, duas camadas e spread negativo para limitar a dispersão lateral. Mantido boxShadow da New Architecture, compatível com RN 0.81 / SDK 54; Android outset requer Android 9+. No Android físico conectado (Samsung SM-A366E, API 36), a sombra foi efetivamente observada. Não foi somada elevation à mesma sombra para evitar duplicação.
- Espaço entre superfície e ações passou de 4 para 12; entre cards de 4 para 8. Radius, avatars, ações, mensagens do usuário, header, composer, curva mint, navegação, teclado e handlers preservados.
- Teste visual com fixture temporária de oito mensagens: texto longo/curto, usuário, quatro quick actions, tarefa com chips, evento e scroll. Fixture removida do código, sem executar handlers ou persistir registros. Evidências: tmp/chat-surfaces-loaded.png, tmp/chat-surfaces-bottom.png, tmp/chat-surfaces-top.png e tmp/chat-surfaces-scroll.png. A fixture apresentou caracteres acentuados como interrogações por encoding do shell; os textos reais foram restaurados integralmente a partir de backup UTF-8.
- Na recarga do Expo Go apareceu o aviso já conhecido de ExpoSpeechRecognition ausente; fechado para inspeção visual, sem alterar voz. TypeScript e git diff --check passaram no código final. Android 7/8 e iOS não foram validados nesta revisão.

## Fontes existentes

- `app/onboarding.tsx`: composer integrado, fundo `#F3FFF9`, texto navy `#202B38`, borda `#D9EEE5`, separador `#DCECE6`, envio verde e estado vazio mint. A camada visual foi extraída para `src/components/message-composer.tsx`, usado pelos dois fluxos. A condução das perguntas, voz e envio permanecem nos consumidores.
- `src/constants/theme.ts`: fonte Plus Jakarta Sans, escalas existentes de espaço/radius, verde `#00A878` e superfícies claras. Os valores extraídos do onboarding foram adicionados aqui, sem um segundo tema e sem mudar globalmente a cor de texto/botões antigos.
- `app/components/onboarding/lumio-speech-bubble.tsx`: superfícies brancas/mint com bordas verdes suaves. No Chat a expressão é reduzida a superfícies leves; nenhuma ilustração nova foi criada.
- `app/components/onboarding/report-detail.tsx`, `report-intro.tsx`, `report-processing.tsx` e `src/components/auth-screen.tsx`: hierarquia tipográfica, controles arredondados, foco verde e feedback de processamento. Não se transplanta a densidade de apresentação para a conversa.
- `app/components/account/AccountSheet.tsx`: menu de conta existente, mantido. O avatar compartilhado recebeu o navy já existente; dimensões, foto e ação não mudaram.

## Implementado

- Um único composer para onboarding e Chat: input multiline limitado a 68 pontos, microfone dentro da cápsula, separador, envio circular, estado vazio, foco, disabled e loading. Loading é uma capacidade do componente; o envio síncrono atual do Chat não ganha um estado de processamento artificial.
- Voz continua usando `VoiceInput` e os callbacks originais de cada tela. Microfone e envio têm área mínima de 44 pontos e labels acessíveis.
- Chat mantém SafeArea superior, logo e menu da conta. Balões usam navy/white, radius da escala existente, borda suave e sombra discreta. Mensagens consecutivas têm menos distância. Após revisão no aparelho, usa os mascotes existentes do onboarding em 40 pontos, com volume e brilho, em lugar dos assets planos antigos.
- Cards mantêm conteúdo, tipos, chips semânticos, parsing e dados, com acabamento de superfície mais leve e texto secundário mais legível.
- Navegação compartilhada mantém Chat/Tarefas/Calendário/Financeiro/Apps e seus destinos. Divisor fino, sem elevação; continua responsável pelo inset inferior. `tabBarHideOnKeyboard` remove a navegação durante digitação.
- Composer está no fluxo do layout, sem reserva fixa de altura ou fade com posição absoluta. A lista reage à mudança de layout para deixar a última mensagem acessível. iOS usa padding no KeyboardAvoidingView e altura de header fornecida pela navegação; Android mantém height com `softwareKeyboardLayoutMode: resize` já configurado. Não se soma altura de teclado manualmente. O layout ilustrado/absoluto do onboarding não foi transplantado para a lista do Chat.

## Auditoria das outras abas / próxima etapa

| Aba | Elementos existentes | Trabalho individual pendente |
| --- | --- | --- |
| Tarefas | Tema comum, avatar/menu de conta, formulário e seletores próprios | Harmonizar cards, filtros e agrupamentos; revisar os vários inputs/modais sem mudar edição e ordenação |
| Calendário | `FilterChips`, `EventListItem`, `EmptyState`, `FAB`, `BottomSheet`, `SkeletonLoader` | Moderar sombra do FAB; alinhar chips, contraste de empty state e células/itens; preservar calendário recolhível e gestos |
| Financeiro | Header recolhível, filtros, busca, cards financeiros, skeleton e empty state | Ajustar hierarquia dos valores, superfícies e controles de busca/filtro sem interferir nas animações do header |
| Apps | Cards de módulos, estados vazios, controles de organizar/remover | Alinhar superfícies e estado vazio; preservar ativação, remoção e reordenação |

Os headers têm conteúdos e comportamentos diferentes; não foram forçados para uma abstração nova. Empty states e filtros de calendário/financeiro são implementações distintas com regras próprias: esta etapa não os funde. Os modais existentes continuam no lugar.

## Validação

### Área de leitura neutra e mensagens comuns

Fundo principal do Chat e header agora usam `Colors.bg` (`#F8FCFA`), o off-white existente, sem o gradiente mint de tela inteira. Mensagens textuais do Lumio usam branco, radius 16, sem contorno e sem preenchimento em gradiente; apenas sombra neutra de 1 ponto/3 de blur a 5%. Tipografia, padding, mascotes e alinhamento mantidos. Mensagens do usuário continuam navy. Cards estruturados mantêm o componente e o acabamento anterior.

Composer, curva inferior, navegação, teclado e handlers não foram alterados nesta rodada. A curva mint existente faz a transição para o off-white.

Validação visual no aparelho com fixture temporária de dez mensagens: textos curtos e longos de ambos os remetentes, mensagens consecutivas, cards de tarefa/evento/financeiro e scroll até a última mensagem. A fixture apenas preenchia o estado local de apresentação; nenhum handler de criação foi executado e nada foi persistido. Removida após as capturas. Evidências: `tmp/chat-content-top.png` e `tmp/chat-content-bottom.png`. TypeScript passou no código final.

### Correção de teclado após reprodução no aparelho

O ajuste anterior por `height` no Android retinha uma altura incorreta quando a barra de abas voltava, cortando a parte inferior do composer. A validação inicial de um único ciclo não detectou essa regressão. Desabilitar completamente o KeyboardAvoidingView também foi testado e descartado: neste Expo Go a janela é sobreposta pelo teclado e o composer ficava escondido.

O Chat agora usa a estratégia do onboarding: `behavior="padding"`, habilitado no Android apenas enquanto o teclado está visível, com listeners de abertura/fechamento removidos no unmount. iOS mantém padding. Não se soma altura manual nem se fixa a altura da conversa. Esta correção substitui a descrição anterior de `height` no Android.

Conferidos no aparelho três ciclos consecutivos com composer vazio e um ciclo adicional com rascunho multiline: composer acima do teclado, retorno sem recorte e navegação restaurada. Texto de teste apagado sem envio. Evidências em `tmp/keyboard-bug.png`, `tmp/keyboard-fixed-open.png`, `tmp/keyboard-cycle-1.png` a `tmp/keyboard-cycle-3.png` e `tmp/keyboard-fixed-multiline.png`. TypeScript passou. iOS e builds Android fora deste Expo Go ainda não foram validados nesta rodada.

### Polimento da região inferior

Comparado com a implementação original do onboarding em `HEAD:app/onboarding.tsx`: input mínimo de 46, radius de cápsula, borda `#D9EEE5`, fundo branco, padding esquerdo 16/direito 5, separador de 20 com margens de 9, microfone visual de 32 e envio de 42. Essas proporções foram restauradas no composer compartilhado. A área de toque do microfone continua com 44; o envio usa hitSlop de 1 para atingir 44. O foco usa borda mint clara em vez do contorno verde principal. A sombra do input é delicada, sem o gradiente de balão dentro do campo.

A navegação mantém altura, insets, ícones e destinos. O fundo agora transita do mesmo mint do composer para off-white, sem linha superior. Não foi criado um container envolvendo composer e navegação. Apenas as bordas e sombras dos balões do Lumio foram suavizadas; header, mensagens, cards e lógica permanecem como na revisão anterior.

Polimento conferido no aparelho após recarga do Expo Go: estado normal em `tmp/chat-polish.png`, foco/teclado em `tmp/chat-polish-keyboard.png`; composer acima do teclado e navegação ocultada. Teclado fechado ao concluir. TypeScript e os 23 testes do onboarding passaram. Na recarga, o Expo Go exibiu aviso de módulo nativo de reconhecimento de voz ausente; o aviso foi fechado para a revisão visual, sem alteração na lógica de voz. A validação de voz continua dependendo de build nativo.

- `npm.cmd run typecheck`: passou.
- `npm.cmd run test:onboarding`: 23 testes passaram, incluindo perguntas, respostas, ciclos de teclado simulados, persistência e entrada no Chat. O harness agora percorre o componente extraído real.
- Revisão do diff: handlers do Chat, engines, Supabase e navegação de destino permanecem intactos.
- Revisão inicial sem aparelho: ADB não encontrou dispositivos. Na segunda revisão, o aparelho foi conectado e o Chat foi inspecionado por screenshots reais.
- No aparelho conectado: teclado aberto/fechado, navegação oculta/restaurada, input vazio, envio ativado por rascunho e multiline com altura limitada foram conferidos. O rascunho foi apagado sem envio; nenhum registro foi criado. Capturas em `tmp/chat-before-depth.png`, `tmp/chat-depth-keyboard.png`, `tmp/chat-depth-multiline.png` e `tmp/chat-depth-final.png`.
- Revisão após feedback de visual plano: o gradiente branco–mint do balão do onboarding foi extraído para `LumioSurfaceFill`, compartilhado com Chat, cards e composer. Sombras verdes, bordas mais definidas, fundo com variação suave e curva discreta junto ao composer recuperam profundidade sem acrescentar ilustração grande.
- Ainda pendentes: envio/voz real, muitos cards/histórico e aparelhos de outras alturas. A comparação visual usa a referência de onboarding fornecida, sem reiniciar o onboarding da conta.
- Em aparelho: verificar altura pequena/grande; texto curto/longo; muitas mensagens/cards; multiline até o limite; teclado abrindo/fechando; última mensagem; cinco abas; foto/menu da conta; reconhecimento de voz/permissões em build nativo. Comparar onboarding e Chat no mesmo aparelho antes de aprovar visualmente.

### Cards de registro sem moldura
- Cards do Chat (tarefa, evento, financeiro e demais registros) agora usam fundo branco sólido, sem borda, gradiente ou sombra externa, com Radius.lg.
- Conteúdo, chips, dados e comportamento preservados. TypeScript e git diff --check passaram.

### Profundidade neutra das superfícies
- Área de leitura: token chatBackground (#FAF9F7), off-white neutro; header e região inferior preservados.
- ContentShadows.message: sombra neutra baixa em duas camadas; ContentShadows.card: ligeiramente mais definida. Superfícies brancas sem outlines e sem glow verde.
- boxShadow segue o padrão existente e a New Architecture configurada; suportado em iOS e Android 9+ conforme React Native 0.81.
- Geometria dos balões/cards, ações, usuário, composer, navegação e lógica preservados.
- TypeScript e git diff --check passaram. Validação visual desta versão pendente: aparelho desconectou do ADB durante captura; tmp/chat-depth.png é uma captura antiga e não valida esta alteração.


## Segunda passada: sistema de superf?cies sobre off-white

A refer?ncia atual de superf?cies internas ? [SURFACE_DESIGN_SYSTEM.md](SURFACE_DESIGN_SYSTEM.md). Esta passagem substitui as receitas de superf?cie/sombra anteriores descritas acima. P?gina #F8FCFA preservada; controles neutros tonais; cards brancos com contorno suave e sombra compartilhada; filtros sem sombra; overlays e FABs com pap?is pr?prios. Mensagens do Lumio continuam sem borda. Regi?o inferior aprovada preservada.

Compara??o Android em `tmp/surface-comparison.html`, com Tarefas e Apps preenchidos por exemplos tempor?rios de apresenta??o, removidos sem persist?ncia. Typecheck aprovado e 23 testes de onboarding aprovados. Invent?rio final de propriedades em `tmp/surface-audit-after.tsv`; exce??es e limites da valida??o documentados no design system.


### Corre??o pontual posterior: branco nos controles

Campos e buscas agora reutilizam Colors.bgCard pelo token control existente, com a mesma borda e elevation de controles j? aprovadas. Pequenos controles antes tonais consomem SurfaceStyles.filter completo. Disabled, placeholders, ?cones e separadores preservados. Nenhuma receita de shadow/elevation, p?gina off-white ou regi?o inferior mint alterada. Cinco abas e formul?rio de tarefa conferidos no Android.
