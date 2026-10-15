# Teclado nos modais

O `BottomSheet` ajusta o espaço disponível no Android e no iOS com
`react-native-keyboard-controller` 1.18.5 (versão do Expo SDK 54).
O provider fica dentro da janela nativa do modal, sem substituir a animação,
as superfícies ou os espaçamentos existentes.

`ModalScrollView` mede o campo focado e a área realmente visível do formulário.
Ao abrir o teclado, trocar de campo ou mudar a altura do conteúdo, rola apenas
o necessário. Também respeita rodapés fixos acima do teclado, sem acrescentar
um espaço vazio da altura do teclado ao formulário.

Formulários naturais usam a rolagem do `BottomSheet`. Formulários com rolagem
própria usam `ModalScrollView` e `contentOwnsScroll` (ou os limites de altura
existentes). Tarefas, contratos e entregas não aninham mais rolagens verticais.
Os seletores de pessoas, pedidos e produtos, e o gerenciador de tags, usam
`ModalKeyboardViewport` por terem janelas próprias.

## Validação

- Android físico Samsung A36, Expo Go: senha com foco no último campo;
  cliente com observações multilinha; catálogo com foco em unidade;
  venda com preço numérico, troca para texto e retorno ao preço;
  busca de pessoas em um modal sobre outro; compromisso com horário,
  rolagem até as ações; descrição de tarefa.
- Capturas em `keyboard-visual/`. Nenhum formulário foi salvo na validação.
- TypeScript e 47 testes de foco, layout do bottom sheet, alertas, onboarding
  e barras do sistema passaram. A auditoria verifica os modais com campos
  diretos e impede rolagens verticais comuns dentro de `BottomSheet`.
- iOS recebeu o mesmo ajuste compartilhado; não houve validação em aparelho iOS.

A dependência está incluída no Expo Go do SDK 54. Development builds e o app
nativo instalado precisam de uma nova compilação para incorporar o módulo;
uma atualização apenas de JavaScript não incorpora dependências nativas.
