# Expansão de dicionários — guia de uso

Este documento explica como rodar a ferramenta local de expansão de vocabulário
dos engines de regex (`scripts/expand-dictionaries.ts`). Consulte sempre que for
adicionar novos sinônimos/gírias aos dicionários do `taskEngine`, `financialEngine`
ou `calendarEngine`.

## O que essa ferramenta é (e o que NÃO é)

- É um **script de manutenção local**, rodado manualmente no terminal, dentro do
  repositório. Não faz parte do app em produção e não roda no celular do usuário.
- **Não chama nenhuma API externa paga.** Toda geração de termos é feita pelo
  opencode (ou por você), não por uma chamada de rede dentro do script.
- **Não grava em nenhum banco de dados.** Ela edita diretamente os arquivos-fonte
  `.ts` (`src/engine/taskEngine/dictionaries.ts`,
  `src/engine/financialEngine/dictionaries.ts`, etc.), como se você tivesse
  editado manualmente no editor de código.
- As mudanças só valem depois do fluxo normal: `git diff` → commit → push → build.
  Não é dinâmico/instantâneo em produção.
- Isso é diferente do mecanismo de `learnedTerms` (que roda dentro do app e grava
  no perfil do negócio quando um termo não é reconhecido pela taxonomy). Aquele é
  dinâmico e não mexe em regex; este aqui é estático e exige novo build.

## O fluxo completo, em 4 passos

### 1. Gerar as sugestões de termos

Peça ao opencode para preencher `scripts/pending-terms.json` com variações novas
(gírias, conjugações informais, abreviações, erros de digitação comuns), sem
repetir o que já existe no dicionário. Use um prompt como:

```
Gere o arquivo scripts/pending-terms.json com sugestões de novos termos para os
dicionários abaixo. Você mesmo (sem chamar nenhuma API externa) deve pensar em
variações coloquiais em português brasileiro: conjugações informais, gírias
regionais, abreviações de digitação rápida, erros de digitação comuns. Não repita
nada que já exista nos dicionários atuais.

Dicionários alvo (gere de 15 a 25 termos novos para cada):
- [liste aqui as chaves que quer expandir, ex.: ACTION_DICTIONARY.pagar]
- [ex.: IN_FUTURE_MARKERS]

Formato de saída (scripts/pending-terms.json):
[
  { "label": "ACTION_DICTIONARY.pagar", "terms": ["...", "..."] },
  { "label": "IN_FUTURE_MARKERS", "terms": ["...", "..."] }
]

Não rode o expand-dictionaries.ts ainda, só gere o arquivo pending-terms.json pra
eu revisar antes.
```

Dica: peça pra ele **não rodar o script ainda** — assim você revisa a lista bruta
antes de qualquer coisa tocar nos arquivos reais.

### 2. Simular (dry-run)

No terminal:

```bash
npx tsx scripts/expand-dictionaries.ts --dry-run
```

Isso mostra o que **seria** adicionado — duplicatas já são descartadas
automaticamente, e conflitos entre domínios (ex.: um termo que já significa outra
coisa em outro engine) são sinalizados. Nada é escrito nos arquivos nesta etapa.

Para simular só uma constante específica:

```bash
npx tsx scripts/expand-dictionaries.ts --dry-run --only=ACTION_DICTIONARY.pagar
```

(aceita tanto `--only=NOME` quanto `--only NOME`)

### 3. Revisar manualmente a lista

Leia os termos propostos no terminal (ou no relatório) com atenção a **falsos
positivos**: frases genéricas demais que podem casar com frases de outro contexto.

Exemplo real que já aconteceu: "pegar pra mim" e "buscar pra mim" foram propostos
como sinônimo de "comprar", mas essas frases também aparecem em pedidos de busca
que não são compra (ex.: "buscar as crianças na escola"). Foram removidos depois
de revisão.

Se algo parecer arriscado, peça ao opencode para remover só aqueles termos
específicos antes de aplicar — não precisa descartar a leva inteira.

### 4. Aplicar de verdade

Só depois de revisado:

```bash
npx tsx scripts/expand-dictionaries.ts --apply
```

Isso:
- Insere os termos nos arquivos reais via edição estrutural (ts-morph), preservando
  formatação e ordenação existente.
- Roda a suíte de testes automaticamente (`npx tsx --test ...`).
- **Reverte sozinho** as mudanças se algum teste falhar.
- Atualiza `scripts/expand-dictionaries.report.json` com o resumo da rodada
  (quantos termos propostos, aceitos, descartados por duplicata, e conflitos).

### 5. Commit

Depois do `--apply` bem-sucedido:

```bash
git diff        # conferir o que mudou
git add -A
git commit -m "expande dicionario: <dominio/chaves alteradas>"
```
