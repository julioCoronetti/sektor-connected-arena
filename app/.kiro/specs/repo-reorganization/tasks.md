# Implementation Plan: repo-reorganization

## Overview

Reorganização do repositório `sektor-connected-arena` movendo `lambdas/`, `infra/` e `docs/` de dentro de `app/` para a raiz do repositório. Todos os comandos são executados via PowerShell com `cwd` em `sektor-connected-arena\app\`, referenciando a raiz como `..`.

## Tasks

- [x] 1. Verificar pré-condições antes de qualquer movimentação
  - [x] 1.1 Verificar que os destinos na raiz não existem
    - Executar `Test-Path ..\lambdas`, `Test-Path ..\infra`, `Test-Path ..\docs`
    - Se qualquer um retornar `True`, abortar e reportar conflito ao usuário antes de prosseguir
    - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Mover `lambdas/` para a raiz do repositório
  - [x] 2.1 Executar movimentação de `app\lambdas` → `..\lambdas`
    - Executar `Move-Item lambdas ..\lambdas` com cwd em `app\`
    - O comando preserva toda a estrutura interna, incluindo `node_modules/` de cada Lambda
    - _Requirements: 1.1_
  - [x] 2.2 Verificar integridade da movimentação de lambdas
    - Verificar que `Test-Path lambdas` retorna `False` (origem removida)
    - Verificar que `Test-Path ..\lambdas` retorna `True` (destino criado)
    - Verificar que `(Get-ChildItem ..\lambdas -Directory).Count` retorna `12`
    - Os 12 subdiretórios esperados: `createComment`, `createPost`, `getComments`, `getPosts`, `getUploadUrl`, `likePost`, `processEvent`, `resolveAnswer`, `submitAnswer`, `unlikePost`, `wsConnect`, `wsDisconnect`
    - _Requirements: 1.2, 1.3_

- [x] 3. Mover `infra/` para a raiz do repositório
  - [x] 3.1 Executar movimentação de `app\infra` → `..\infra`
    - Executar `Move-Item infra ..\infra` com cwd em `app\`
    - Preserva os 17 arquivos JSON de política IAM e o `README.md`
    - _Requirements: 2.1_
  - [x] 3.2 Verificar integridade da movimentação de infra
    - Verificar que `Test-Path infra` retorna `False` (origem removida)
    - Verificar que `Test-Path ..\infra` retorna `True` (destino criado)
    - Verificar que `(Get-ChildItem ..\infra).Count` retorna `18` (17 JSONs + README)
    - _Requirements: 2.2, 2.3_

- [x] 4. Mover `docs/` para a raiz do repositório
  - [x] 4.1 Executar movimentação de `app\docs` → `..\docs`
    - Executar `Move-Item docs ..\docs` com cwd em `app\`
    - Preserva os 11 arquivos Markdown e o `README.md`
    - _Requirements: 3.1_
  - [x] 4.2 Verificar integridade da movimentação de docs
    - Verificar que `Test-Path docs` retorna `False` (origem removida)
    - Verificar que `Test-Path ..\docs` retorna `True` (destino criado)
    - Verificar que `(Get-ChildItem ..\docs -Filter *.md).Count` retorna `11`
    - _Requirements: 3.2, 3.3_

- [x] 5. Checkpoint — Verificar estado intermediário
  - Garantir que `lambdas/`, `infra/` e `docs/` existem na raiz e não existem mais em `app/`
  - Garantir que as contagens de itens batem com o esperado (12 / 18 / 11)
  - Perguntar ao usuário se há dúvidas antes de prosseguir com as alterações de configuração

- [x] 6. Atualizar `app/metro.config.js` com blockList
  - [x] 6.1 Modificar `metro.config.js` para excluir os diretórios movidos do watch do Metro
    - Ler o arquivo atual e confirmar que `withNativeWind` está presente
    - Adicionar `const path = require("path")` e `const repoRoot = path.resolve(__dirname, "..")`
    - Adicionar `config.resolver.blockList` com três `RegExp` cobrindo `repoRoot/lambdas`, `repoRoot/infra`, `repoRoot/docs`
    - Usar `escapeRegex` para escapar separadores de caminho do Windows corretamente
    - O conteúdo final deve corresponder ao template definido no design (seção "Atualizador do Metro Config")
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 6.2 Escrever testes de exemplo para o blockList
    - Verificar que um caminho dentro de `..\lambdas\createComment\index.js` faz match em algum padrão do `blockList`
    - Verificar que um caminho dentro de `app\src\screens\HomeScreen.tsx` não faz match em nenhum padrão do `blockList`
    - Verificar que um caminho dentro de `..\infra\README.md` faz match em algum padrão do `blockList`
    - Verificar que um caminho dentro de `..\docs\plano-01-fundacao.md` faz match em algum padrão do `blockList`
    - **Property 3: blockList exclui exatamente os diretórios movidos**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 7. Criar `.gitignore` na raiz do repositório
  - [x] 7.1 Criar o arquivo `.gitignore` em `sektor-connected-arena/.gitignore`
    - Verificar com `Test-Path ..\.gitignore` se já existe; se existir, verificar se as entradas obrigatórias já estão presentes e adicioná-las apenas se faltarem
    - Se não existir, criar com o conteúdo:
      ```
      # Lambdas — dependências e artefatos de build
      lambdas/*/node_modules/
      lambdas/*/.build/
      lambdas/*/dist/
      ```
    - Confirmar que `app\.gitignore` não foi modificado (conteúdo preservado byte-a-byte)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 7.2 Escrever testes de exemplo para o `.gitignore` raiz
    - Verificar que o arquivo `..\.gitignore` existe após a criação
    - Verificar que o conteúdo contém `lambdas/*/node_modules/`
    - Verificar que o conteúdo contém `lambdas/*/.build/`
    - Verificar que o conteúdo contém `lambdas/*/dist/`
    - Verificar que o conteúdo de `app\.gitignore` é idêntico ao estado anterior à reorganização
    - **Property 4: `.gitignore` raiz contém todas as entradas obrigatórias**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 8. Verificação final de integridade completa
  - [x] 8.1 Executar verificação final de todos os artefatos
    - Verificar ausência de `app\lambdas`, `app\infra`, `app\docs`
    - Verificar presença e contagens: `lambdas\` (12 subdiretórios), `infra\` (18 itens), `docs\` (11 markdowns)
    - Verificar que `..\.gitignore` existe e contém as três entradas obrigatórias
    - Verificar que `metro.config.js` contém `blockList` com os três padrões
    - Verificar que `app\.gitignore` está preservado
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 3.2, 3.3, 4.1, 5.1, 5.5_
  - [ ]* 8.2 Escrever testes de exemplo para integridade da movimentação
    - Para cada diretório movido, verificar que todos os arquivos/subdiretórios da origem existem no destino com os mesmos nomes
    - **Property 1: Movimentação preserva estrutura interna**
    - **Property 2: Origem é removida após movimentação**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3**

- [x] 9. Checkpoint final — Garantir que a reorganização está completa
  - Garantir que todas as verificações de integridade passaram
  - Perguntar ao usuário se há dúvidas ou ajustes necessários antes de encerrar

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Todos os comandos PowerShell usam `cwd: sektor-connected-arena\app\` e referenciam a raiz como `..`
- A tarefa 1.1 é um guard obrigatório — não prosseguir se qualquer destino já existir na raiz
- O `app\.gitignore` existente nunca deve ser modificado; ele cobre apenas o escopo do App Expo
- O `metro.config.js` deve ser editado com `str_replace` cirúrgico, não reescrito inteiramente
- Checkpoints garantem validação incremental antes de prosseguir para a próxima fase

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["6.1", "7.1"] },
    { "id": 8, "tasks": ["6.2", "7.2"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2"] }
  ]
}
```
