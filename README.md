# fleetworkslog

Plataforma de logística B2B: marketplace de cargas entre empresas, transportadoras e
motoristas autônomos, com gestão de frota e rastreamento GPS em tempo real.

Documentação de produto e decisões técnicas em [`docs/`](docs/README.md).

## Estrutura

| Pasta      | O que é                                      | Stack                                                  |
| ---------- | -------------------------------------------- | ------------------------------------------------------ |
| `backend/` | API REST (+ WebSocket)                       | Node.js 24, Express 5, Knex, PostgreSQL/PostGIS, Redis |
| `web/`     | Painel da transportadora + Torre de Controle | React 19, Vite, React Router 7, TanStack Query         |
| `mobile/`  | App único para empresa e motorista           | Expo SDK 57, Expo Router                               |
| `shared/`  | Tipos e contratos compartilhados             | TypeScript puro                                        |

## Pré-requisitos

- **Node 24 LTS** (`nvm use` na raiz lê o `.nvmrc`)
- **Docker** com Compose
- Para o mobile: Android Studio (emulador) ou Xcode (macOS) — o app roda como
  _development build_, não no Expo Go

## Setup

```bash
nvm use
npm install                        # instala os 4 workspaces e compila o shared/
cp backend/.env.example backend/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
npm run docker:up                  # PostgreSQL (5437) + Redis (6382)
npm run db:migrate
```

## Rodando

```bash
npm run dev          # shared (watch) + backend (3001) + web (5173)
npm run dev:mobile   # Metro/Expo em outro terminal
```

Primeira vez no mobile: gere o development build com `npm run android --workspace=mobile`
(ou `ios`). Depois basta `npm run dev:mobile`.

Verificação rápida: `curl localhost:3001/health` deve responder `{"status":"ok", ...}`.

## Scripts úteis (raiz)

| Script                                           | O que faz                                           |
| ------------------------------------------------ | --------------------------------------------------- |
| `npm run db:migrate` / `db:rollback` / `db:seed` | Migrations e seeds (Knex)                           |
| `npm run db:make --workspace=backend -- <nome>`  | Cria nova migration                                 |
| `npm test`                                       | Testes unitários de todos os workspaces             |
| `npm run test:integration --workspace=backend`   | Testes com Postgres/Redis reais (precisa do Docker) |
| `npm run lint` / `npm run format`                | ESLint / Prettier                                   |
| `npm run typecheck`                              | TypeScript em todos os workspaces                   |
| `npm run docker:down`                            | Para os containers                                  |

## Portas locais

Escolhidas para não conflitar com outros projetos na mesma máquina:

| Serviço    | Porta |
| ---------- | ----- |
| API        | 3001  |
| Web        | 5173  |
| PostgreSQL | 5437  |
| Redis      | 6382  |

## Observações

- A versão do React é fixada via `overrides` no `package.json` raiz para ficar igual à do
  Expo SDK. Ao atualizar o Expo, atualize o `overrides` junto
  (ver [docs/07-monorepo.md](docs/07-monorepo.md)).
- O npm 11 bloqueia scripts de install por padrão; os permitidos ficam em `allowScripts`.
