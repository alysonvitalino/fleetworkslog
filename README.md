# fleetworkslog

**API REST de logística B2B**: um marketplace de cargas que conecta empresas que precisam
transportar mercadorias (embarcadoras) a transportadoras e motoristas autônomos, com gestão
de frota (veículos e motoristas) e acompanhamento da entrega.

> Projeto da **Avaliação Final de Desenvolvimento Back-End** — Engenharia de Software,
> 4º período (noturno) — UniSENAI, Campus da Indústria.

## Sumário

1. [Descrição do projeto](#1-descrição-do-projeto)
2. [Integrantes da equipe](#2-integrantes-da-equipe)
3. [Tecnologias utilizadas](#3-tecnologias-utilizadas)
4. [Entidades e relacionamentos](#4-entidades-e-relacionamentos)
5. [Regras de negócio](#5-regras-de-negócio)
6. [Estrutura do projeto](#6-estrutura-do-projeto)
7. [Configuração e execução](#7-configuração-e-execução)
8. [Variáveis de ambiente](#8-variáveis-de-ambiente)
9. [Banco de dados](#9-banco-de-dados)
10. [Endpoints da API](#10-endpoints-da-api)
11. [Exemplos de requisições](#11-exemplos-de-requisições)
12. [Testes automatizados e cobertura](#12-testes-automatizados-e-cobertura)
13. [Documentação Swagger](#13-documentação-swagger)
14. [Observações sobre o monorepo](#14-observações-sobre-o-monorepo)

---

## 1. Descrição do projeto

**Domínio:** transporte rodoviário de cargas.

**Problema:** empresas que precisam enviar mercadorias dependem de contatos informais
(telefone, WhatsApp, indicação) para encontrar quem faça o frete. Do outro lado,
transportadoras e motoristas autônomos ficam com caminhões parados ou voltando vazios
porque não enxergam as cargas disponíveis perto deles.

**Objetivo da API:** centralizar esse fluxo de ponta a ponta:

1. A **empresa** publica uma carga (origem, destino, peso, volume, tipo de veículo, janela
   de coleta, prazo e preço sugerido).
2. **Transportadoras** e **motoristas autônomos** veem as cargas compatíveis com a sua frota
   num raio a partir do seu endereço-base e fazem ofertas (aceitando o preço ou com
   contraproposta).
3. A empresa revisa as ofertas e **aceita uma**, o que gera a **entrega**.
4. O motorista avança a entrega (`COLETADO → EM_TRANSITO → ENTREGUE`), e motorista e
   veículo voltam a ficar disponíveis ao final.

Mais detalhes de produto e decisões técnicas em [`docs/`](docs/README.md).

> **Primeira vez no projeto?** Comece pelo [Guia de Primeiro Uso](docs/10-primeiro-uso.md):
> setup do zero, testes, roteiro para percorrer o fluxo completo pela API (publicar carga →
> ofertar → aceitar → entregar) com os dados do seed e solução dos problemas mais comuns.

## 2. Integrantes da equipe

| Nome completo                |
| ---------------------------- |
| Alyson Hian Clausen Vitalino |
| Fabio Inacio da Rocha        |
| Jhonatan de Souza Gonçalves  |

## 3. Tecnologias utilizadas

| Categoria           | Tecnologias                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Runtime e linguagem | Node.js 24 LTS, TypeScript 6                                                               |
| Framework HTTP      | Express 5, Helmet, CORS                                                                    |
| Banco de dados      | PostgreSQL 18 + PostGIS (compatível com Supabase), Knex (query builder e migrations), `pg` |
| Cache / tempo real  | Redis 8 (ioredis)                                                                          |
| Validação           | Zod 4                                                                                      |
| Documentação        | Swagger/OpenAPI 3.1 (`@asteasolutions/zod-to-openapi` + `swagger-ui-express`)              |
| Testes              | Vitest, Supertest, `@vitest/coverage-v8`                                                   |
| Logs                | Pino / pino-http                                                                           |
| Infra local         | Docker + Docker Compose                                                                    |
| Qualidade           | ESLint, Prettier                                                                           |
| Versionamento       | Git + GitHub                                                                               |

O repositório é um monorepo (npm workspaces). **A API avaliada está em `backend/`**; as
demais pastas são evoluções do projeto:

| Pasta      | O que é                                      | Stack                                                  |
| ---------- | -------------------------------------------- | ------------------------------------------------------ |
| `backend/` | API REST (+ WebSocket)                       | Node.js 24, Express 5, Knex, PostgreSQL/PostGIS, Redis |
| `web/`     | Painel da transportadora + Torre de Controle | React 19, Vite, React Router 7, TanStack Query         |
| `mobile/`  | App único para empresa e motorista           | Expo SDK 57, Expo Router                               |
| `shared/`  | Tipos e contratos compartilhados             | TypeScript puro                                        |

> **Sobre o Supabase:** em desenvolvimento usamos PostgreSQL + PostGIS via Docker. Como o
> Supabase é um PostgreSQL gerenciado (com PostGIS disponível), basta apontar a
> `DATABASE_URL` para a connection string do projeto Supabase, habilitar a extensão
> `postgis` no painel e rodar `npm run db:migrate`.

## 4. Entidades e relacionamentos

As três entidades principais do CRUD são **Veículos**, **Motoristas** e **Cargas**. Elas se
relacionam por meio das **empresas/transportadoras** e das **ofertas**:

```mermaid
erDiagram
    users ||--o| companies : "perfil"
    users ||--o| drivers : "perfil"
    companies ||--o{ drivers : "transportadora emprega"
    companies ||--o{ vehicles : "frota da transportadora"
    drivers ||--o{ vehicles : "veículo próprio (autônomo)"
    companies ||--o{ shipments : "empresa publica"
    shipments ||--o{ shipment_offers : "recebe"
    companies ||--o{ shipment_offers : "transportadora oferta"
    drivers ||--o{ shipment_offers : "motorista atribuído"
    vehicles ||--o{ shipment_offers : "veículo atribuído"
    shipments ||--o{ deliveries : "gera"
    shipment_offers ||--|| deliveries : "oferta aceita"
    deliveries ||--o{ delivery_status_events : "histórico"
    drivers ||--o{ driver_vehicles : "dirigiu"
    vehicles ||--o{ driver_vehicles : "foi dirigido"
```

| Entidade                             | Principais atributos                                                                                                                                                            | Relacionamentos                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Veículo** (`vehicles`)             | `plate`, `type` (VAN, TRUCK_TOCO, TRUCK_TRUCK, CARRETA), `capacity_kg`, `capacity_m3`, `status`                                                                                 | Pertence a **uma** transportadora (`carrier_id`) **ou** a um motorista autônomo (`owner_driver_id`) |
| **Motorista** (`drivers`)            | `cnh_number`, `cnh_category`, `phone`, `status` (DISPONIVEL, EM_VIAGEM, INDISPONIVEL), `base_address`                                                                           | Tem um `user`; pertence a uma transportadora (`carrier_id`) ou é autônomo (`carrier_id` nulo)       |
| **Carga** (`shipments`)              | origem/destino (endereço + ponto geográfico), `cargo_type`, `weight_kg`, `volume_m3`, `required_vehicle_type`, janela de coleta, `delivery_deadline`, `price_offered`, `status` | Publicada por uma empresa (`shipper_id`); recebe ofertas; gera entregas                             |
| Empresa/Transportadora (`companies`) | `type` (EMPRESA, TRANSPORTADORA), `legal_name`, `document` (CNPJ), endereço                                                                                                     | Tem um `user`; transportadora tem motoristas e veículos; empresa tem cargas                         |
| Oferta (`shipment_offers`)           | `price_proposed`, `status` (PENDENTE, ACEITA, RECUSADA, RETIRADA, CANCELADA)                                                                                                    | Liga carga ↔ transportadora/motorista ↔ veículo                                                     |
| Entrega (`deliveries`)               | `status` (COLETA_PENDENTE, COLETADO, EM_TRANSITO, ENTREGUE, CANCELADO), datas de coleta/entrega/cancelamento                                                                    | Nasce da oferta aceita; tem histórico em `delivery_status_events`                                   |

## 5. Regras de negócio

As regras ficam na camada de **services** (com reforço por constraints no banco). Quando uma
regra impede a operação, a API responde **409 Conflict** com uma mensagem explicando o motivo;
dados inválidos respondem **400**; recurso inexistente (ou de outro dono) responde **404**.

**Cadastros**

- CNPJ validado pelo dígito verificador; e-mail único sem diferenciar maiúsculas/minúsculas;
  CNPJ e CNH únicos no sistema.
- Transportadora e motorista autônomo **precisam de endereço-base** (centro da busca de cargas
  por raio) e não podem removê-lo.
- Senha é armazenada apenas como hash (scrypt). Motorista cadastrado pela transportadora
  nasce sem senha (pendente de convite).

**Veículos**

- Placa normalizada e validada (padrão antigo `AAA9999` ou Mercosul `AAA9A99`), única no
  sistema inteiro.
- Capacidades em kg e m³ devem ser positivas.
- O veículo pertence a exatamente um dono: transportadora **ou** motorista autônomo.
- Status manual só pode ser `DISPONIVEL` ou `MANUTENCAO`; `EM_VIAGEM` é controlado pelo
  sistema. Veículo em viagem não pode ter o status alterado nem ser removido.
- Veículo já usado em ofertas ou entregas não pode ser removido (deve ir para `MANUTENCAO`).

**Motoristas**

- A transportadora só enxerga e altera os motoristas da própria frota.
- Motorista em viagem não pode ter o status alterado nem ser removido; motorista com
  histórico de ofertas/entregas não pode ser removido (deve ficar `INDISPONIVEL`).

**Cargas**

- Peso, volume e preço positivos; a janela de coleta precisa terminar no futuro, o fim deve
  ser depois do início, e o prazo de entrega depois do início da coleta.
- Só carga **ABERTA** pode ser editada ou cancelada. Cancelar a carga cancela as ofertas
  pendentes dela.
- Só carga **ABERTA que nunca recebeu oferta** pode ser excluída. Com ofertas (em qualquer
  status), o histórico é preservado e a carga deve ser cancelada.

**Ofertas e entregas**

- Só aparecem para o ofertante as cargas ABERTAS, dentro do raio (padrão 100 km), que algum
  veículo dele comporta (tipo, peso e volume) e onde ele não teve oferta recusada.
- No máximo uma oferta PENDENTE por ofertante em cada carga; oferta recusada impede nova
  oferta naquela carga.
- Aceitar uma oferta: a oferta vira ACEITA, as outras pendentes são canceladas, a carga vira
  ACEITA e é criada a entrega (tudo numa transação).
- A entrega avança um passo por vez: `COLETA_PENDENTE → COLETADO → EM_TRANSITO → ENTREGUE`.
  Na coleta, motorista e veículo passam a `EM_VIAGEM`; ao entregar, voltam a `DISPONIVEL`.
- Cancelar a entrega devolve a carga para ABERTA e libera motorista e veículo.
- Toda mudança de status da entrega gera um evento de auditoria.

## 6. Estrutura do projeto

```
backend/
├── src/
│   ├── config/        # Leitura e validação das variáveis de ambiente (zod)
│   ├── controllers/   # Classes que recebem a request, chamam o service e devolvem a resposta HTTP
│   ├── db/            # Conexão Knex, migrations, seeds, CLI e helpers (PostGIS, erros do pg)
│   ├── errors/        # AppError: erro de negócio com status HTTP e código
│   ├── lib/           # Logger, hash de senha, cliente Redis
│   ├── middlewares/   # Validação de body e tratamento centralizado de erros
│   ├── models/        # Tipos das linhas do banco e conversão para DTO (JSON da API)
│   ├── openapi/       # Geração do documento OpenAPI e rota do Swagger UI
│   ├── repositories/  # Classes de acesso aos dados (queries Knex): sem regra de negócio
│   ├── routes/        # Definição dos endpoints por módulo
│   ├── schemas/       # Schemas zod de validação das requests
│   ├── services/      # Classes com as regras de negócio (sem SQL) + testes unitários
│   ├── test/          # Testes de integração (*.int.test.ts) + fixtures e setup do banco
│   ├── app.ts         # Monta a aplicação Express (dependências injetadas)
│   ├── container.ts   # Composition root: instancia repositories e services
│   └── server.ts      # Ponto de entrada: sobe o servidor HTTP
├── vitest.config.ts               # Testes unitários
├── vitest.integration.config.ts   # Testes de integração
└── vitest.coverage.config.ts      # Unitários + integração com relatório de cobertura
docker/postgres/init/   # Script SQL executado na criação do container (PostGIS + banco de teste)
docs/                   # Documentação de produto e decisões técnicas
postman/                # Collection do Postman
shared/                 # Tipos e enums compartilhados entre backend, web e mobile
```

Os testes unitários ficam ao lado do arquivo testado (`*.test.ts`).

### Camadas e Orientação a Objetos

Fluxo de uma requisição:

```
Route → Controller → Service → Repository → PostgreSQL
         (HTTP)      (regras)    (SQL)
```

| Camada         | Responsabilidade                                                                       | Exemplo                                                       |
| -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Routes**     | Liga método + caminho ao controller e aplica a validação do body (zod)                 | `routes/fleet.routes.ts`                                      |
| **Controller** | Extrai parâmetros da request, chama o service e escolhe o status HTTP                  | `VehicleController`                                           |
| **Service**    | Regras de negócio: verifica condições, lança `AppError` (404/409), controla transações | `VehicleService`, `ShipmentService`, `DriverService`          |
| **Repository** | Único lugar com SQL; recebe e devolve linhas do banco                                  | `VehicleRepository`, `ShipmentRepository`, `DriverRepository` |
| **Model**      | Formato das linhas do banco e conversão para o JSON da API (DTO)                       | `models/vehicle.model.ts`                                     |

Conceitos de POO aplicados:

- **Classes e responsabilidades:** cada entidade tem seu `Controller`, `Service` e `Repository`.
- **Encapsulamento:** dependências são `private readonly`; métodos auxiliares (`findOwnedOrFail`,
  `ownerColumns`) não são expostos.
- **Herança e abstração:** os repositories estendem a classe abstrata `BaseRepository`, que
  guarda a conexão e oferece `transaction()` — o service executa várias operações de forma
  atômica sem conhecer o Knex.
- **Injeção de dependência:** o service recebe o repository pelo construtor
  (`new VehicleService(new VehicleRepository(db), owners)`, montado em `container.ts`). Nos
  testes unitários o repository é trocado por um mock, isolando a regra de negócio do banco.
- **Erros como objetos:** `AppError` estende `Error` com `statusCode` e `code`, e o
  middleware de erro converte para a resposta HTTP padronizada.

> Veículos, Motoristas e Cargas seguem esse padrão completo. Os módulos de marketplace,
> entregas e contas ainda usam services em funções e são a próxima etapa de evolução.

## 7. Configuração e execução

### Pré-requisitos

- **Node 24 LTS** (`nvm use` na raiz lê o `.nvmrc`)
- **Docker** com Compose
- Para o mobile (opcional): Android Studio (emulador) ou Xcode (macOS) — o app roda como
  _development build_, não no Expo Go

### Passo a passo

```bash
# 1. Clonar o repositório
git clone git@github.com:alysonvitalino/fleetworkslog.git
cd fleetworkslog

# 2. Instalar as dependências (instala os 4 workspaces e compila o shared/)
nvm use
npm install

# 3. Configurar as variáveis de ambiente
cp backend/.env.example backend/.env
cp web/.env.example web/.env        # opcional (painel web)
cp mobile/.env.example mobile/.env  # opcional (app mobile)

# 4. Preparar o banco de dados
npm run docker:up                   # PostgreSQL/PostGIS (5437) + Redis (6382)
npm run db:migrate                  # cria as tabelas
npm run db:seed                     # opcional: dados de exemplo

# 5. Iniciar a aplicação
npm run dev                         # shared (watch) + backend (3001) + web (5173)
```

Só a API: `npm run dev --workspace=backend`.

Verificação rápida: `curl localhost:3001/health` deve responder `{"status":"ok", ...}`.

Mobile: na primeira vez gere o development build com `npm run android --workspace=mobile`
(ou `ios`); depois basta `npm run dev:mobile` em outro terminal.

### Scripts úteis (raiz)

| Script                                           | O que faz                                           |
| ------------------------------------------------ | --------------------------------------------------- |
| `npm run db:migrate` / `db:rollback` / `db:seed` | Migrations e seeds (Knex)                           |
| `npm run db:make --workspace=backend -- <nome>`  | Cria nova migration                                 |
| `npm test`                                       | Testes unitários de todos os workspaces             |
| `npm run test:integration --workspace=backend`   | Testes com Postgres/Redis reais (precisa do Docker) |
| `npm run test:coverage --workspace=backend`      | Unitários + integração com relatório de cobertura   |
| `npm run lint` / `npm run format`                | ESLint / Prettier                                   |
| `npm run typecheck`                              | TypeScript em todos os workspaces                   |
| `npm run docker:down`                            | Para os containers                                  |

### Portas locais

Escolhidas para não conflitar com outros projetos na mesma máquina:

| Serviço    | Porta |
| ---------- | ----- |
| API        | 3001  |
| Web        | 5173  |
| PostgreSQL | 5437  |
| Redis      | 6382  |

## 8. Variáveis de ambiente

O arquivo **`backend/.env.example`** traz todas as variáveis com valores de exemplo (apenas
para o Docker local). O `.env` com valores reais está no `.gitignore` e **não deve ser
versionado**.

| Variável            | Obrigatória | Exemplo / padrão                                                           | Descrição                                             |
| ------------------- | ----------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`      | Sim         | `postgres://fleetworkslog:fleetworkslog@localhost:5437/fleetworkslog`      | Conexão com o PostgreSQL (ou Supabase)                |
| `REDIS_URL`         | Sim         | `redis://localhost:6382`                                                   | Conexão com o Redis                                   |
| `NODE_ENV`          | Não         | `development`                                                              | `development`, `test`, `staging` ou `production`      |
| `PORT`              | Não         | `3001`                                                                     | Porta HTTP da API                                     |
| `LOG_LEVEL`         | Não         | `info`                                                                     | Nível de log do Pino                                  |
| `CORS_ORIGIN`       | Não         | `http://localhost:5173`                                                    | Origens permitidas (separadas por vírgula)            |
| `API_DOCS_ENABLED`  | Não         | (vazio)                                                                    | Liga o Swagger. Sem valor: ligado só em `development` |
| `TEST_DATABASE_URL` | Não         | `postgres://fleetworkslog:fleetworkslog@localhost:5437/fleetworkslog_test` | Banco usado pelos testes de integração                |

O `.env.example` da raiz contém as variáveis lidas pelo `docker-compose.yml`
(`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT`) — só é
preciso copiá-lo para `.env` se quiser mudar os padrões.

As variáveis são validadas na inicialização (`src/config/env.ts`): se faltar alguma
obrigatória, a API não sobe e informa qual variável está inválida.

## 9. Banco de dados

**Reprodução da estrutura:** o schema é versionado em migrations Knex
(`backend/src/db/migrations/`). Com o banco no ar, `npm run db:migrate` cria todas as tabelas,
constraints e índices; `npm run db:rollback` desfaz. O script
`docker/postgres/init/01-init.sql` habilita o PostGIS e cria o banco de teste
`fleetworkslog_test` na primeira subida do container.

Todas as chaves primárias são **UUID** (`gen_random_uuid()`), e as datas são `timestamptz`.

| Tabela                   | PK   | Chaves estrangeiras                                                                                 | Principais restrições                                                                |
| ------------------------ | ---- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `users`                  | `id` | —                                                                                                   | e-mail único (case-insensitive); `role` enum                                         |
| `refresh_tokens`         | `id` | `user_id → users` (cascade)                                                                         | `token_hash` único                                                                   |
| `companies`              | `id` | `user_id → users`                                                                                   | CNPJ único com 14 dígitos; transportadora exige `base_geo`; `rating_avg` entre 1 e 5 |
| `drivers`                | `id` | `user_id → users`, `carrier_id → companies`                                                         | CNH única com 11 dígitos; autônomo exige `base_geo`                                  |
| `vehicles`               | `id` | `carrier_id → companies`, `owner_driver_id → drivers`                                               | placa única e no formato válido; exatamente um dono; capacidades > 0                 |
| `driver_vehicles`        | `id` | `driver_id → drivers`, `vehicle_id → vehicles`                                                      | um vínculo aberto por motorista e por veículo; `ended_at >= started_at`              |
| `shipments`              | `id` | `shipper_id → companies`                                                                            | peso, volume e preço > 0; janela de coleta coerente; prazo após o início da coleta   |
| `shipment_offers`        | `id` | `shipment_id → shipments`, `carrier_id → companies`, `driver_id → drivers`, `vehicle_id → vehicles` | preço > 0; autônomo exige motorista e veículo; uma PENDENTE por ofertante e carga    |
| `deliveries`             | `id` | `shipment_id → shipments`, `offer_id → shipment_offers` (único)                                     | uma entrega não cancelada por carga; datas obrigatórias conforme o status            |
| `delivery_status_events` | `id` | `delivery_id → deliveries`, `created_by → users`                                                    | histórico de status da entrega                                                       |

O modelo completo, com a justificativa de cada campo, está em
[docs/02-modelo-de-dados.md](docs/02-modelo-de-dados.md).

## 10. Endpoints da API

Base local: `http://localhost:3001`. Todas as rotas recebem e devolvem JSON. Os IDs no path
são UUIDs; listagens aceitam `limit` e `offset` (paginação) e filtro por `status`.

**PUT x PATCH:** `PUT` substitui o recurso inteiro (exige todos os campos editáveis; um campo
opcional omitido é limpo), enquanto `PATCH` altera só os campos enviados.

### Veículos (frota da transportadora e veículo do autônomo)

| Método | Endpoint                                          | Descrição                                 |
| ------ | ------------------------------------------------- | ----------------------------------------- |
| GET    | `/carriers/:carrierId/vehicles`                   | Lista os veículos da transportadora       |
| POST   | `/carriers/:carrierId/vehicles`                   | Cadastra um veículo na frota              |
| GET    | `/carriers/:carrierId/vehicles/:vehicleId`        | Consulta um veículo                       |
| PUT    | `/carriers/:carrierId/vehicles/:vehicleId`        | Substitui um veículo (corpo completo)     |
| PATCH  | `/carriers/:carrierId/vehicles/:vehicleId`        | Atualiza campos de um veículo             |
| PATCH  | `/carriers/:carrierId/vehicles/:vehicleId/status` | Altera o status (DISPONIVEL/MANUTENCAO)   |
| DELETE | `/carriers/:carrierId/vehicles/:vehicleId`        | Remove um veículo                         |
| GET    | `/drivers/:driverId/vehicles`                     | Lista os veículos do motorista autônomo   |
| POST   | `/drivers/:driverId/vehicles`                     | Cadastra o veículo do autônomo            |
| GET    | `/drivers/:driverId/vehicles/:vehicleId`          | Consulta um veículo do autônomo           |
| PUT    | `/drivers/:driverId/vehicles/:vehicleId`          | Substitui um veículo do autônomo          |
| PATCH  | `/drivers/:driverId/vehicles/:vehicleId`          | Atualiza campos de um veículo do autônomo |
| PATCH  | `/drivers/:driverId/vehicles/:vehicleId/status`   | Altera o status do veículo do autônomo    |
| DELETE | `/drivers/:driverId/vehicles/:vehicleId`          | Remove um veículo do autônomo             |

### Motoristas

| Método | Endpoint                                        | Descrição                                   |
| ------ | ----------------------------------------------- | ------------------------------------------- |
| GET    | `/carriers/:carrierId/drivers`                  | Lista os motoristas da transportadora       |
| POST   | `/carriers/:carrierId/drivers`                  | Cadastra um motorista na frota              |
| GET    | `/carriers/:carrierId/drivers/:driverId`        | Consulta um motorista da frota              |
| PUT    | `/carriers/:carrierId/drivers/:driverId`        | Substitui o perfil de um motorista da frota |
| PATCH  | `/carriers/:carrierId/drivers/:driverId`        | Atualiza campos de um motorista da frota    |
| PATCH  | `/carriers/:carrierId/drivers/:driverId/status` | Altera o status do motorista da frota       |
| DELETE | `/carriers/:carrierId/drivers/:driverId`        | Remove um motorista da frota                |
| POST   | `/signup/motorista`                             | Cadastro de motorista autônomo              |
| GET    | `/drivers/:driverId`                            | Consulta um motorista                       |
| PATCH  | `/drivers/:driverId`                            | Atualiza o perfil do motorista autônomo     |
| PATCH  | `/drivers/:driverId/status`                     | Altera o status do motorista autônomo       |

### Cargas

| Método | Endpoint                                             | Descrição                                   |
| ------ | ---------------------------------------------------- | ------------------------------------------- |
| GET    | `/companies/:companyId/shipments`                    | Lista as cargas da empresa                  |
| POST   | `/companies/:companyId/shipments`                    | Publica uma carga                           |
| GET    | `/companies/:companyId/shipments/:shipmentId`        | Consulta uma carga                          |
| PUT    | `/companies/:companyId/shipments/:shipmentId`        | Substitui uma carga ABERTA (corpo completo) |
| PATCH  | `/companies/:companyId/shipments/:shipmentId`        | Atualiza campos de uma carga ABERTA         |
| DELETE | `/companies/:companyId/shipments/:shipmentId`        | Exclui uma carga ABERTA sem ofertas         |
| POST   | `/companies/:companyId/shipments/:shipmentId/cancel` | Cancela uma carga ABERTA                    |

### Contas (empresas e transportadoras)

| Método | Endpoint                 | Descrição                         |
| ------ | ------------------------ | --------------------------------- |
| POST   | `/signup/empresa`        | Cadastro de empresa (embarcadora) |
| POST   | `/signup/transportadora` | Cadastro de transportadora        |
| GET    | `/companies/:companyId`  | Consulta empresa/transportadora   |
| PATCH  | `/companies/:companyId`  | Atualiza empresa/transportadora   |

### Marketplace (ofertas)

`:party` é `carriers/:carrierId` (transportadora) ou `drivers/:driverId` (autônomo).

| Método | Endpoint                                                             | Descrição                                |
| ------ | -------------------------------------------------------------------- | ---------------------------------------- |
| GET    | `/:party/available-shipments`                                        | Cargas compatíveis dentro do raio        |
| POST   | `/:party/shipments/:shipmentId/offers`                               | Faz uma oferta numa carga                |
| GET    | `/:party/offers`                                                     | Lista as ofertas feitas                  |
| POST   | `/:party/offers/:offerId/withdraw`                                   | Retira uma oferta pendente               |
| PUT    | `/carriers/:carrierId/offers/:offerId/assignment`                    | Atribui motorista e veículo à oferta     |
| GET    | `/companies/:companyId/shipments/:shipmentId/offers`                 | Empresa lista as ofertas recebidas       |
| POST   | `/companies/:companyId/shipments/:shipmentId/offers/:offerId/accept` | Empresa aceita a oferta (gera a entrega) |
| POST   | `/companies/:companyId/shipments/:shipmentId/offers/:offerId/reject` | Empresa recusa a oferta                  |

### Entregas e saúde

| Método | Endpoint                                              | Descrição                            |
| ------ | ----------------------------------------------------- | ------------------------------------ |
| GET    | `/companies/:companyId/deliveries/:deliveryId`        | Empresa acompanha a entrega          |
| POST   | `/companies/:companyId/deliveries/:deliveryId/cancel` | Empresa cancela a entrega            |
| GET    | `/drivers/:driverId/deliveries`                       | Entregas em andamento do motorista   |
| POST   | `/drivers/:driverId/deliveries/:deliveryId/status`    | Motorista avança o status da entrega |
| GET    | `/health`                                             | Status da API, PostgreSQL e Redis    |

### Códigos de resposta

| Código | Quando                                                                         |
| ------ | ------------------------------------------------------------------------------ |
| 200    | Consulta, atualização ou ação concluída                                        |
| 201    | Registro criado                                                                |
| 204    | Registro removido (sem corpo)                                                  |
| 400    | Payload, query ou ID inválido (`VALIDATION_ERROR`, com os campos em `details`) |
| 404    | Recurso não encontrado ou não pertence ao dono informado no path               |
| 409    | Regra de negócio impede a operação (`CONFLICT`)                                |
| 500    | Erro interno (sem expor detalhes)                                              |

Formato padrão de erro:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Não é possível remover um veículo em viagem",
    "requestId": "a1b2c3d4-..."
  }
}
```

## 11. Exemplos de requisições

**Cadastrar transportadora** — `POST /signup/transportadora`

```json
{
  "name": "Carlos Lima",
  "email": "carlos.lima@transportadora-exemplo.com.br",
  "password": "senhaSegura123",
  "phone": "(41) 3333-4444",
  "legalName": "Faro Fino Transportes Ltda",
  "document": "45.219.685/0001-08",
  "address": {
    "address": "Rua Senador Accioly Filho, 500 - CIC, Curitiba - PR",
    "lat": -25.495,
    "lng": -49.348
  }
}
```

**Cadastrar veículo** — `POST /carriers/:carrierId/vehicles`

```json
{ "plate": "ABC1D23", "type": "TRUCK_TOCO", "capacityKg": 6000, "capacityM3": 40 }
```

**Atualizar veículo** — `PATCH /carriers/:carrierId/vehicles/:vehicleId`

```json
{ "capacityKg": 6500 }
```

**Substituir veículo** — `PUT /carriers/:carrierId/vehicles/:vehicleId` (todos os campos)

```json
{ "plate": "ABC1D23", "type": "TRUCK_TRUCK", "capacityKg": 12000, "capacityM3": 60 }
```

**Cadastrar motorista na frota** — `POST /carriers/:carrierId/drivers`

```json
{
  "name": "Marcos Silva",
  "email": "marcos.silva@transportadora-exemplo.com.br",
  "cnhNumber": "98765432100",
  "cnhCategory": "E",
  "phone": "41991234567"
}
```

**Atualizar motorista** — `PATCH /carriers/:carrierId/drivers/:driverId`

```json
{ "phone": "41998765432" }
```

**Publicar carga** — `POST /companies/:companyId/shipments` (datas futuras, ISO 8601 com fuso)

```json
{
  "origin": {
    "address": "Rua XV de Novembro, 1000 - Centro, Curitiba - PR",
    "lat": -25.4296,
    "lng": -49.2713
  },
  "destination": {
    "address": "Av. Paulista, 1578 - Bela Vista, São Paulo - SP",
    "lat": -23.5614,
    "lng": -46.6559
  },
  "cargoType": "Eletrônicos",
  "weightKg": 3500,
  "volumeM3": 25,
  "requiredVehicleType": "TRUCK_TOCO",
  "pickupWindowStart": "2026-12-01T08:00:00-03:00",
  "pickupWindowEnd": "2026-12-01T18:00:00-03:00",
  "deliveryDeadline": "2026-12-03T18:00:00-03:00",
  "specialRequirements": "Carga frágil: não empilhar",
  "priceOffered": 4800
}
```

**Atualizar carga** — `PATCH /companies/:companyId/shipments/:shipmentId`

```json
{ "priceOffered": 5200 }
```

**Fazer oferta (transportadora)** — `POST /carriers/:carrierId/shipments/:shipmentId/offers`

```json
{ "priceProposed": 4500 }
```

**Avançar entrega** — `POST /drivers/:driverId/deliveries/:deliveryId/status`

```json
{ "status": "COLETADO", "note": "Carga coletada sem avarias" }
```

Todos os endpoints também têm exemplo pronto no Swagger (seção 13) e na collection em
[`postman/`](postman/).

## 12. Testes automatizados e cobertura

**Ferramentas:** Vitest (runner e asserções), Supertest (requisições HTTP contra a app
Express real) e `@vitest/coverage-v8` (cobertura).

**Organização:**

| Tipo       | Onde                                           | O que testa                                                                                                                                                        |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unitários  | `backend/src/**/*.test.ts` (ao lado do código) | Regras de negócio dos services com repositories mockados (`vi.fn()`), validações dos schemas, config, hash de senha, app e OpenAPI — sem banco                     |
| Integração | `backend/src/test/*.int.test.ts`               | Endpoints de ponta a ponta com PostgreSQL real: CRUD das entidades, códigos HTTP, dados retornados, constraints do banco e fluxo completo carga → oferta → entrega |

**Como executar** (a partir da raiz, com o Docker no ar — `npm run docker:up`):

```bash
npm test --workspace=backend                 # unitários (não precisam de banco)
npm run test:integration --workspace=backend # integração (PostgreSQL + Redis)
npm run test:coverage --workspace=backend    # unitários + integração com cobertura
```

O relatório de cobertura sai no terminal e em HTML em `backend/coverage/index.html`. O
comando falha se qualquer métrica ficar abaixo de **60%** (`thresholds` no
`vitest.coverage.config.ts`). Só ficam fora da medição os próprios testes, migrations, seeds,
a CLI do banco e o `server.ts` (bootstrap).

**Cobertura alcançada** (236 testes: 141 unitários + 95 de integração):

| Métrica    | Cobertura |
| ---------- | --------- |
| Statements | 96,22%    |
| Branches   | 87,30%    |
| Functions  | 98,92%    |
| Lines      | 98,12%    |

Só com os testes unitários (sem banco), os services de Veículos, Motoristas e Cargas têm
99% de statements e 96% de branches cobertos — as regras de negócio são verificadas de forma
isolada, com mocks.

**Cuidados com o banco de testes:**

- Os testes de integração usam um banco separado, `fleetworkslog_test` (criado
  automaticamente pelo `docker/postgres/init/01-init.sql`), para nunca apagar dados de
  desenvolvimento. Outro banco pode ser usado via `TEST_DATABASE_URL`.
- Cada arquivo roda as migrations no início (`beforeAll`) e desfaz no fim (`afterAll`).
- Antes de cada teste o banco é limpo (`TRUNCATE users CASCADE`), então os cenários são
  independentes e podem ser executados quantas vezes for preciso.
- Os arquivos rodam em sequência (`fileParallelism: false`) porque compartilham o banco.
- Se o container foi criado antes do script de init existir, crie o banco manualmente:
  `docker exec -it fleetworkslog-postgres psql -U fleetworkslog -c "CREATE DATABASE fleetworkslog_test"`
  e depois `CREATE EXTENSION postgis` dentro dele.

## 13. Documentação Swagger

Com a API rodando em desenvolvimento (`npm run dev`), acesse:

- **Swagger UI:** <http://localhost:3001/docs>
- **Contrato OpenAPI (JSON):** <http://localhost:3001/docs/openapi.json> — importável no
  Postman/Insomnia

O documento é gerado a partir dos **mesmos schemas zod que validam as requests**, então a
documentação sempre acompanha a validação real. Cada endpoint traz método, rota, finalidade,
parâmetros de path e query, estrutura e exemplo do corpo, e os códigos de resposta possíveis
(incluindo quando cada 409 acontece).

**Como usar:** abra uma rota, clique em **Try it out**, preencha os IDs do path (use os IDs
devolvidos nos cadastros ou os do seed) e clique em **Execute**. Uma sequência que percorre
o fluxo: `POST /signup/empresa` → `POST /signup/transportadora` →
`POST /carriers/{id}/vehicles` → `POST /companies/{id}/shipments` →
`POST /carriers/{id}/shipments/{id}/offers` → `POST .../offers/{id}/accept`.

Por segurança, o Swagger fica ligado só em `NODE_ENV=development`. Em outros ambientes,
defina `API_DOCS_ENABLED=true` para habilitá-lo.

## 14. Observações sobre o monorepo

- A versão do React é fixada via `overrides` no `package.json` raiz para ficar igual à do
  Expo SDK. Ao atualizar o Expo, atualize o `overrides` junto
  (ver [docs/07-monorepo.md](docs/07-monorepo.md)).
- O npm 11 bloqueia scripts de install por padrão; os permitidos ficam em `allowScripts`.
