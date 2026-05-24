# Requirements Document

## Introduction

Este documento descreve os requisitos para a reorganização do repositório `sektor-connected-arena`, que atualmente possui um monorepo com estrutura flat onde `lambdas/`, `infra/` e `docs/` residem dentro de `app/`. O objetivo é mover essas pastas para a raiz do repositório, isolando o app Expo de artefatos de backend e documentação, eliminando a lentidão do Metro causada pela indexação dos `node_modules` das Lambdas AWS, e criando um `.gitignore` raiz para cobrir artefatos de build.

## Glossary

- **Repositório**: O diretório raiz `sektor-connected-arena/`, gerenciado pelo Git.
- **App**: O projeto Expo React Native localizado em `app/`, contendo o código-fonte mobile.
- **Metro**: O bundler JavaScript utilizado pelo Expo para desenvolvimento e build do App.
- **Lambdas**: As 12 funções AWS Lambda localizadas atualmente em `app/lambdas/`, cada uma com seu próprio `node_modules/`.
- **Infra**: Os 17 arquivos JSON de políticas IAM localizados atualmente em `app/infra/`.
- **Docs**: Os 11 arquivos Markdown de documentação localizados atualmente em `app/docs/`.
- **Kiro**: A ferramenta de automação que executa as operações de movimentação de arquivos.
- **watchFolders**: Configuração do Metro que define quais diretórios são monitorados pelo bundler.
- **blockList**: Configuração do Metro que define padrões de caminhos excluídos do watch.

## Requirements

### Requirement 1 — Mover Lambdas para a raiz do repositório

**User Story:** Como desenvolvedor, quero que as funções Lambda estejam em `lambdas/` na raiz do repositório, para que o Metro não indexe os `node_modules` das Lambdas e o tempo de inicialização do bundler seja reduzido.

#### Acceptance Criteria

1. WHEN a reorganização for executada, THE Kiro SHALL mover o diretório `app/lambdas/` e todo o seu conteúdo para `lambdas/` na raiz do Repositório, preservando a estrutura interna de cada Lambda (incluindo `node_modules/` existentes).
2. WHEN a movimentação de `app/lambdas/` for concluída, THE Kiro SHALL verificar que o diretório `app/lambdas/` não existe mais.
3. WHEN a movimentação de `app/lambdas/` for concluída, THE Kiro SHALL verificar que os 12 subdiretórios de Lambda (`createComment`, `createPost`, `getComments`, `getPosts`, `getUploadUrl`, `likePost`, `processEvent`, `resolveAnswer`, `submitAnswer`, `unlikePost`, `wsConnect`, `wsDisconnect`) existem em `lambdas/` na raiz do Repositório.

---

### Requirement 2 — Mover Infra para a raiz do repositório

**User Story:** Como desenvolvedor, quero que as políticas IAM estejam em `infra/` na raiz do repositório, para que os arquivos de configuração de infraestrutura fiquem separados do código do App.

#### Acceptance Criteria

1. WHEN a reorganização for executada, THE Kiro SHALL mover o diretório `app/infra/` e todo o seu conteúdo para `infra/` na raiz do Repositório, preservando todos os arquivos JSON e o `README.md`.
2. WHEN a movimentação de `app/infra/` for concluída, THE Kiro SHALL verificar que o diretório `app/infra/` não existe mais.
3. WHEN a movimentação de `app/infra/` for concluída, THE Kiro SHALL verificar que os 17 arquivos JSON de política e o `README.md` existem em `infra/` na raiz do Repositório.

---

### Requirement 3 — Mover Docs para a raiz do repositório

**User Story:** Como desenvolvedor, quero que a documentação esteja em `docs/` na raiz do repositório, para que os arquivos Markdown fiquem acessíveis no nível do monorepo e não poluam o diretório do App.

#### Acceptance Criteria

1. WHEN a reorganização for executada, THE Kiro SHALL mover o diretório `app/docs/` e todo o seu conteúdo para `docs/` na raiz do Repositório, preservando todos os arquivos Markdown e o `README.md`.
2. WHEN a movimentação de `app/docs/` for concluída, THE Kiro SHALL verificar que o diretório `app/docs/` não existe mais.
3. WHEN a movimentação de `app/docs/` for concluída, THE Kiro SHALL verificar que os 11 arquivos Markdown existem em `docs/` na raiz do Repositório.

---

### Requirement 4 — Excluir pastas movidas do watch do Metro

**User Story:** Como desenvolvedor, quero que o Metro ignore `lambdas/`, `infra/` e `docs/` na raiz do repositório, para que o bundler não tente indexar arquivos fora do escopo do App.

#### Acceptance Criteria

1. WHEN a reorganização for executada, THE Kiro SHALL atualizar `app/metro.config.js` para adicionar uma configuração `blockList` que exclua os caminhos `<raiz>/lambdas/`, `<raiz>/infra/` e `<raiz>/docs/` do watch do Metro.
2. THE Metro SHALL continuar a monitorar todos os arquivos dentro de `app/` normalmente após a atualização da configuração.
3. WHEN o Metro for iniciado após a reorganização, THE Metro SHALL não indexar nenhum arquivo localizado em `lambdas/`, `infra/` ou `docs/` na raiz do Repositório.

---

### Requirement 5 — Criar `.gitignore` na raiz do repositório

**User Story:** Como desenvolvedor, quero um `.gitignore` na raiz do repositório, para que os `node_modules` das Lambdas e artefatos de build não sejam rastreados pelo Git.

#### Acceptance Criteria

1. WHEN a reorganização for executada, THE Kiro SHALL criar o arquivo `.gitignore` na raiz do Repositório caso ele não exista.
2. THE `.gitignore` raiz SHALL conter a entrada `lambdas/*/node_modules/` para ignorar os `node_modules` de cada Lambda individualmente.
3. THE `.gitignore` raiz SHALL conter a entrada `lambdas/*/.build/` para ignorar artefatos de build das Lambdas.
4. THE `.gitignore` raiz SHALL conter a entrada `lambdas/*/dist/` para ignorar diretórios de distribuição das Lambdas.
5. WHERE o arquivo `app/.gitignore` já existir, THE Kiro SHALL preservar o `app/.gitignore` existente sem modificações, pois ele cobre apenas o escopo do App.
