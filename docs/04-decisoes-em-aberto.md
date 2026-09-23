# Arquitetura e Decisões em Aberto

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

## Decisões em aberto

Cada item aqui bloqueia menos do que parece — o MVP pode começar com a opção mais simples
e revisar depois. Listado por ordem de impacto na arquitetura.

### ~~Armazenamento de posições GPS~~ — decidido

Redis para posição atual + amostras esparsas do trajeto no Postgres/PostGIS (por distância,
tempo ou mudança de status). Desenho completo, chaves, critérios de amostragem e retenção
em [Armazenamento de GPS](05-armazenamento-gps.md).

### ~~Provedor de mapas~~ — decidido

Mapbox, para mapa web, mapa mobile, geocoding e directions/ETA. Comparação de custo com
MapLibre + MapTiler, trade-offs e critérios de revisão em
[Provedor de Mapas](06-provedor-de-mapas.md).

### Monorepo vs. múltiplos repositórios

Temos 3 clientes (app motorista, app empresa, painel web) + 1 backend — vale decidir se:

- Um monorepo com `backend/`, `web/`, `mobile/` (múltiplos apps RN dentro de `mobile/`,
  ou um único app RN com fluxos diferentes por role)
- App único do motorista + app único da empresa (dois projetos Expo separados) vs. um só
  app RN que muda de UI conforme o `role` do usuário logado

**Recomendação para o MVP**: um único app RN com navegação condicional por role (menos
overhead de manter 2 apps mobile separados enquanto o produto está validando o conceito).
Web (Torre de Controle) e backend em um monorepo com `backend/` e `frontend/` na raiz.

### Quem define o preço do frete

Decisão de produto, não só técnica — afeta o schema (`shipments.price_offered`,
`shipment_offers.price_proposed` já cobrem os 3 cenários abaixo):

- Empresa sugere preço, transportadora aceita ou não (mais simples)
- Transportadora oferece preço, empresa escolhe entre ofertas (mais próximo de marketplace)
- Sem preço na plataforma no MVP — combinado fora, plataforma só registra "aceito"

**Recomendação para o MVP**: campo de preço opcional, negociação fora do fluxo — evita
construir sistema de ofertas/leilão antes de validar que o marketplace tem demanda dos
dois lados.

### GPS em background (mobile)

Vai exigir tratamento específico de Android/iOS (permissões, consumo de bateria,
reconexão). Adiado para pós-MVP (ver [MVP](03-mvp.md#fora-do-escopo-do-mvp)).

---

Ver também: [Visão e Problema](01-visao-e-problema.md) · [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md)
