# Provedor de Mapas (decidido)

## Decisão

**Mapbox** — para mapa web (Torre de Controle), mapa mobile (apps motorista/empresa),
geocoding (conversão endereço ↔ coordenada) e directions/ETA.

## Por quê

Custo é equivalente ao MapLibre + MapTiler na fase de MVP/piloto (ambos ficam dentro do
free tier), mas a estrutura de preço do Mapbox escala melhor conforme o volume cresce, e
a SDK é mais madura para React Native — reduz risco de implementação nos apps mobile.

## Comparação de preços (levantada em 2026-09)

As unidades de cobrança são diferentes entre os dois — não é comparação direta. Mapbox
cobra por "map load" (web) e "MAU" (mobile); MapTiler cobra por "sessão" (carregar +
interagir com o mapa conta como 1 sessão).

**Mapbox** (pay-as-you-go, sem assinatura fixa):

| Produto | Free tier | Acima disso |
|---|---|---|
| Mapa web (GL JS) | 50.000 loads/mês | $5,00/1k (50k–100k), cai para ~$3/1k acima de 200k |
| Mapa mobile (SDK iOS/Android) | 25.000 MAU/mês | $4,00/1k MAU |
| Geocoding | 100.000 requests/mês | $0,75/1k |
| Directions (rota/ETA) | 100.000 requests/mês | $2,00/1k |

**MapLibre + MapTiler Cloud** (assinatura + overage):

| Plano | Preço base | Inclui | Overage |
|---|---|---|---|
| Free | $0 | 5.000 sessões/mês, 1.000 sessões de busca, 100k API requests | não comercial |
| Flex | $30/mês | 25.000 sessões/mês, 3.000 sessões de busca, 500k API requests | $2,50/1k sessão, $0,15/1k API request |
| Unlimited | ~$295/mês | ~100.000 sessões/mês | — |

Fontes: [Mapbox Pricing](https://www.mapbox.com/pricing) ·
[Mapbox — Pricing by products](https://docs.mapbox.com/accounts/guides/pricing/) ·
[MapTiler Cloud Pricing](https://www.maptiler.com/cloud/pricing/) ·
[MapTiler — Geocoding with Predictable Pricing](https://www.maptiler.com/news/2026/06/geocoding-with-predictable-pricing/)

### Leitura por estágio

**MVP/piloto** (dezenas de motoristas, centenas de cargas/mês): custo é ~$0 nos dois —
free tier do Mapbox (50k web loads + 25k MAU + 100k geocoding) e o Flex de $30 do
MapTiler cobrem tranquilamente esse volume. Custo não é o critério decisivo aqui.

**Em escala** (milhares de motoristas ativos, dezenas de milhares de loads no painel web):
- Mapbox tem tiers de volume que baixam o preço por unidade; MAU mobile é bem mais barato
  que "load" — motoristas ativos custam pouco mesmo gerando muitos pings de GPS
- MapTiler no Flex fica caro rápido em overage ($2,50/1k sessão é ~50% mais caro que o
  Mapbox web load nas faixas médias); o salto para o Unlimited ($295) é um degrau, não
  gradual
- MapTiler tem uma restrição relevante: **não permite guardar/reusar resultado de
  geocoding permanentemente** — geocodificar o mesmo endereço de novo (comum, endereços
  de empresas cadastradas se repetem) cobra de novo toda vez, diferente de cachear
  localmente como o Mapbox permite

## Alternativa descartada: self-host (MapLibre + tiles OSM próprios)

MapLibre + tiles self-hosted (TileServer GL/Protomaps) + Nominatim self-hosted para
geocoding tem custo de uso zero, mas exige operar mais um serviço (cache de tiles,
atualização de dados OSM, manutenção). Descartado para o MVP — só compensaria se a equipe
já tivesse apetite/capacidade de operar essa infra desde o início, o que não é o caso.

## Revisar quando

- Volume de uso real se aproximar dos limites de free tier em produção
- Necessidade de customização visual do mapa muito específica (tiles próprios) que
  justifique o self-host

---

Ver também: [Decisões em Aberto](04-decisoes-em-aberto.md) · [Armazenamento de GPS](05-armazenamento-gps.md) · [Monorepo](07-monorepo.md)
