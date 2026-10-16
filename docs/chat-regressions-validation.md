# Regressões do Chat — 15/10/2026

## Causas observadas no Android

Instrumentação temporária correlacionou teclado, onLayout, onContentSizeChange, comandos de scroll e estado do indicador. Os registros e vídeos foram capturados no Samsung SM-M315F, Android 12, teclado Samsung, navegação por três botões, Expo Go com Metro local.

Após a primeira transição de fechamento, a VirtualizedList expandia a região renderizada (por exemplo, primeiro índice 25 → 15 → 7), substituindo spacers. Sem alteração no histórico, o conteúdo oscilava aproximadamente 48 dp e voltava à altura anterior. O scroll tratava qualquer medida como mensagem nova: enviava animações para limites calculados a partir de alturas que já podiam estar obsoletas. O evento responsável pelo movimento tardio era onContentSizeChange, não um novo evento de teclado.

Separadamente, a confirmação já colocava a resposta visível no histórico enquanto sending e awaitingReply ainda estavam ativos durante o restante da persistência. Na reprodução, os flags só ficaram falsos aproximadamente 800 ms depois da resposta aparecer. Isso mantinha o footer sob a resposta e depois mudava novamente a extensão da lista.

## Correções

- Preservado o viewport, o composer, as abas, os estilos e a primeira transição de teclado.
- A lista usa a FlatList nativa com createAnimatedComponent para manter os worklets de scroll, dispensando o renderer de animação de layout por célula que Animated.FlatList instala.
- Ancoragem nativa das células visíveis durante revisões de spacers. Comandos de fim consultam a extensão real do ScrollView nativo na execução, em vez de enviar um offset baseado no callback antigo.
- Animação de crescimento somente para mudança de mensagem/footer ou medida real da última mensagem. Medições duplicadas dessa mensagem são deduplicadas; revisões de geometria não iniciam outra animação. Não foram usados timers, offsets novos ou bloqueios por duração.
- O indicador pertence a solicitações locais identificadas por requestId/responseId. A resposta confirmada visível elimina sua pendência no próprio render, mesmo com persistência ocupada. A remoção definitiva usa atualização funcional para preservar novos envios concorrentes. Sync e reidratação não criam solicitações de digitação.
- Enfileiramento, preparação dos comandos, journal, confirmação e retry da persistência foram mantidos.

## Validação efetiva

- Reproduções antes/depois com ADB, logs de eventos e screenrecord; quadros extraídos e inspecionados. A instrumentação foi removida da versão final.
- Três ciclos finais de abertura/fechamento, com três segundos de observação após cada fechamento. Não observado o segundo deslocamento nos quadros finais inspecionados.
- Três envios aceitos consecutivos com teclado aberto; input conferido vazio entre envios. Hierarquia UI: um indicador em cada captura pendente; zero após todas as respostas. Respostas e sugestões visíveis acima do composer.
- Reabertura do processo e retorno à aba Chat: as três mensagens/respostas foram restauradas, sem indicador reativado (chat-rehydrated-verified.png/xml). Na inicialização surgiu o aviso preexistente de ExpoSpeechRecognition ausente no Expo Go; a voz não foi alterada nesta tarefa.
- TypeScript, 24 testes de Chat/layout/scroll/digitação e suíte de persistência passaram. As regressões cobrem callbacks de altura obsoletos e duplicados, fronteira nativa, respostas em fila, eventos duplicados, sincronização e reidratação. Um teste de integração mantém o commit ocupado após o acknowledgement e verifica que o indicador já desapareceu.

Artefatos locais em tmp/ (ignorados pelo Git): regression-before-close.json/mp4, regression-before-send.json/mp4 e regression-virtual-metrics.json para diagnóstico; regression-fixed-typing.json comprova hasPendingReply falso com sending ainda verdadeiro; chat-native-cells-cycles.mp4 e chat-native-cells-cycles-frames.png para fechamentos finais; chat-native-cells-three-sends.mp4, chat-final-three-overview.png, chat-final-send-1.xml a chat-final-send-3.xml, chat-final-complete.xml/png para a fila final.

Esta etapa foi validada em Expo Go no aparelho real. APK release, Gboard, iOS e outros aparelhos não foram retestados. A inspeção de vídeo não constitui certificação de frame rate constante.
