# Ícone do Lumio

Arte final: `assets/lumio-app-icon.png` (1254 × 1254, PNG opaco), mascote branco sem lettering, em fundo verde. Gerado com a ferramenta integrada `image_gen`, usando `assets/lumio-splash.png` como referência. Os resultados de extração transparente foram descartados por defeitos visuais.

`app.json` usa a arte no ícone principal e foreground adaptativo Android com fundo verde. Foram retiradas as referências aos ícones padrão do Expo, incluindo sua máscara monocromática. O ícone temático Android fica sem máscara personalizada nesta versão. O arquivo original da splash foi preservado.

Validação: configuração pública Expo resolvida e prebuild Android concluído em cópia isolada; recursos `ic_launcher`, foreground e round gerados. O novo ícone do launcher requer instalação do próximo APK; não substitui o ícone do próprio Expo Go.

Prompt da arte final (ferramenta integrada, sem CLI):

> Create a production app icon from the attached existing Lumio brand logo. Square 1024x1024 canvas, completely opaque perfectly flat solid background EXACT hex #00A878. Extract ONLY the upper mascot shape from the reference and remove ALL lettering (no Lumio text). Same exact distinctive white flame-shaped smiling mascot from the reference, curled tip pointing upper-right, asymmetric bottom-left speech-bubble tail. White outer silhouette, green face opening (same #00A878 as background), two solid white vertical pill eyes, two small white eyebrows and a white U-shaped smiling mouth. Edges smooth, clean, sharp, antialiased like a professional vector logo. Pure flat white and solid green ONLY. NO texture, NO grain, NO mottling, NO flecks, NO glow, NO shadows, NO gradient. Mascot must fit entirely within central 60 percent square of canvas, centered optically, with generous even 20 percent green padding on all sides. Fill the entire square with green, no rounded-square frame or border. Preserve brand identity of reference exactly, do not redesign mascot. The face opening must be solid uninterrupted green except the five white facial features. This is a tiny launcher icon: extremely clean flat graphic.

A saída real possui 1254 × 1254; o Expo gerou os tamanhos nativos a partir dessa imagem quadrada.
