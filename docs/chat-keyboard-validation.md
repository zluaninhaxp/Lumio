# Chat Android: layout e teclado

Validação em 15/10/2026, Samsung SM-M315F, Android 12, 1080 × 2340, teclado Samsung, via ADB e Expo Go com Metro local.

## Diagnóstico e estratégia

O projeto gera `windowSoftInputMode="adjustResize"` e edge-to-edge. O Chat ativava um KeyboardAvoidingView do React Native com padding apenas depois de keyboardDidShow, enquanto o navegador ocultava/restaurava as abas em outra animação. O resultado era compensação concorrente e mudanças sequenciais do viewport. Listeners de teclado, medidas do composer e eventos reais da lista ainda disparavam scroll pelo mesmo motivo.

Apenas retirar o KAV Android corrigiu o espaço mint no estado aberto, mas capturas intermediárias ainda mostraram o composer recortado na restauração das abas. A solução final usa o keyboard-controller 1.18.5 existente: um provider envolvendo cena e abas, um único viewport animado e altura das abas derivada do mesmo progresso nativo na thread UI. A altura de repouso vem do navegador e inclui o inset real; com teclado aberto a reserva das abas é zero. Não há duração estimada, altura manual de teclado ou padding compensatório novo.

O controlador é habilitado somente na rota /chat do Android. O KAV interno permanece habilitado apenas no iOS. As outras abas continuam com o comportamento do navegador e o provider desabilitado. app.json e plugins nativos não foram alterados.

Os listeners restantes do Chat controlam somente o menu de comandos. A lista reage a onLayout e onContentSizeChange. Foram preservados o limite de scroll nativo (inclui toda a extensão real do conteúdo), a interrupção ao ler histórico e a folga medida da borda orgânica já existente. As medidas de viewport/composer restantes limitam o painel de comandos, não posicionam o teclado.

## Exercitado no aparelho

- Abertura e fechamento do teclado Samsung; comparação de capturas intermediárias e estados finais antes/depois da refatoração.
- Composer imediatamente acima do teclado, sem a faixa mint excessiva.
- Texto longo com crescimento do composer; envio, indicador de digitação e recebimento de resposta, chegando ao final real.
- Card de tarefa e sugestões inteiros acima do composer quando acompanhando o final; rolagem manual para histórico sem retorno forçado ao fundo ao abrir/fechar teclado.
- Navegação por gestos e por três botões; configuração original de três botões restaurada.
- Troca Chat/Tarefas e busca de Tarefas com teclado aberto, verificadas visualmente.

Capturas locais em tmp/ (ignoradas pelo Git): lumio-sync-settled.png, lumio-sync-close.png, lumio-gestures-open.png, lumio-gestures-close.png, lumio-response-final.png, lumio-rest-final.png e lumio-tasks-keyboard.png. A inspeção de frames não equivale a uma medição contínua de frame rate.

## Verificações e limites

TypeScript, testes de layout/scroll do Chat, digitação, barras de sistema e bottom sheets executados. O teste de abas exercita o componente real para diferentes alturas/insets e progressos de abertura/fechamento, incluindo ausência de reserva com IME aberto e comportamento das outras abas.

Tentativa real de `gradlew assembleRelease` após prebuild local, com JDK do Android Studio e SDK Android instalado. O bundle JavaScript release foi gerado, mas o APK não: falharam as tarefas CMake arm64-v8a de react-native-screens e expo-modules-core com símbolos C++ std::__ndk1 ausentes. Gradle também reportou Metaspace esgotado. A configuração gerada não foi incluída nas alterações versionadas. Não foi possível instalar nem validar APK release.

Gboard não instalado no aparelho. Não foram validados outros aparelhos/tamanhos físicos, iOS, nem todos os formulários das outras abas. Expo Go apresentou também o aviso de ExpoSpeechRecognition indisponível, esperado para o módulo nativo de voz existente; a voz não foi alterada nem validada.

Referência consultada antes de editar: https://docs.expo.dev/versions/v54.0.0/ e https://docs.expo.dev/versions/v54.0.0/sdk/keyboard-controller/ .
