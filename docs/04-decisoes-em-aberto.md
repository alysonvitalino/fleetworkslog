# Arquitetura e Decisões Técnicas

## Stack (confirmada)

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + TypeScript |
| Web (transportadora + Torre de Controle) | React + TypeScript |
| Backend | Node.js + TypeScript + Express |
| Migrations / query builder | Knex (migrations com up/down, SQL próximo do cru para PostGIS) |
| API | REST |
| Tempo real | WebSocket / Socket.IO |
| Banco | PostgreSQL + PostGIS |
| Cache / pub-sub | Redis |
| Auth | JWT + Refresh Token |
| Infra local | Docker |

TypeScript em todas as camadas, incluindo o backend.

## Decisões técnicas

As decisões desta seção já foram fechadas — o detalhamento completo de cada uma está no
documento linkado. As que ainda faltam estão em [Decisões pendentes](#decisões-pendentes).

### ~~Armazenamento de posições GPS~~ — decidido

Redis para posição atual + amostras esparsas do trajeto no Postgres/PostGIS (por distância,
tempo ou mudança de status). Desenho completo, chaves, critérios de amostragem e retenção
em [Armazenamento de GPS](05-armazenamento-gps.md).

### ~~Provedor de mapas~~ — decidido

Mapbox, para mapa web, mapa mobile, geocoding e directions/ETA. Comparação de custo com
MapLibre + MapTiler, trade-offs e critérios de revisão em
[Provedor de Mapas](06-provedor-de-mapas.md).

### ~~Monorepo vs. múltiplos repositórios~~ — decidido

Monorepo com `backend/`, `web/`, `mobile/` e `shared/` (tipos/contratos) na raiz e npm
workspaces; um único app RN com navegação condicional por role (não um app por perfil).
Estrutura completa, scripts de orquestração e critérios de revisão em
[Monorepo](07-monorepo.md).

### ~~Canal de cada perfil~~ — decidido

`EMPRESA` e `MOTORISTA` (inclusive autônomo) usam o app mobile; `TRANSPORTADORA`,
`OPERADOR` e `ADMIN` usam o painel web. Tabela completa em
[Monorepo — Canal por perfil](07-monorepo.md#canal-por-perfil).

### ~~Express + Knex no backend~~ — decidido

Express pela simplicidade e aderência à estrutura `routes/` → `controllers/` →
`services/` → `models/`; Knex porque as migrations têm up/down e o SQL fica próximo do
cru, o que facilita PostGIS (`GEOGRAPHY`, `ST_DWithin`, índices GIST) sem brigar com um
ORM.

### ~~Quem define o preço do frete~~ — decidido

Empresa sugere o preço; transportadora aceita ou contrapropõe (uma rodada); empresa
aceita ou recusa. Fluxo completo, estados de `shipment_offers` (incluindo `RETIRADA`),
quem pode ofertar de novo, oferta sem motorista/veículo definido e regra de cancelamento
automático de ofertas concorrentes em [Precificação](08-precificacao.md).

### ~~Atraso e cancelamento de entrega~~ — decidido

Atraso é flag (`deliveries.is_late`), não status. Entrega cancelada devolve a carga para
`ABERTA`. Detalhes em [Modelo de Dados](02-modelo-de-dados.md#atraso-é-flag-não-status).

### ~~GPS em background~~ — decidido

`expo-location` + `expo-task-manager` para a fase de validação; migrar para
`react-native-background-geolocation` (pago) se passar dessa fase ou se a confiabilidade
em Android se mostrar insuficiente antes disso. Detalhes e critérios de revisão em
[GPS em Background](09-gps-background.md). Feature em si fica fora do MVP
(ver [MVP](03-mvp.md#fora-do-escopo-do-mvp)).

### ~~`companies` única vs. tabelas separadas~~ — decidido

Uma tabela `companies` com `type` (`EMPRESA` / `TRANSPORTADORA`): hoje só `base_geo`
diverge entre os dois, e a regra "obrigatório para transportadora" fica num `CHECK` do
banco. Revisar se a transportadora ganhar muitos campos próprios (frota, certificações).
Ver [Modelo de Dados](02-modelo-de-dados.md#empresas-e-transportadoras).

## Decisões pendentes

Ainda não fechadas — precisam de decisão antes (ou durante) a task indicada:

| Decisão | Bloqueia | Observação |
|---|---|---|
| Hospedagem do staging (backend com WebSocket, web, Postgres+PostGIS, Redis) | Provisionamento de staging | Precisa suportar conexões WebSocket persistentes e extensão PostGIS |
| Storage de arquivos (comprovante de entrega) | Comprovante de entrega | S3 compatível com URL assinada |
| Provedor de e-mail transacional | Convite de motorista, recuperação de senha | — |
| Tratamento de dados pessoais (LGPD) | Piloto com usuários reais | GPS, CNH, CPF — consentimento, acesso, retenção e exclusão |

---

Ver também: [Visão e Problema](01-visao-e-problema.md) · [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md)
