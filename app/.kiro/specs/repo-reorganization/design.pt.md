# Design Document — repo-reorganization

## Overview

Este documento descreve a arquitetura e o plano de execução para reorganizar o repositório `sektor-connected-arena`. A operação move três diretórios (`lambdas/`, `infra/`, `docs/`) de dentro de `app/` para a raiz do repositório, atualiza a configuração do Metro para excluir os novos caminhos do watch, e cria um `.gitignore` raiz.

A reorganização é executada inteiramente via comandos PowerShell, pois o Kiro tem acesso direto apenas à pasta `app/` e precisa de shell para operar na raiz do repositório.

---

## Arquitetura

### Estrutura atual

```
sektor-connected-arena/          ← raiz do repositório (fora do escopo do Kiro)
└── app/                         ← escopo do Kiro
    ├── lambdas/                 ← 12 Lambdas AWS (cada uma com node_modules/)
    ├── infra/                   ← 17 JSONs de política IAM + README
    ├── docs/                    ← 11 Markdowns de documentação
    ├── metro.config.js
    ├── .gitignore
    └── ... (código Expo)
```

### Estrutura destino

```
sektor-connected-arena/
├── app/                         ← apenas o app Expo
│   ├── metro.config.js          ← atualizado com blockList
│   ├── .gitignore               ← preservado sem alteração
│   └── ... (código Expo)
├── lambdas/                     ← 12 Lambdas AWS
│   ├── createComment/
│   ├── createPost/
│   ├── getComments/
│   ├── getPosts/
│   ├── getUploadUrl/
│   ├── likePost/
│   ├── processEvent/
│   ├── resolveAnswer/
│   ├── submitAnswer/
│   ├── unlikePost/
│   ├── wsConnect/
│   └── wsDisconnect/
├── infra/                       ← 17 JSONs + README
├── docs/                        ← 11 Markdowns + README
└── .gitignore                   ← novo, cobre node_modules das Lambdas
```

---

## Componentes

### 1. Executor de Movimentação (PowerShell)

Responsável por mover os três diretórios da raiz de `app/` para a raiz do repositório. Usa `Move-Item` do PowerShell, que preserva toda a estrutura interna (incluindo `node_modules/` das Lambdas).

**Operações:**
- `Move-Item app\lambdas ..\lambdas` — move as 12 Lambdas
- `Move-Item app\infra ..\infra` — move as políticas IAM
- `Move-Item app\docs ..\docs` — move a documentação

**Diretório de trabalho:** `sektor-connected-arena\app\` (cwd do Kiro)

**Caminho relativo para a raiz:** `..` (um nível acima de `app/`)

### 2. Verificador de Integridade (PowerShell)

Após cada movimentação, verifica:
- Ausência do diretório de origem (ex.: `app\lambdas` não existe mais)
- Presença do diretório de destino (ex.: `..\lambdas` existe)
- Contagem de subdiretórios/arquivos no destino bate com o esperado

### 3. Atualizador do Metro Config

Modifica `app/metro.config.js` para adicionar um `blockList` que exclui os três diretórios movidos do watch do Metro.

**Arquivo atual:**
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
```

**Arquivo após atualização:**
```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const config = getDefaultConfig(__dirname);

// Exclui lambdas/, infra/ e docs/ da raiz do repositório do watch do Metro.
// Esses diretórios foram movidos para fora de app/ e não fazem parte do bundle.
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  new RegExp(`^${escapeRegex(path.join(repoRoot, "lambdas"))}.*`),
  new RegExp(`^${escapeRegex(path.join(repoRoot, "infra"))}.*`),
  new RegExp(`^${escapeRegex(path.join(repoRoot, "docs"))}.*`),
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = withNativeWind(config, { input: "./src/global.css" });
```

> **Nota:** `config.resolver.blockList` aceita um array de `RegExp`. Os padrões são construídos a partir do caminho absoluto da raiz do repositório, garantindo que apenas os diretórios fora de `app/` sejam excluídos. Arquivos dentro de `app/` continuam sendo monitorados normalmente.

### 4. Criador do `.gitignore` Raiz

Cria o arquivo `.gitignore` na raiz do repositório (`sektor-connected-arena/.gitignore`) com entradas para ignorar artefatos de build das Lambdas.

**Conteúdo do `.gitignore` raiz:**
```gitignore
# Lambdas — dependências e artefatos de build
lambdas/*/node_modules/
lambdas/*/.build/
lambdas/*/dist/
```

O arquivo `app/.gitignore` existente **não é modificado**.

---

## Interfaces

### Interface de Execução

Todos os passos são executados sequencialmente pelo Kiro via `execute_pwsh` com `cwd` apontando para `sektor-connected-arena\app\`. A raiz do repositório é referenciada como `..` nos comandos.

```
Passo 1: Move-Item lambdas  → ..\lambdas
Passo 2: Move-Item infra    → ..\infra
Passo 3: Move-Item docs     → ..\docs
Passo 4: Editar metro.config.js
Passo 5: Criar ..\gitignore
Passo 6: Verificações de integridade
```

### Verificações de Integridade

| Verificação | Comando PowerShell | Resultado esperado |
|---|---|---|
| `app\lambdas` removido | `Test-Path app\lambdas` | `False` |
| `lambdas\` criado na raiz | `Test-Path ..\lambdas` | `True` |
| 12 subdiretórios em `lambdas\` | `(Get-ChildItem ..\lambdas -Directory).Count` | `12` |
| `app\infra` removido | `Test-Path app\infra` | `False` |
| `infra\` criado na raiz | `Test-Path ..\infra` | `True` |
| 18 itens em `infra\` (17 JSON + README) | `(Get-ChildItem ..\infra).Count` | `18` |
| `app\docs` removido | `Test-Path app\docs` | `False` |
| `docs\` criado na raiz | `Test-Path ..\docs` | `True` |
| 11 Markdowns em `docs\` | `(Get-ChildItem ..\docs -Filter *.md).Count` | `11` |
| `.gitignore` raiz criado | `Test-Path ..\.gitignore` | `True` |
| `app\.gitignore` preservado | conteúdo inalterado | sem diff |

---

## Modelos de Dados

### Mapeamento de Diretórios

```
Origem (relativo a app/)    →  Destino (relativo à raiz)
─────────────────────────────────────────────────────────
lambdas/                    →  lambdas/
infra/                      →  infra/
docs/                       →  docs/
```

### Inventário de Lambdas (12 subdiretórios)

```
createComment, createPost, getComments, getPosts, getUploadUrl,
likePost, processEvent, resolveAnswer, submitAnswer, unlikePost,
wsConnect, wsDisconnect
```

### Inventário de Infra (18 itens)

```
community-createComment-policy.json   community-createPost-policy.json
community-getComments-policy.json     community-getPosts-policy.json
community-getUploadUrl-policy.json    community-likePost-policy.json
community-s3-cors.json                community-unlikePost-policy.json
lambda-trust-policy.json              process-event-scheduler-policy.json
resolve-answer-policy.json            scheduler-target-policy.json
scheduler-trust-policy.json           scheduler-trust-policy.json
smoke-kinesis.json                    smoke-resolve.json
submit-answer-policy.json             README.md
```

### Inventário de Docs (11 arquivos)

```
plano-01-fundacao.md          plano-02-autenticacao.md
plano-03-modo-arena.md        plano-04-simulador-pipeline.md
plano-05-comunidade.md        plano-06-gps-ar-polimento.md
plano-07-integracao-aws.md    README.md
smoke-auth-flow.md            status-and-todo.md
warnings-suprimidos.md
```

---

## Tratamento de Erros

### Diretório de destino já existe

Se `lambdas/`, `infra/` ou `docs/` já existirem na raiz antes da movimentação, `Move-Item` falhará com erro. A tarefa deve verificar a existência do destino antes de executar o move e reportar o conflito ao usuário.

**Mitigação:** Verificar com `Test-Path ..\lambdas` antes de executar `Move-Item`. Se existir, abortar e notificar.

### Falha parcial na movimentação

Se o processo for interrompido após mover apenas alguns diretórios, o repositório ficará em estado inconsistente. As verificações de integridade ao final de cada passo detectam isso imediatamente.

**Mitigação:** Executar verificação após cada `Move-Item` individual, antes de prosseguir para o próximo.

### `metro.config.js` com estrutura inesperada

Se o arquivo `metro.config.js` tiver sido modificado manualmente e não corresponder ao padrão esperado, a edição pode falhar ou produzir configuração inválida.

**Mitigação:** Ler o arquivo antes de editar e validar que `withNativeWind` está presente. Usar `str_replace` cirúrgico em vez de reescrever o arquivo inteiro.

### `.gitignore` raiz já existe

Se já existir um `.gitignore` na raiz, não sobrescrever — apenas verificar se as entradas necessárias já estão presentes e adicioná-las se faltarem.

---

## Correctness Properties

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas do sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer.*

> **Nota sobre PBT:** Todos os critérios de aceitação desta feature são operações determinísticas de filesystem (mover diretório, verificar existência, criar arquivo). O comportamento não varia com inputs aleatórios — ou a operação é executada corretamente ou não. Por isso, todas as propriedades abaixo são verificadas como **testes de exemplo** (example-based), não como property-based tests. PBT não agrega valor aqui pois 100 iterações não encontrariam mais bugs do que 1-3 execuções representativas.

### Property 1: Movimentação preserva estrutura interna

*Para qualquer* diretório movido (`lambdas/`, `infra/`, `docs/`), todos os arquivos e subdiretórios que existiam na origem devem existir no destino com os mesmos nomes e estrutura hierárquica.

**Validates: Requirements 1.1, 1.3, 2.1, 2.3, 3.1, 3.3**

### Property 2: Origem é removida após movimentação

*Para qualquer* diretório movido, após a conclusão da operação, o caminho de origem (`app/lambdas/`, `app/infra/`, `app/docs/`) não deve mais existir no filesystem.

**Validates: Requirements 1.2, 2.2, 3.2**

### Property 3: blockList exclui exatamente os diretórios movidos

*Para qualquer* caminho de arquivo dentro de `lambdas/`, `infra/` ou `docs/` na raiz do repositório, o padrão `blockList` do Metro deve fazer match nesse caminho. *Para qualquer* caminho de arquivo dentro de `app/`, o `blockList` não deve fazer match.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 4: `.gitignore` raiz contém todas as entradas obrigatórias

*Para qualquer* execução da reorganização, o arquivo `.gitignore` criado na raiz deve conter as três entradas obrigatórias (`lambdas/*/node_modules/`, `lambdas/*/.build/`, `lambdas/*/dist/`), e o `app/.gitignore` deve permanecer byte-a-byte idêntico ao estado anterior.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
