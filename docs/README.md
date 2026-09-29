# Documentação — fleetworkslog

Projeto em fase de planejamento. Documentação organizada em:

1. [Visão e Problema](01-visao-e-problema.md) — o que é, para quem, modelo de negócio
2. [Modelo de Dados](02-modelo-de-dados.md) — entidades principais (rascunho)
3. [MVP](03-mvp.md) — escopo do primeiro entregável, dentro e fora
4. [Arquitetura e Decisões Técnicas](04-decisoes-em-aberto.md) — stack, decisões fechadas e decisões pendentes
5. [Armazenamento de GPS](05-armazenamento-gps.md) — Redis + amostragem no Postgres
6. [Provedor de Mapas](06-provedor-de-mapas.md) — Mapbox
7. [Monorepo](07-monorepo.md) — `backend/` + `web/` + `mobile/` + `shared/`, npm workspaces, app RN único, canal por perfil
8. [Precificação](08-precificacao.md) — empresa sugere, transportadora aceita ou contrapropõe, empresa decide
9. [GPS em Background](09-gps-background.md) — `expo-location`, revisar pós-validação

O brainstorm original e completo (visão expandida, evolução do produto, todos os pilares
detalhados) continua em [`../init.md`](../init.md) — os documentos acima são um recorte
estruturado e mais enxuto, focado em decisões acionáveis.
