# Arquitetura e Decisões Técnicas

## Stack (confirmada)

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + TypeScript |
| Web (Torre de Controle) | React + TypeScript |
| Backend | Node.js + TypeScript |
| API | REST |
| Tempo real | WebSocket / Socket.IO |
| Banco | PostgreSQL + PostGIS |
| Cache / pub-sub | Redis |
| Auth | JWT + Refresh Token |
| Infra local | Docker |

TypeScript em todas as camadas, incluindo o backend.

## Decisões técnicas

Todas as decisões abaixo já foram fechadas — o detalhamento completo de cada uma está no
documento linkado. Listado por ordem de impacto na arquitetura.

### ~~Armazenamento de posições GPS~~ — decidido

Redis para posição atual + amostras esparsas do trajeto no Postgres/PostGIS (por distância,
tempo ou mudança de status). Desenho completo, chaves, critérios de amostragem e retenção
em [Armazenamento de GPS](05-armazenamento-gps.md).

### ~~Provedor de mapas~~ — decidido

Mapbox, para mapa web, mapa mobile, geocoding e directions/ETA. Comparação de custo com
MapLibre + MapTiler, trade-offs e critérios de revisão em
[Provedor de Mapas](06-provedor-de-mapas.md).

### ~~Monorepo vs. múltiplos repositórios~~ — decidido

Monorepo com `backend/`, `web/`, `mobile/` na raiz e npm workspaces; um único app RN com
navegação condicional por role (não um app por perfil). Estrutura completa, scripts de
orquestração e critérios de revisão em [Monorepo](07-monorepo.md).

### ~~Quem define o preço do frete~~ — decidido

Empresa sugere o preço; transportadora aceita ou contrapropõe (uma rodada); empresa
aceita ou recusa. Fluxo completo, estados de `shipment_offers` e regra de cancelamento
automático de ofertas concorrentes em [Precificação](08-precificacao.md).

### ~~GPS em background~~ — decidido

`expo-location` + `expo-task-manager` para a fase de validação; migrar para
`react-native-background-geolocation` (pago) se passar dessa fase ou se a confiabilidade
em Android se mostrar insuficiente antes disso. Detalhes e critérios de revisão em
[GPS em Background](09-gps-background.md). Feature em si fica fora do MVP
(ver [MVP](03-mvp.md#fora-do-escopo-do-mvp)).

---

Ver também: [Visão e Problema](01-visao-e-problema.md) · [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md)
