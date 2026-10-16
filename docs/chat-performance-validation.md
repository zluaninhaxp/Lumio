# Performance do Chat — 15/10/2026

Escopo desta etapa: performance da lista e renderização. O layout de teclado, composer, abas, safe area e configuração nativa da etapa anterior foi mantido.

## Causas observadas

- O onLayout do viewport atualizava estado do Chat durante cada mudança de altura. Isso recriava os dados filtrados, o renderItem e elementos da lista mesmo quando o histórico não mudava.
- O auto-scroll cancelava e reiniciava duas requestAnimationFrame em cada novo layout. Durante a abertura, a lista podia aguardar o fim da sequência de resize para finalmente acompanhar o teclado, apesar de o composer já acompanhar a thread UI.
- A assinatura de todo o store, sem seletor, incluía atualizações não relacionadas à apresentação da conversa.
- Amostragem Hermes/CDP durante um envio real encontrou custo em renderização React, coleta de memória e persistência criptografada. Uma captura de aproximadamente seis segundos atribuiu cerca de 123 ms acumulados a encrypt e 93 ms a bytesToHex; são tempos amostrados acumulados, não a duração de uma única pausa. Serviços, criptografia, journal e regras de confirmação não foram alterados.

## Otimizações

- Lista Android baseada na mesma FlatList, agora animada, com acompanhamento de scroll na thread UI. O progresso existente do keyboard-controller dispara medição do viewport nativo real e scrollTo sincronizado na abertura. Não se calcula altura de teclado nem se adiciona padding.
- Conteúdo/viewport iguais não reenviam comandos. Crescimento de mensagens, cards e footer usa rolagem suave nativa, sem duração estimada. Movimento do teclado não inicia outra animação de scroll.
- No fechamento, mantém-se o clamp nativo da faixa de rolagem; há apenas reconciliação final. Gestos do usuário e expansão de cards interrompem acompanhamento. Momentum programático não é confundido com gesto de leitura. Envio próprio retoma acompanhamento.
- Mudanças do viewport com painel de comandos fechado atualizam apenas uma ref. O estado que limita o painel é atualizado quando ele está aberto.
- Histórico filtrado, conteúdo da lista, footer e renderItem estabilizados. Linhas memoizadas com estado de ações explícito. Store selecionado com comparação rasa. O caminho de scroll iOS anterior foi preservado.

## Dispositivo e evidências

Samsung SM-M315F, Android 12, teclado Samsung, três botões, Expo Go/Metro em modo de desenvolvimento. Foram usados ADB, dumpsys gfxinfo com reset entre ações, amostragem CPU Hermes e screenrecord. Frames do vídeo foram extraídos com FFmpeg temporário em tmp/, sem adicionar dependências ao app.

Na coleta inicial de abertura: 23 frames, mediana 40 ms, p95 48 ms. Na coleta posterior: 24 frames, mediana 24 ms, p95 29 ms, 2 frames classificados como janky. Outras coletas posteriores tiveram mediana de 20–26 ms. São amostras exploratórias com histórico crescente, não um benchmark controlado ou comprovação de 60 fps. A coleta de envio de três segundos ainda registrou 86/154 frames janky no processo Expo Go; não há base para declarar ausência total de engasgos. Coletas de fechamento também podem incluir chegada de resposta e não isolam a animação do teclado.

Validação visual: abertura, envio de texto, indicador de digitação, chegada de resposta com teclado aberto, fechamento e estado final; composer junto ao teclado e última resposta inteira. Leitura manual de histórico seguida de abertura/fechamento preservou o trecho lido. Um card financeiro visível foi conferido na primeira execução da lista otimizada. Não houve nova validação de todos os tipos de cards.

Artefatos locais ignorados pelo Git:

- tmp/chat-performance-verified.mp4: ciclo real no Chat; os vídeos preliminares não são usados como evidência.
- tmp/chat-opening-dense.png, tmp/chat-send-verified.png, tmp/chat-close-dense.png, tmp/chat-cycle-overview.png: frames inspecionados.
- tmp/chat-history-before.png, tmp/chat-history-open.png, tmp/chat-history-restored.png: leitura de histórico.
- tmp/perf-baseline-open.txt, tmp/perf-final-open.txt, tmp/perf-final-send.txt: métricas exploratórias.
- tmp/chat-send-cpu-active.json: perfil Hermes de diagnóstico.

## Testes e limites

TypeScript e 18 testes de Chat/layout/scroll/digitação passaram, incluindo cinco testes dos worklets reais de Android: abertura sem callbacks JS, deduplicação de conteúdo, rolagem suave/redução de movimento, preservação do fechamento, momentum programático e leitura do histórico. A suíte de persistência também passou. Testes antigos de callbacks exercitam o caminho legado iOS, não substituem os testes novos de Android.

Não foi produzido ou validado APK release nesta etapa. Permanece a limitação de build nativo registrada em chat-keyboard-validation.md. Gboard e outros aparelhos não foram testados. A melhoria observada em desenvolvimento não certifica equivalência perfeita de fluidez com o fechamento nem ausência de frames perdidos em produção.
