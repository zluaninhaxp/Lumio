# Revisão concreta do deploy de pré-lançamento

Data: 14/10/2026. **Preparado para revisão; nenhuma operação remota autorizada ou executada por este documento.**

**Atualização após aprovação:** projeto confirmado pelo host do app e vínculo local: `foruzsalsyqmccutvhdu`. A usuária executou `db push`; CLI confirma 0001–0010 aplicadas. Handlers aprovados publicados: `ai` v8 e `delete-account` v2, ambos ACTIVE com `verify_jwt=true`. A função `photo` permaneceu v3. Nenhuma alteração Auth foi feita.

## Artefatos exatos

- [SQL completo da migration 0010](../../supabase/migrations/0010_strict_business_commit.sql): função interna de aplicação, validação obrigatória e NULL-safe, overloads de commit, recibos e revogação de grants amplos. Não reescreve datas/histórico existente. É uma mudança de contrato e permissões: clientes que escrevam diretamente nas tabelas de negócio passarão a ser recusados e devem usar RPC.
- [Diff completo de ai](ai.patch), relativo a `a8ab61d`: mesmo modelo para teste/relatório, deadline total, tratamento de acesso negado e tipos Deno habilitados.
- [Diff completo de delete-account](delete-account.patch), relativo a `a8ab61d`: drena todas as páginas/formatos/subpastas do proprietário confirmado antes de excluir Auth, propagando falha de storage.
- [Diff completo do helper secure](secure.patch): habilita checagem e explicita buffer compatível com Web Crypto. Mudança de tipos; sem mudança intencional de runtime. Deve acompanhar os handlers no empacotamento.

As patches representam o checkout local contra o diagnóstico original, **não uma nova comparação com o remoto nesta retomada**. Confirmar novamente a versão remota antes de aplicar. Os handlers podem ser lidos integralmente em [ai/index.ts](../../supabase/functions/ai/index.ts), [delete-account/index.ts](../../supabase/functions/delete-account/index.ts) e [secure.ts](../../supabase/functions/_shared/secure.ts).

| Arquivo | SHA-256 do conteúdo revisado |
| --- | --- |
| `0010_strict_business_commit.sql` | `4BABBDE1374FDB2F4F9EACF9C9499A9D19FFA6D00CBD89065F6EF40960EBCA10` |
| `ai/index.ts` | `6C70686D9AB58711FDBB31CFA958E52D4C39CCBD737619FB08CFD064C71BBA5F` |
| `delete-account/index.ts` | `3ABFC8B7FA702DF578BB54FA2252F9FE7431A04A6DE0B65107414568912558A5` |
| `_shared/secure.ts` | `890C5F8AE2C3D5CFE77C920680DD49C5BF2E237E0313994F41C0875D40E70A15` |

## Auth a conferir antes do teste

Allowlist dos redirects enviados pelo aplicativo:

```text
lumio://auth-callback
lumio://auth-callback?intent=recovery
```

O cliente usa PKCE. O link deve ser solicitado e aberto no mesmo aparelho que preservou o verifier. Confirmar no Dashboard o comportamento da allowlist, SMTP e confirmação; não desabilitar confirmação nem trocar Site URL para contornar erros. Alterações de configuração Auth precisam estar incluídas na aprovação, caso necessárias.

## Ordem após aprovação explícita

1. Identificar o projeto de destino e renovar leitura de versões/configuração. Confirmar backup operacional e recuperar o estado anterior dos handlers para eventual restauração.
2. Aplicar apenas a nova migration 0010; não editar/reaplicar 0001–0009. Conferir a transação, histórico, grants e overloads resultantes.
3. Implantar `ai` e `delete-account` com helpers, mantendo configuração de gateway compatível com o JWT usado pelo cliente e a validação interna por `auth.getUser`. Não mudar `verify_jwt` por tentativa e erro.
4. Conferir os redirects e solicitar aprovação específica para qualquer ajuste Auth ainda não coberto.
5. Repetir leitura de versão/grants/configuração. Validar fluxos autenticados apenas com contas descartáveis e dados fictícios em ambiente isolado, conforme matriz da auditoria.

Se falhar uma implantação, não reabrir grants amplos nem restaurar a RPC vulnerável como rollback automático. Interromper distribuição, verificar o erro e preparar correção incremental. Exclusão de conta permanece destrutiva e é testada exclusivamente em conta descartável autorizada.
