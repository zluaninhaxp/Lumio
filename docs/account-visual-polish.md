# Polimento visual de perfil e conta

Passada exclusivamente visual, validada em um Android físico conectado (1080 × 2340). O app foi aberto e as quatro telas foram navegadas e capturadas antes das mudanças, após a primeira rodada e após a segunda rodada. As capturas abaixo são screenshots reais do aparelho.

| Tela | Antes | Depois |
| --- | --- | --- |
| Bottom sheet | [Captura](account-visual/sheet-before.png) | [Captura](account-visual/sheet-after.png) |
| Meu perfil | [Captura](account-visual/profile-before.png) | [Captura](account-visual/profile-after.png) |
| Configurações | [Captura](account-visual/settings-before.png) | [Captura](account-visual/settings-after.png) |
| Recursos e integrações | [Captura](account-visual/resources-before.png) | [Captura](account-visual/resources-after.png) |

## Ajustes inspecionados no Android

- Sheet: três atalhos em uma única surface branca, separados por hairlines; ícones com tratamento tonal, rows compactas, avatar proporcional e logout no mesmo eixo dos atalhos. Handle, radius do overlay e safe area continuam no BottomSheet compartilhado.
- Perfil: avatar, nome, e-mail e badge compõem um hero mais compacto. ReportBackdrop foi reutilizado com baixa opacidade e enquadramento adaptado, mantendo o off-white dominante. As formas permanecem atrás do hero e deixam espaço livre ao terminar.
- Dados: labels menores e secundárias, valores em ink e divisores alinhados ao texto. Pessoa e negócio permanecem em duas surfaces agrupadas.
- Seções: eixos consistentes para ícones, títulos e ação Editar. Na segunda rodada, as cápsulas Editar foram reduzidas visualmente, preservando a área de toque de 44 pontos.
- Configurações e Recursos: menor distância entre header e conteúdo, mesma hierarquia de seções e mesmos insets de ícones/textos/chevrons.
- Header: apresentação visual opt-in no componente existente; as demais telas mantêm a apresentação anterior.
- Surfaces: branco, bordas e shadow/elevation dos tokens globais, sem sombras locais novas.

A primeira rodada foi revista no dispositivo. A segunda corrigiu o tamanho visual de Editar, a coluna do logout, a densidade das rows e o enquadramento do background. As quatro telas foram reabertas e inspecionadas novamente.

Nenhuma rota, handler, serviço, persistência, autenticação, edição, chave de IA, logout ou exclusão foi alterada nesta passada. O background compartilhado mantém seu viewBox e preserveAspectRatio originais como defaults para onboarding e relatório. Nenhum mascote, funcionalidade ou surface cinza foi introduzido.

## Verificações

Typecheck aprovado. 34 testes aprovados: onboarding (23), bottom sheet (6) e barras do sistema (5). Scroll até a última seção do perfil também inspecionado no aparelho. A inspeção visual cobre o Android conectado; iOS e outros aparelhos não foram inspecionados nesta passada.
