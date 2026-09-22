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

Segue o padrão dos demais projetos do workspace (ver `~/Desktop/developer/CLAUDE.md`).
Diferente de `cria`/`map-creator` (JS puro), este projeto propõe TypeScript no backend —
alinhar se esse é o padrão desejado para o fleetworkslog especificamente.

## Decisões em aberto

Cada item aqui bloqueia menos do que parece — o MVP pode começar com a opção mais simples
e revisar depois. Listado por ordem de impacto na arquitetura.

### Armazenamento de posições GPS

**Problema**: se cada veículo envia posição a cada poucos segundos, salvar cada ping como
linha permanente no Postgres não escala (10k veículos = volume de escrita alto e histórico
que cresce indefinidamente).

**Opções**:
- Redis guarda só a **última posição** por motorista (chave `driver:{id}:position`, TTL
  curto); Postgres/PostGIS guarda só amostras esparsas do trajeto (ex: 1 a cada N metros
  ou minutos) para histórico de rota
- Buffer em memória/Redis + batch write periódico no Postgres (menos granularidade em
  tempo real de histórico, mais barato)
- Tabela `driver_positions` particionada por data + job de limpeza/agregação (rollup) após
  X dias

**Recomendação para o MVP**: Redis para posição atual (é o que a UI em tempo real consome)
+ grava no Postgres só em pontos-chave (coleta, mudança de status, a cada N minutos) — não
precisa da solução de escala definitiva agora, só não pode ser "salvar tudo pra sempre sem
critério".

### Provedor de mapas

**Opções**: Mapbox, MapLibre (open-source, self-hostable), Google Maps.

**Trade-offs**:
- Google Maps: melhor geocoding/dados no Brasil, mas custo escala com uso e tem cobrança
  por chamada de API mais agressiva
- Mapbox: bom equilíbrio, pricing mais previsível, boa SDK para React Native
- MapLibre: sem custo de licença, mas exige mais trabalho de setup (tiles, geocoding
  precisa de provedor à parte)

**Recomendação para o MVP**: Mapbox — SDK madura para RN e web, evita lock-in do Google,
custo controlável nesse estágio. Reavaliar se o volume de geocoding crescer muito.

### Monorepo vs. múltiplos repositórios

Os projetos existentes (`map-creator`, `cria`) usam monorepo com `backend/` e `frontend/`
na raiz. Aqui temos 3 clientes (app motorista, app empresa, painel web) + 1 backend —
vale decidir se:

- Um monorepo com `backend/`, `web/`, `mobile/` (múltiplos apps RN dentro de `mobile/`,
  ou um único app RN com fluxos diferentes por role)
- App único do motorista + app único da empresa (dois projetos Expo separados) vs. um só
  app RN que muda de UI conforme o `role` do usuário logado

**Recomendação para o MVP**: um único app RN com navegação condicional por role (menos
overhead de manter 2 apps mobile separados enquanto o produto está validando o conceito).
Web (Torre de Controle) e backend seguem o padrão monorepo já usado no workspace.

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
reconexão). Adiado para pós-MVP (ver [MVP](03-mvp.md#fora-do-escopo-do-mvp)) — quando for
implementar, consultar a skill `react-native` do workspace para padrões de integração
nativa.

---

Ver também: [Visão e Problema](01-visao-e-problema.md) · [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md)
