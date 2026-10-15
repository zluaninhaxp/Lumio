# Refatoração de perfil e conta

A conta agora oferece três entradas no bottom sheet: Meu perfil, Configurações e Recursos e integrações. O sheet continua usando o BottomSheet existente, incluindo animação, gesto, backdrop, limites de altura, scroll e safe areas.

Meu perfil contém somente pessoa e negócio. InformationEditor foi extraído do editor do relatório: header, inputs, ações, feedback de erro, animação e tratamento de teclado são compartilhados. BusinessIdentityFields é utilizado tanto no relatório quanto no perfil. O relatório conserva sua validação e callback de persistência; o perfil conserva updateUser e a persistência existente de business state/structured profile.

Configurações contém senha e exclusão de conta. A exclusão exige senha, confirmação nativa e chamada ao mesmo serviço deleteAccount. Recursos contém somente o fluxo real da chave Gemini. Preferências legadas redirecionam para Configurações; account continua direcionando para Meu perfil. A chave salva retorna para Recursos, com confirmação.

Os componentes usam Colors, Typography, Spacing, Radius e SurfaceStyles atuais. Nenhuma funcionalidade de tema, idioma, notificações, importação ou integração externa foi adicionada. Nenhum mascote foi introduzido nessas telas.

## Verificações realizadas

- Typecheck aprovado.
- Suíte geral: 273 testes aprovados.
- Onboarding: 23; bottom sheet: 6; barras do sistema: 5; arquitetura de IA: 11 — todos aprovados.
- Sem lint configurado no package.json.
- Android conectado: abertura pelo avatar, identidade real, navegação nas três entradas e retorno.
- Perfil: abertura dos dois editores, teclado, scroll até os dados do negócio; salvamento pessoal e do negócio mantendo os valores atuais, com feedback de sucesso.
- Configurações: abertura do editor de senha e validação de senha atual obrigatória. A senha real não foi alterada.
- Exclusão: validação de senha obrigatória, entrada de texto de teste, abertura da confirmação final e cancelamento. Nenhuma exclusão real foi executada.
- Recursos: abertura do gerenciamento existente de chave Gemini. Nenhuma chave real foi substituída; teste/gravação/retorno da chave foram verificados pela suíte de onboarding e arquitetura de IA.
- Inspeção visual de surfaces brancas e safe areas no aparelho conectado.

Ainda não foram verificados visualmente iOS, outras dimensões de aparelho, fonte ampliada e upload de nova foto. O fluxo de foto existente foi preservado.

## Documentação consultada

- https://docs.expo.dev/versions/v54.0.0/
- https://docs.expo.dev/versions/v54.0.0/sdk/safe-area-context/
- https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/
