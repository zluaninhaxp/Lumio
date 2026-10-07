# System bars — investigação e validação

## Evidências

O usuário confirmou que a aparência correta durante USB era no **Expo Go**,
não em um development build do Lumio. Expo Go é outro aplicativo Android,
com tema/janela/política de system bars próprios. O USB não muda o tema do APK.
Não existe override de debug/release das barras em eas.json; os perfis usam
o mesmo app config. Portanto, a comparação anterior era entre dois hosts nativos.

Foi consultado o Android conectado (Samsung SM-A366E): API 36 / Android 16,
navegação por 3 botões (`navigation_mode=0`). O Lumio instalado é versionCode 1,
versionName 1.0.0, targetSdk 36, sem flag DEBUGGABLE, atualizado em 02/10/2026.
O Expo Go instalado é 54.0.8, também targetSdk 36. Assim, targetSdk sozinho
não explica a diferença entre os hosts.
O APK atual foi aberto via ADB e a captura confirmou: fundo inferior branco,
faixa de navegação cinza e botões claros. Captura local:
`.cache/system-ui/before.png` (nenhum APK novo foi instalado nesta tarefa).

Antes da alteração, não havia expo-navigation-bar nem política explícita para
ícones/contrast enforcement da Navigation Bar. O SDK 54 ativa edge-to-edge por
padrão e o prebuild aplica enforceNavigationBarContrast=true por padrão.
O código exato instalado de RN WindowUtil.enableEdgeToEdge também ativa esse
contraste. O Android pode então compor a camada de contraste sobre o fundo da UI.
Isso é compatível com a faixa cinza observada; o fallback de ícones claros reforça
a quebra visual. Não foi extraído/decodificado o resources.arsc do APK antigo,
portanto suas entradas compiladas de tema não foram auditadas diretamente.

## Stack verificada

| Componente | Versão instalada |
| --- | --- |
| Expo | 54.0.36 |
| React Native | 0.81.5 |
| Expo Router | 6.0.24 |
| React Navigation Native | 7.3.13 |
| safe-area-context | 5.6.2 |
| expo-status-bar | 3.0.9 |
| expo-system-ui | 6.0.9 |
| expo-navigation-bar (adicionado) | 5.0.10 |

Foram lidos os plugins, tipos e fontes Android instalados, e a documentação:

- https://docs.expo.dev/versions/v54.0.0/sdk/navigation-bar/
- https://docs.expo.dev/versions/v54.0.0/sdk/status-bar/
- https://docs.expo.dev/versions/v54.0.0/sdk/system-ui/
- https://docs.expo.dev/versions/v54.0.0/config/app/
- https://developer.android.com/develop/ui/views/layout/edge-to-edge

## Correção

Edge-to-edge **já estava ativo** e foi preservado; não foi adicionado o campo
edgeToEdgeEnabled legado nem tentativas de desativá-lo no target 36.
`androidNavigationBar.enforceContrast=false` remove a camada automática de
contraste, junto com ícones explicitamente legíveis. Não se pinta a Navigation Bar
com uma cor branca global: seu fundo é o da UI existente, inclusive o mint da
bottom navigation atual do Lumio.

`SystemBars`, montado apenas no root layout, determina as superfícies superior
e inferior por rota usando os tokens atuais. A escolha light/dark compara o
contraste de preto/branco com a luminância da superfície. Nas telas atuais,
inclusive o splash verde, ícones escuros têm maior contraste. Se uma superfície
escura for configurada nessa política, a mesma função escolhe ícones claros.
As instâncias locais de StatusBar em index, welcome e auth foram removidas.

Para Navigation Bar, usa-se **setStyle**, API de edge-to-edge da versão 5.0.10:
`light` significa superfície clara com botões escuros; `dark` significa botões
claros. Não são usados setPositionAsync, setBackgroundColorAsync da NavigationBar
nem outras APIs de pintura incompatíveis com edge-to-edge.
`SystemUI.setBackgroundColorAsync` configura a superfície raiz de fallback,
não a cor da barra; screens e tab bar mantêm seus fundos existentes.
A política é reaplicada ao retornar ao app.

O plugin local `plugins/withAndroidSystemBars.cjs` aplica no AppTheme:

```
android:enforceNavigationBarContrast = false
android:enforceStatusBarContrast = false
android:windowLightNavigationBar = true
android:windowLightStatusBar = true
```

Também adapta a **MainActivity gerada**, sem editar React Native ou bibliotecas.
Motivo: RN 0.81.5 reativa contraste ao criar janelas de Modal; Expo restaura a
política do tema apenas na Activity. Ao mudar o foco da janela, a Activity percorre
os hosts de Modal abertos, herda contrast enforcement e estilo dos ícones da
Navigation Bar e acompanha mudanças de foco de diálogos aninhados.
Usa a propriedade pública dialog de ReactModalHostView na versão instalada;
sem reflection, sem polling e sem mudar fechamento/teclado/visibilidade.
O plugin é idempotente e exige revisão explícita ao atualizar RN ou encontrar
outro handler de foco em MainActivity. A parte nativa precisa ser compilada/testada
no próximo APK; prebuild não substitui compilação Kotlin ou teste de interação.

O BottomSheet compartilhado explicita barras translúcidas na sua janela.
Seu provider local e padding pelo inset continuam ativos, com altura natural,
scroll e tratamento de teclado da correção anterior. Conteúdo interativo permanece
fora das barras; backdrop/superfície da folha podem desenhar até as bordas.
Não foi alterada a bottom navigation interna do Lumio.

## Verificações executadas

Arquivos desta correção: `app.json`, `package.json`, `package-lock.json`,
`app/_layout.tsx`, `app/index.tsx`, `app/welcome.tsx`,
`src/components/auth-screen.tsx`, `app/components/Calendar/BottomSheet.tsx`,
`src/components/system-bars.tsx`, `src/utils/systemBarAppearance.ts`,
`plugins/withAndroidSystemBars.cjs`, `scripts/system-bars.test.cjs` e este relatório.
Foi corrigida também a versão instalada registrada em
`docs/modal-safe-area-validation.md`. Alterações anteriores de voz/Safe Area foram
preservadas.

- Typecheck.
- 5 testes de contraste, rotas, adaptação nativa/idempotência e tema gerado.
- 6 testes de Safe Area/teclado do BottomSheet.
- 7 testes de voz/configuração nativa, preservando RECORD_AUDIO.
- 23 testes de onboarding e 11 de arquitetura de IA.
- Prebuild Android **real**, offline, com template do Expo instalado, numa pasta
  isolada: `.cache/system-ui/native/android`. Conferidos styles.xml, MainActivity,
  gradle.properties, Manifest e cores gerados. Confirmados edgeToEdgeEnabled=true,
  tema com contraste desativado/ícones escuros e adjustResize no Manifest.
- Nenhum script/config de lint disponível.

Não foi compilado/instalado o APK corrigido. A validação visual executada no aparelho
é do problema no APK antigo. Não se deve apresentar os testes estáticos como prova
de que a faixa já desapareceu em release.

## Próximo APK — teste obrigatório

**Gerar novo APK**, incluindo novo módulo, plugin, tema e MainActivity. OTA/hot
reload não altera esses arquivos. Usar preview/internal ou outro perfil que gere
APK; production normalmente gera AAB. Não usar Expo Go para validar o tema nativo.

No mesmo aparelho, comparar APK novo e development build próprio, se disponível:

1. Início/splash, welcome/login/onboarding: topo e rodapé integrados, ícones legíveis.
2. Chat, financeiro e demais tabs: área nativa acompanha a superfície inferior
   atual (mint no código atual), sem camada cinza desconectada.
3. Tela sem tab bar (conta/plugins): fundo acompanha a tela.
4. Financeiro → adicionar: modal e Cancelar/Adicionar acima dos 3 botões;
   branco da folha contínuo até a área nativa, sem contraste automático cinza.
5. Seletores aninhados e fechar todos: estilos restaurados, sem regressão de foco.
6. Abrir/fechar teclado várias vezes: input e ações alcançáveis, sem inset duplicado;
   teclado pode aplicar sua própria aparência às barras enquanto ativo.
7. Android com 3 botões e com gestos; se possível API 29–35 além de API 36.
8. Voltar do segundo plano, mudar rotas e reabrir modais.
9. Sistema claro/escuro: Lumio continua no tema claro configurado, sem botões claros
   sobre fundo claro. iOS mantém contraste e Home Indicator/Safe Area.

## Limpeza autorizada do PC

Foram limpos cerca de 670 MiB de caches: npm global (~316 MiB) e cópias baixadas
do instalador Expo Go (~354 MiB), além do cache temporário criado nesta tarefa e
bundle web descartável dist (~14 MiB). Dependências instaladas, documentos,
Downloads, anexos do Codex, state.json, codesigning e credenciais foram preservados.
Caches podem ser baixados novamente. O bundle dist pode ser regenerado pelo Expo.
