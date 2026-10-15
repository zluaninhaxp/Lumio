# Preparação do APK — Lumio

Data: 14/10/2026, America/Sao_Paulo. Branch `develop`; base de retomada `8a0d207`.

## Veredito

**Pode gerar APK de preview para validação. Ainda não distribuir a testadores.** Migration 0010 confirmada no remoto e handlers `ai` v8 / `delete-account` v2 implantados no projeto `foruzsalsyqmccutvhdu`; ambos mantêm `verify_jwt=true`. A build local não produziu APK (bloqueio do cache Gradle no Windows), então assinatura, Manifest final e comportamento release no aparelho seguem sem validação.

## Correções desta retomada

- Recibo de exclusão de A não encerra sessão nem limpa store de B. Erro de leitura/signout preserva recibo para retry; purge de sessão legada respeita o proprietário.
- Despesas ligadas a tarefa com `confirmed:false` e `supplierPaid:false` passam a realizado por tarefa, agenda e Financeiro; desfazer/refazer continua coerente.
- Exclusão de conta drena páginas de fotos, formatos legados e subpastas exclusivamente sob o UID confirmado antes de excluir Auth.
- Cadastro com confirmação obrigatória encaminha à tela existente de confirmação/reenvio, preservando o e-mail.
- Sete erros de tipos dos handlers foram corrigidos; `@ts-nocheck` foi removido de `ai`, `delete-account` e helper `secure`. O TypeScript Expo exclui o runtime Deno e cópias em `.cache`; `typecheck:edge` valida os handlers com Deno.

Os três novos testes de regressão falharam antes das correções e passaram depois. Usam implementações reais com IO simulado e dados sintéticos; não equivalem a testes remotos.

## Evidências desta execução

### Correção visual da abertura — 14/10/2026

**Estado atual, após pedido de splash única:** removidas a tela de logo React em `app/index.tsx`, sua espera fixa de dois segundos e a imagem repetida em `PersistenceFeedback`. O root retém a splash nativa com `preventAutoHideAsync` enquanto fontes/sessão carregam. Ela é liberada após o redirecionamento montar a tela de destino, ou quando há erro recuperável. Retry e mudanças de autenticação posteriores usam indicador comum de carregamento, sem outro logo. Falha de fonte permite renderizar com fallback.

Validação atual: TypeScript e três testes de inicialização aprovados (`node --test scripts/startup-splash.test.cjs`), cobrindo liberação após destino, erro/retry e rotas de login/onboarding/relatório/Chat. Sequência de 22 prints no Galaxy M31/Expo Go confirmou o carregador nativo seguido do Chat, sem as duas telas React com logo; evidência local `.cache/prelaunch/splash-single-11.png` e `splash-single-17.png`. O Expo Go usa seu ícone/carregador próprio; a arte nativa Lumio continua configurada no `app.json` e deve ser conferida no APK release.

A tela preta com logo foi reproduzida e corrigida no Galaxy M31/Expo Go. A causa era o carregamento de sessão em `src/components/persistence-feedback.tsx:25`, introduzido em `a8ab61d`, que usava `Colors.primary` (`#111111`). Esse loading foi alterado para `Colors.accent` (`#00A878`), igual à tela de abertura. Não era a splash nativa nem uma alteração de modo escuro. Ajustes experimentais de aparência/configuração foram retirados.

Após a correção, a sequência de 28 capturas mostra as duas etapas do Lumio verdes (frames 9–16), seguidas do Chat; o trecho preto com logo não voltou. Evidências locais: `.cache/prelaunch/splash-final-9.png` e `splash-final-16.png`. TypeScript aprovado. Expo Go ainda exibe seu carregador próprio, e o erro independente de módulo de voz segue sob trabalho do outro agente. Esta evidência não substitui a validação de abertura do APK release.

| Verificação | Resultado |
| --- | --- |
| TypeScript do app | `npm.cmd run typecheck` aprovado após separar runtimes. |
| Pré-lançamento | 25 testes aprovados, incluindo SQL PostgreSQL/PGlite, crypto, merge e regressões desta retomada. |
| Motores/store | 273 testes aprovados com isolamento de processo desativado. |
| Persistência | 17 serviços + 5 AuthContext + 1 suíte SQL aprovados. |
| IA simulada | 11 testes aprovados após os ajustes Deno; sem chamadas ao Gemini. |
| Fluxos e segurança local | Segurança legada/WebP, onboarding (24), voz, superfícies, sheets, foco, barras e alertas aprovados. Logs em `.cache/prelaunch/`. |
| Edge | Deno 2.9.6: `deno check` aprovado nos handlers finais `ai` e `delete-account`, incluindo dependências locais e helper; sem `@ts-nocheck` nesses módulos. Deploy remoto confirmado: ai v8 e delete-account v2, ambas ACTIVE e JWT habilitado. |
| Android/Hermes | Exportação aprovada; artefatos locais em `.cache/prelaunch/export`. Não é APK. |
| Prebuild isolado | Aprovado em `.cache/prelaunch/native`; nenhum diretório Android foi adicionado ao projeto principal. |
| Backup no projeto gerado | `allowBackup=false`, regras de cloud backup e device transfer excluem root/file/database/sharedpref/external. Manifest final depende de build/merge. |
| ADB | Samsung SM-M315F (Galaxy M31), Android 12, autorizado via USB. Expo Go presente; package `com.zluhcastro.lumio` ausente. |
| Compilação nativa | Java encontrado no JBR do Android Studio. Gradle 8.14.3 obtido; build falhou antes de compilar por `AccessDeniedException` ao mover workspace de cache Groovy para caminho imutável. Retry sem file watching/instrumentation e com caminho menor não resolveu. |
| Supabase remoto | `migration list --linked` confirma 0001–0010 alinhadas. `functions list` confirma ai v8 e delete-account v2 ACTIVE com JWT habilitado. |

O bloqueio Hermes inicial do sandbox foi resolvido executando o compilador local com permissão apropriada. O bloqueio atual do Gradle também ocorreu fora do sandbox; não foi diagnosticado como falha do app. Não houve rejeição da revisão automática de aprovação.

O projeto nativo isolado usa a assinatura debug padrão gerada pelo prebuild, mesmo no target release. Um eventual APK desse diretório serviria apenas à validação local; não é o preview assinado EAS aprovado para distribuição e não comprova atualização compatível com um certificado existente.

## Checklist e sequência restante

- [x] Revisar os três pontos deixados no documento de retomada e acrescentar regressões reproduzíveis.
- [x] Separar diagnóstico histórico e estado atual na auditoria principal.
- [x] Preparar SQL exato, diffs dos handlers/helper e redirects para revisão em [revisao.md](deploy-pre-lancamento/revisao.md).
- [x] Revalidar TypeScript, suítes afetadas, exportação Hermes e prebuild isolado.
- [x] Aplicar 0010 e implantar `ai`/`delete-account` com helper após aprovação; confirmar migrations e handlers ativos.
- [ ] Fazer leitura final de overloads/grants/RLS e bucket, sem imprimir secrets.
- [ ] Confirmar allowlist `lumio://auth-callback` e `lumio://auth-callback?intent=recovery`, SMTP e confirmação de e-mail; testar link no mesmo aparelho.
- [ ] Resolver o bloqueio de cache Gradle ou gerar preview assinado por fluxo de build aprovado. Build EAS não foi iniciado; pode consumir recursos do plano.
- [ ] Registrar APK/hash, package, versão/versionCode, certificado, `debuggable=false`, Manifest final e host Supabase incorporado.
- [ ] Instalar no Galaxy M31, abrir sem Metro e executar a matriz do relatório principal em contas descartáveis/ambiente isolado.
- [ ] Validar identidade A/B, exclusão retomável, perda de rede/resposta, restart com pendências, Chat rejeitado, vendas/comissões e datas/cobranças.
- [ ] Usar segundo aparelho para conflitos e confirmação entre sessões; o aparelho USB único não cobre esse requisito.
- [ ] Validar IA com chave nova e existente de forma aprovada, informar quotas/custos e confirmar processo operacional de retenção/suporte.

Até essas etapas, não marcar a distribuição como concluída. Migration 0010 e handlers foram implantados com aprovação; as mudanças locais foram preparadas para commit e push posterior pela usuária. Não houve instalação de APK, desinstalação nem limpeza dos dados do Android. As validações em aparelho descritas acima usaram o Expo Go.

Documentação usada: [Expo SecureStore SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/) e [Expo Router SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/router/). Mantidos Expo 54.0.36/RN 0.81.5; sem atualização de SDK.
