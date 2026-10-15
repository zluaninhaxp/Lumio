# Reconhecimento de voz — Android

## Investigação

Expo 54.0.36 / React Native 0.81.5; biblioteca instalada e mantida:
`expo-speech-recognition` 3.1.3 (package-lock e node_modules).
Foram consultados os tipos, o módulo Kotlin e o config plugin da versão instalada,
além da documentação https://docs.expo.dev/versions/v54.0.0/ e
https://github.com/jamsch/expo-speech-recognition/tree/v3.1.3.

O onboarding e o chat já usavam `VoiceInput`, mas toda a lógica estava no componente.
A chamada `requestPermissionsAsync()` era válida: no Android, o Kotlin usa o
PermissionsManager do Expo para solicitar RECORD_AUDIO. O problema está na configuração:
`expo-image-picker` com `microphonePermission: false` chama `withBlockedPermissions`.
A introspecção anterior reproduziu `android.permission.RECORD_AUDIO` com
`tools:node="remove"`. Isso impede a solicitação runtime de uma permissão declarada.
O APK original não está disponível para inspecionar seu Manifest binário.

O plugin de voz declara RECORD_AUDIO e a query `android.speech.RecognitionService`.
Não há diretórios nativos android/ios no projeto: EAS gera esses arquivos.
A introspecção após a correção confirma RECORD_AUDIO sem remoção e a query do serviço.
Não foi necessário trocar biblioteca ou modificar o EAS. O perfil preview usa
distribuição interna Android (APK); production gera o artefato de loja.

## Fluxo corrigido

`VoiceInput` → `useVoiceRecognition` → `VoiceRecognition` → módulo nativo.
O toque verifica a permissão atual; solicita apenas se necessário e possível;
após concessão, verifica disponibilidade e inicia no mesmo toque.
Negativa simples permite tentar de novo; bloqueio oferece Abrir configurações.
Voltar das configurações e tocar novamente consulta a permissão atual.

A sessão tem um único dono para o recognizer global, bloqueia toques durante
permissão/início/finalização e diferencia erros por código nativo. Listeners
são removidos ao encerrar; sair da tela cancela a sessão e ignora permissões tardias.
Resultados parciais e finais preenchem o input, sem envio automático, permitindo
edição e envio manual. O antigo `VoiceRecorder` grava arquivos, não realiza
reconhecimento; seu `AnswerInput` não é utilizado pelas telas atuais.

## Validação obrigatória no dispositivo

Gerar e instalar **novo APK** com a configuração corrigida. Hot reload/OTA não
altera Manifest. Expo Go não inclui este módulo; development build e APK precisam
conter a biblioteca. Não foi executado build remoto nem teste físico nesta alteração.

Executar em **onboarding e chat**:

1. Instalação limpa (ou dados/permissões zerados): abrir não solicita microfone;
   tocar solicita o diálogo Android; Permitir inicia sem segundo toque;
   falar em português preenche o campo; editar e enviar manualmente.
2. Permissão concedida: tocar inicia sem prompt; parar retorna texto ao campo.
3. Negar uma vez: feedback curto, app permanece utilizável; novo toque solicita
   novamente enquanto Android retornar canAskAgain=true.
4. Negar até bloquear: não repetir prompt; Abrir configurações leva às permissões
   do Lumio; habilitar microfone, voltar e tocar inicia reconhecimento.
5. Tocar rapidamente repetidas vezes: uma solicitação/sessão, sem recognizer ocupado.
6. Sair/trocar aba durante solicitação ou captura: nenhuma atualização na tela
   anterior; retornar permite uma nova tentativa.
7. Silêncio, timeout, serviço indisponível e falha de rede: feedback específico,
   sem atribuir todos os erros à permissão; permitir tentativa posterior.

Para inspecionar o artefato final com Android SDK:
`apkanalyzer manifest permissions caminho/do/app.apk` deve listar RECORD_AUDIO.
Essa checagem do APK e os testes acima continuam necessários para validação nativa.

## Verificações automatizadas

`npm run test:voice`: testes do controlador com módulo simulado e introspecção real
dos plugins (regressão da remoção de RECORD_AUDIO).
`npm run typecheck`, `npm run test:onboarding`, `npm run test:ai` e testes locais
do engine/store. Não há script/configuração de lint no projeto.
No ambiente restrito Windows, o runner Node padrão encontra spawn EPERM; a suíte
engine/store foi executada com `--experimental-test-isolation=none`.
