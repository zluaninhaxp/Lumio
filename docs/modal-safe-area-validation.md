# Safe Area dos BottomSheets

## Causa e escopo

A navegação principal já usa SafeAreaProvider + useSafeAreaInsets e reserva
`itemHeight + bottom`. Ela não foi alterada.
O BottomSheet compartilhado tinha apenas `paddingBottom: Spacing.xxxl`, não
consultava insets e não limitava todos os formulários à altura disponível.
`height={620}`, por exemplo, era distância da animação, não altura do conteúdo.
Essa semântica foi preservada.

O componente corrigido é `app/components/Calendar/BottomSheet.tsx`, usado por
financeiro, calendário, tarefas, conta, plugins e edição do relatório. Nenhum
consumidor precisa passar insets ou adicionar padding.

Documentação consultada para o SDK instalado:
https://docs.expo.dev/versions/v54.0.0/sdk/safe-area-context/
A documentação recomenda considerar um provider na raiz de janelas modais.
O código instalado de react-native-safe-area-context 5.6.2 calcula a parte da
janela que realmente sobrepõe as barras; o Modal Android do RN 0.81.5 já usa
SOFT_INPUT_ADJUST_RESIZE.

## Implementação

- Provider local na janela nativa do Modal, fora da animação e do scroll.
  Isso evita reutilizar insets de uma tela cuja área já foi reduzida pelas barras.
- Rodapé: espaçamento existente do tema + bottom inset local, aplicado uma vez.
  Não há SafeAreaView inferior adicional nem padding nas telas consumidoras.
- Topo e laterais respeitam os insets locais. Altura máxima é limitada pelo
  viewport medido após ajuste do teclado, descontando a região superior segura.
- Formulários sem sheetHeight continuam intrínsecos. O parâmetro height continua
  sendo apenas distância inicial de animação; fechar usa a altura real medida.
- Conteúdo natural ganha um viewport de scroll com flexGrow=0. O scroll só é
  habilitado se a altura do conteúdo exceder a área disponível; modais pequenos
  não são expandidos. Scrolls já presentes em formulários permanecem intactos.
- Consumidores que já fornecem maxHeight/sheetHeight (vendas, orçamentos e editor
  do relatório) mantêm sua própria estrutura de scroll/footer, sem wrapper de
  scroll adicional. Alturas explícitas calculadas recebem o inset, respeitando
  o teto do consumidor e o viewport real.
- Android mantém ajuste nativo de teclado. iOS usa KeyboardAvoidingView padding
  no viewport completo, para que o limite e o scroll acompanhem a área disponível.
  Não há keyboardVerticalOffset arbitrário nem subtração extra de altura do teclado.
  Teclado encaixado substitui o inset inferior; teclado flutuante preserva o inset.
- Backdrop, fechamento por gesto, botão Voltar e close() imperativo mantêm as
  regras existentes de dismissible. Os wrappers do viewport usam box-none para
  deixar o backdrop receber toques fora do conteúdo.

## Exceções existentes

O app também tem Modals independentes: seletores de pessoas, pedido, data e
produto (CatalogItemSelector), pickers de tarefas e confirmações do onboarding.
Eles não utilizam BottomSheet e não recebem automaticamente esta alteração.
Foram preservados, sem aplicar patches de Safe Area em cada tela nem mudar sua
estrutura visual. O seletor de produto, por exemplo, possui uma folha inferior
própria: sua eventual migração para a base precisa preservar o comportamento e
layout específicos. Não se deve afirmar que todo Modal nativo do app foi corrigido.

## Verificações e teste físico

`npm run test:bottom-sheet` verifica inset zero/gestos/3 botões/iOS, altura
intrínseca, limitação por viewport, dimensões percentuais/rotação, alturas
calculadas, teclado encaixado/flutuante e ausência de compensação duplicada.
Executar também typecheck e testes de onboarding/arquitetura de IA.
Não há lint configurado no projeto.

A alteração é JavaScript/TypeScript: não muda plugin, Manifest ou dependência
nativa. Esta correção de modal por si só não exige regenerar o projeto nativo.
O APK de validação deve incluir o código atualizado. A correção anterior de voz
continua exigindo novo build por alterar a configuração nativa.

Não foi executada validação visual em dispositivo/emulador nesta tarefa.
Validar no Android com **3 botões** e **gestos**, e no iOS com Home Indicator:

1. Modal pequeno (conta): altura natural, sem scroll ou vazio excessivo.
2. Modal médio (financeiro): Cancelar/Adicionar inteiramente visíveis e clicáveis;
   salvar/cancelar mantém o funcionamento.
3. Modal grande (tarefas/atendimento/catálogo): conteúdo e ações alcançáveis pelo
   scroll; não ultrapassa a barra superior nem a navegação inferior.
4. Vendas/orçamentos: footer existente permanece acessível, scroll do corpo
   funciona, altura calculada continua proporcional ao conteúdo.
5. Editor do relatório: cabeçalho e scroll existentes permanecem funcionais.
6. Inputs: abrir/fechar teclado várias vezes e alternar campos superiores e
   inferiores; nenhum acúmulo de inset, ações alcançáveis e taps funcionais.
7. Rotação e dispositivos pequenos: teto acompanha viewport atual.
8. Backdrop, arrastar handle e botão Voltar: fechamento normal; dismissible=false
   continua impedindo fechamento externo durante salvamento.
9. iPad com teclado flutuante: Home Indicator mantém espaço seguro.
