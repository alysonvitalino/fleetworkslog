# Primeiro Uso

Passo a passo para subir o projeto do zero e validar que ele funciona.

> **Estado atual (2026-09-28):** só o **backend** pode ser testado de ponta a ponta,
> pela API e pelos testes automatizados. Web e mobile ainda são esqueletos: sobem e
> mostram o status da API, mas as telas são placeholders. Não existe login ainda — as
> rotas recebem o id do dono no path, sem autenticação. Escopo completo em [MVP](03-mvp.md).

---

## Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | **24.x** | O projeto recusa outras majors (`engines: >=24 <25`). Use o nvm |
| npm | 10+ | Vem com o Node 24 |
| Docker + Compose | recente | Sobe o PostgreSQL/PostGIS e o Redis |
| jq | qualquer | Opcional, só para ler as respostas da API (`sudo apt install jq`) |
| Android Studio | — | Opcional, só para o mobile (development build, não roda no Expo Go) |

Portas usadas (escolhidas para não conflitar com outros projetos da máquina):

| Serviço | Porta |
|---|---|
| API | 3001 |
| Web | 5173 |
| PostgreSQL | 5437 |
| Redis | 6382 |

---

## 1. Selecionar o Node 24

```bash
cd fleetworkslog
nvm install 24   # só na primeira vez
nvm use          # lê o .nvmrc
node -v          # deve mostrar v24.x
```

## 2. Instalar as dependências

```bash
npm install
```

Instala os 4 workspaces (`shared`, `backend`, `web`, `mobile`) e já compila o `shared/`
no `postinstall`.

## 3. Criar os arquivos de ambiente

```bash
cp backend/.env.example backend/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
```

Os valores padrão já apontam para o Docker local. Os tokens do Mapbox podem ficar
vazios — ainda não há mapa implementado.

## 4. Subir o banco e o Redis

```bash
npm run docker:up
docker ps --filter name=fleetworkslog   # os dois containers devem aparecer como healthy
```

Na **primeira criação do volume**, o script `docker/postgres/init/01-init.sql` habilita o
PostGIS e cria o banco `fleetworkslog_test`, usado pelos testes de integração.

## 5. Criar as tabelas e os dados de exemplo

```bash
npm run db:migrate   # aplica as migrations (Knex)
npm run db:seed      # popula dados de desenvolvimento
```

O seed é idempotente: rodar de novo recoloca tudo no estado inicial.

## 6. Rodar os testes

```bash
npm test                                       # unitários de todos os workspaces
npm run test:integration --workspace=backend   # integração com Postgres/Redis reais
npm run typecheck
npm run lint
```

Os testes de integração usam o banco `fleetworkslog_test` e apagam os dados dele entre um
teste e outro — o banco de desenvolvimento não é afetado.

## 7. Subir a aplicação

```bash
npm run dev   # shared (watch) + API (3001) + web (5173)
```

Verificação:

```bash
curl -s localhost:3001/health | jq   # deve responder "status": "ok"
```

E abra http://localhost:5173 — o painel placeholder deve exibir o badge de status da API.

---

## 8. Testar o fluxo completo pela API

Com a API no ar, rode em **outro terminal**. O fluxo é: a Transportadora A oferta na carga
aberta, a empresa aceita e o motorista leva a entrega até o fim.

### Dados do seed

| Registro | ID |
|---|---|
| Empresa (embarcadora) | `11111111-1111-4111-8111-111111111111` |
| Transportadora A (São Paulo) | `22222222-2222-4222-8222-222222222222` |
| Transportadora B (Guarulhos) | `22222222-2222-4222-8222-333333333333` |
| Motorista da Transportadora A | `33333333-3333-4333-8333-333333333333` |
| Motorista autônomo (Campinas) | `44444444-4444-4444-8444-444444444444` |
| Veículo da Transportadora A (`FWL1A01`) | `55555555-5555-4555-8555-555555555555` |
| Veículo do autônomo (`FWL1A03`) | `66666666-6666-4666-8666-666666666666` |
| Carga ABERTA (SP -> Campinas, R$ 3.000) | `77777777-7777-4777-8777-777777777777` |
| Oferta pendente da Transportadora B (R$ 2.750) | `88888888-8888-4888-8888-888888888888` |

Usuários: `admin@dev.local`, `operador@dev.local`, `empresa@dev.local`,
`transportadora.a@dev.local`, `transportadora.b@dev.local`, `motorista.frota@dev.local`,
`motorista.autonomo@dev.local` — todos com senha `dev12345` (só terá uso quando o login
existir).

### Roteiro

```bash
API=localhost:3001
EMPRESA=11111111-1111-4111-8111-111111111111
TRANSP_A=22222222-2222-4222-8222-222222222222
MOTORISTA=33333333-3333-4333-8333-333333333333
VEICULO=55555555-5555-4555-8555-555555555555
CARGA=77777777-7777-4777-8777-777777777777

# 1. Transportadora A vê as cargas disponíveis (raio a partir da base dela)
curl -s "$API/carriers/$TRANSP_A/available-shipments" | jq

# 2. Faz uma contraproposta já com motorista e veículo
OFERTA=$(curl -s -X POST "$API/carriers/$TRANSP_A/shipments/$CARGA/offers" \
  -H 'Content-Type: application/json' \
  -d "{\"priceProposed\": 2900, \"driverId\": \"$MOTORISTA\", \"vehicleId\": \"$VEICULO\"}" \
  | jq -r '.id')
echo "Oferta: $OFERTA"

# 3. Empresa revisa as ofertas (a da A e a da B) e aceita a da A
curl -s "$API/companies/$EMPRESA/shipments/$CARGA/offers" | jq
ENTREGA=$(curl -s -X POST "$API/companies/$EMPRESA/shipments/$CARGA/offers/$OFERTA/accept" \
  | jq -r '.id')
echo "Entrega: $ENTREGA"

# 4. Motorista vê a entrega atribuída e avança um passo por vez
curl -s "$API/drivers/$MOTORISTA/deliveries" | jq
for STATUS in COLETADO EM_TRANSITO ENTREGUE; do
  curl -s -X POST "$API/drivers/$MOTORISTA/deliveries/$ENTREGA/status" \
    -H 'Content-Type: application/json' -d "{\"status\": \"$STATUS\"}" | jq '.status'
done

# 5. Empresa vê a entrega concluída, com o histórico de eventos
curl -s "$API/companies/$EMPRESA/deliveries/$ENTREGA" | jq
```

Resultado esperado: a oferta da Transportadora B vira `CANCELADA` no aceite, a carga passa
por `ACEITA -> EM_TRANSITO -> ENTREGUE` e a entrega termina com 4 eventos em `events`.

Para repetir o roteiro, volte ao estado inicial com `npm run db:seed`.

### Casos de erro que valem testar

| Ação | Resposta esperada |
|---|---|
| Pular status (de `COLETA_PENDENTE` direto para `ENTREGUE`) | 409 — transição inválida |
| Ofertar de novo na mesma carga com uma oferta ainda `PENDENTE` | 409 |
| Ofertar numa carga depois que a oferta foi recusada | 409 |
| Ofertar com veículo de tipo/capacidade incompatível | 400 |
| Aceitar uma segunda oferta depois de uma já aceita | 409 |
| Body com campo extra ou inválido | 400 `VALIDATION_ERROR` |

Todo erro volta no formato `{ "error": { "code", "message", "requestId", "details" } }`.

---

## 9. Mobile (opcional)

```bash
npm run android --workspace=mobile   # primeira vez: gera e instala o development build
npm run dev:mobile                   # nas próximas vezes, só o Metro
```

- No emulador Android, o `localhost` da máquina é `10.0.2.2` (já é o padrão do
  `mobile/.env`). Em celular físico, troque `EXPO_PUBLIC_API_URL` pelo IP da máquina na rede.
- Hoje o app só mostra a tela de login placeholder com o status da API.
- No WSL2 o emulador costuma exigir configuração extra (rodar o emulador no Windows e
  expor o `adb`); só vale o esforço quando as telas existirem.

---

## Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe shared + API + web |
| `npm run dev:mobile` | Sobe o Metro/Expo |
| `npm run docker:up` / `docker:down` | Liga/desliga Postgres e Redis |
| `npm run db:migrate` / `db:rollback` | Aplica/desfaz migrations |
| `npm run db:seed` | Reseta os dados de desenvolvimento |
| `npm run db:status --workspace=backend` | Mostra quais migrations estão aplicadas |
| `npm run db:make --workspace=backend -- <nome>` | Cria uma migration nova |
| `npm test` | Testes unitários |
| `npm run test:integration --workspace=backend` | Testes de integração |
| `npm run lint` / `npm run format` / `npm run typecheck` | Qualidade de código |

---

## Problemas comuns

**`npm install` reclama da versão do Node (EBADENGINE)**
Você não está no Node 24. Rode `nvm use` na raiz do projeto.

**`Variáveis de ambiente inválidas` ao subir a API**
Falta o `backend/.env`. Refaça o passo 3.

**API sobe mas `/health` mostra `postgres` ou `redis` com erro**
Containers fora do ar: `npm run docker:up` e confira com `docker ps`.

**Testes de integração falham com `database "fleetworkslog_test" does not exist`**
O volume do Postgres foi criado antes do script de init. Crie o banco na mão:

```bash
docker exec -it fleetworkslog-postgres psql -U fleetworkslog -d fleetworkslog \
  -c "CREATE DATABASE fleetworkslog_test;"
docker exec -it fleetworkslog-postgres psql -U fleetworkslog -d fleetworkslog_test \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**Erro de tabela inexistente (`relation ... does not exist`)**
Migrations pendentes: `npm run db:migrate` (confira com `db:status`).

**`available-shipments` volta vazio**
A janela de coleta das cargas do seed é relativa ao momento em que ele rodou (24h a 28h
depois). Se passou disso, ou se a carga já foi aceita, rode `npm run db:seed` de novo.

**Porta já em uso**
Outro projeto está usando a porta. Ajuste `POSTGRES_PORT` / `REDIS_PORT` (Docker) ou
`PORT` (API) e atualize as URLs nos `.env`.

**Recomeçar o banco totalmente do zero**
`docker compose down -v` seguido dos passos 4 e 5. **Atenção: `-v` apaga os volumes, ou
seja, todos os dados do Postgres e do Redis deste projeto.**

---

Ver também: [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md) · [Precificação](08-precificacao.md) · [Monorepo](07-monorepo.md)
