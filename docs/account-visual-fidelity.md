# Nova passada de fidelidade visual — 7 de outubro de 2026

Inspeção real no Samsung A36 (SM-A366E), 1080 × 2340, usando Expo Go e o Metro local via USB. As quatro telas foram abertas antes das alterações, após a primeira rodada e após a segunda. A primeira imagem do pedido orientou o diagnóstico; a segunda orientou a composição, preservando apenas o conteúdo funcional existente.

| Tela | Antes | Rodada 1 | Resultado |
| --- | --- | --- | --- |
| Sheet | [Captura](account-visual/pass2-sheet-before.png) | [Captura](account-visual/pass2-sheet-round1.png) | [Captura](account-visual/pass2-sheet-after.png) |
| Perfil | [Captura](account-visual/pass2-profile-before.png) | [Captura](account-visual/pass2-profile-round1.png) | [Captura](account-visual/pass2-profile-after.png) |
| Configurações | [Captura](account-visual/pass2-settings-before.png) | [Captura](account-visual/pass2-settings-round1.png) | [Captura](account-visual/pass2-settings-after.png) |
| Recursos | [Captura](account-visual/pass2-resources-before.png) | [Captura](account-visual/pass2-resources-round1.png) | [Captura](account-visual/pass2-resources-after.png) |

## Diagnóstico e mudanças

O workspace já continha mudanças locais: atalhos independentes, avatar maior, ajustes do BottomSheet e suavização do token global de card. Essas mudanças foram preservadas. As capturas de antes registram esse estado local renderizado, que já difere da primeira imagem enviada.

- Sheet: identidade em uma surface mint extremamente sutil (`accentSoft`), avatar de 64, nome e e-mail com hierarquia mais legível; atalhos brancos independentes com círculos de ícone de 44, separação de 8 e logout alinhado à coluna dos atalhos.
- Perfil: avatar de 104, câmera integrada, nome de 20 e e-mail de 15. Variante `profile` no ReportBackdrop existente, com duas curvas SVG perceptíveis e sobrepostas, usando cores existentes. A variante padrão do relatório e onboarding mantém a renderização anterior.
- Dados: títulos em ink e valores secundários, seguindo a referência; rows de leitura compactas, divisores alinhados ao texto e ícones consistentes. Não há chevrons em campos sem ação individual.
- Header: um único sistema compartilhado para as três telas, botão circular de 44, título de 17 e margem lateral de 16. Seções mais próximas e descrições de 13, com altura adaptável ao texto.
- Surfaces: novo papel global `list`, branco, borda global sutil e elevação baixa. Aplicado às listas de conta e ao botão voltar. Não alterei os valores de elevação de card que já estavam modificados no workspace.

Na segunda rodada, reduzi o padding vertical do header, o intervalo entre seções e a altura mínima dos atalhos; também equilibrei o tamanho do nome no hero. No aparelho inspecionado, o perfil inteiro cabe na área disponível e as curvas continuam sutis sobre o off-white.

Nenhum handler, serviço, dado, autenticação ou persistência foi alterado. Nenhum mascote ou recurso fictício foi adicionado.

## Validação

- `npm run typecheck`: aprovado.
- Bottom sheet: 6 testes aprovados.
- Barras do sistema: 5 testes aprovados.
- Onboarding: 23 testes aprovados.
- `git diff --check`: aprovado.
- Navegação real pelos três atalhos e retorno; abertura e fechamento do [editor de senha](account-visual/pass2-password-editor.png) sem salvar dados.

A validação visual cobre este Android via Expo Go. iOS, outros tamanhos de tela e operações de persistência não foram executados nesta passada visual.

## Refinamentos posteriores

O botão de voltar do onboarding foi extraído para `src/components/back-button.tsx` e compartilhado com os três headers de conta. Preserva a aparência original do onboarding. Typecheck e 23 testes de onboarding passaram.

Após revisão das bordas, confirmei que o relatório, calendário e financeiro utilizam `SurfaceStyles.card`, branco com borda cinza global. Para os agrupamentos de conta, `SurfaceStyles.list` agora mantém o branco e a elevação suave existente, sem borda externa. Divisores internos e controles de formulário permanecem separados dessa decisão. Os tokens de card, control e overlay não foram alterados por esse refinamento.

Capturas Android atualizadas: [perfil](account-visual/profile-borderless.png), [sheet](account-visual/sheet-borderless.png), [configurações](account-visual/settings-borderless.png) e [recursos](account-visual/resources-borderless.png). Typecheck aprovado.

Para recuperar o contraste no sheet branco, comparei os editores de informação, tarefas e eventos: seus controles usam `SurfaceStyles.control`/`filter`, com contorno. Os atalhos de conta usam agora outra composição: variante opt-in `surface="offWhite"` no BottomSheet compartilhado, com o background global do app atrás dos atalhos brancos sem contorno. Os outros sheets mantêm o branco padrão e as telas aprovadas permanecem iguais. [Captura inspecionada no Android](account-visual/sheet-contrast.png). Typecheck e 6 testes de bottom sheet aprovados.

O fundo fluido foi depois estendido à área inteira de `AccountScreen` e ao conteúdo do sheet de conta, reutilizando uma variante `account` do ReportBackdrop. O perfil deixa de sobrepor um fundo separado no hero. As curvas de topo foram suavizadas (opacidades de 0,45 e 0,22, antes 0,8 e 0,45), com camadas ainda mais leves no meio e na base. Cards, contraste do sheet e variante original do onboarding foram preservados. Capturas Android inspecionadas: [perfil](account-visual/profile-fluid.png), [configurações](account-visual/settings-fluid.png), [recursos](account-visual/resources-fluid.png), [sheet](account-visual/sheet-fluid.png). Typecheck e 29 testes existentes aprovados.
