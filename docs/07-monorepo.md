# Monorepo (decidido)

## Decisão

Um único repositório com quatro pastas na raiz — `backend/`, `web/`, `mobile/` e
`shared/` (tipos/contratos compartilhados) — e um único app React Native que muda de
fluxo/navegação conforme o `role` do usuário logado (não um app separado por perfil).

## Canal por perfil

| Perfil | Canal | O que faz lá |
|---|---|---|
| `EMPRESA` | Mobile | Publica e gerencia cargas, revisa ofertas, acompanha entregas no mapa, histórico |
| `MOTORISTA` (de transportadora) | Mobile | Entregas atribuídas, status, GPS, comprovante |
| `MOTORISTA` autônomo | Mobile | Tudo do motorista + cadastro do veículo próprio, cargas disponíveis e ofertas |
| `TRANSPORTADORA` | **Web** | Cadastro, frota (motoristas e veículos), cargas disponíveis e ofertas, atribuição de motorista/veículo, acompanhamento das entregas, histórico |
| `OPERADOR` / `ADMIN` | Web | Torre de Controle e administração |

Se um usuário `TRANSPORTADORA` fizer login no app mobile, o app mostra uma tela
orientando a usar o painel web (sem fluxo próprio no mobile). O web, por sua vez, não
tem fluxo para `EMPRESA` nem `MOTORISTA` no MVP.

## Estrutura

```
fleetworkslog/
├── backend/              # Node.js + TypeScript + Express — API REST + WebSocket
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   └── db/           # conexão Knex, migrations e seeds
│   └── package.json
│
├── web/                   # React + TypeScript — painel da transportadora + Torre de Controle
│   ├── src/
│   │   └── pages/
│   │       ├── transportadora/
│   │       └── operacao/   # Torre de Controle / admin (OPERADOR, ADMIN)
│   └── package.json
│
├── mobile/                 # React Native (Expo) + TypeScript
│   ├── src/
│   │   ├── navigation/     # navegação condicional por role
│   │   └── screens/
│   │       ├── motorista/  # inclui telas de marketplace do autônomo
│   │       └── empresa/
│   └── package.json
│
├── shared/                 # tipos e contratos compartilhados (enums, DTOs, eventos WebSocket)
│   ├── src/
│   └── package.json
│
├── docs/
├── docker-compose.yml       # PostgreSQL + Redis
├── init.md
└── package.json              # orquestração (workspaces + scripts raiz)
```

## Por que um único app mobile (não um app por perfil)

- Menos overhead de manter 2 builds/releases mobile separados enquanto o produto ainda
  está validando o conceito (MVP)
- Login único decide o fluxo — motorista cai direto na tela de entregas ativas, empresa
  cai no acompanhamento de cargas — sem duplicar telas de auth, notificações, etc.
- Custo: bundle um pouco maior (código dos dois fluxos no mesmo app) — aceitável nesse
  estágio, não é gargalo de performance real

**Revisar essa parte se**: o fluxo do motorista e o da empresa divergirem tanto (ex.
motorista precisando de recursos nativos pesados tipo background location contínuo, que
empresa não usa) que valha separar por tamanho de app/performance — nesse caso, migrar
para `mobile-motorista/` e `mobile-empresa/` é uma extração direta a partir da estrutura
de `screens/` já separada por perfil.

## Orquestração

- **npm workspaces** na raiz (`backend`, `web`, `mobile`, `shared` como workspaces) — evita
  duplicar `node_modules` de dependências compartilhadas e permite instalar tudo com um
  único `npm install` na raiz
- Scripts raiz via `concurrently` para rodar backend + web juntos em dev; mobile roda
  separado (`npm run dev --workspace=mobile`) porque o Expo já abre seu próprio terminal
  interativo (QR code, menu de dev tools) — misturar com os outros logs atrapalha

```json
// package.json (raiz) — esboço
{
  "workspaces": ["backend", "web", "mobile", "shared"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=backend\" \"npm run dev --workspace=web\"",
    "dev:mobile": "npm run start --workspace=mobile",
    "db:migrate": "npm run db:migrate --workspace=backend",
    "install:all": "npm install"
  }
}
```

## Pacote `shared/`

Enums (`Role`, `CompanyType`, `DriverStatus`, `VehicleType`, `VehicleStatus`,
`ShipmentStatus`, `OfferStatus`, `DeliveryStatus`), DTOs de request/response e tipos dos
eventos WebSocket ficam em `shared/`, consumido pelos outros três workspaces. Uma mudança
de contrato quebra a compilação em todo lugar que ficou inconsistente — é exatamente o
motivo de manter tudo num repo só na fase de MVP (ver abaixo).

Só tipos e constantes puras entram aqui — nada que dependa de Node, React ou React Native,
para o pacote funcionar nos três ambientes.

## Por que não múltiplos repositórios

- Contratos entre `backend` e `web`/`mobile` (tipos de request/response, enums de status)
  mudam junto na fase de MVP — repo único evita o custo de coordenar PRs em 3 repositórios
  para uma mudança de contrato
- Time pequeno no início — overhead de gerenciar múltiplos repos (versionamento,
  permissões, CI separado) não se paga ainda
- Nada impede quebrar em múltiplos repositórios depois, se o time crescer e as partes
  passarem a ter ciclos de deploy realmente independentes

## CI/CD

Um pipeline por pasta (`backend`, `web`, `mobile`), disparado só quando os arquivos
daquela pasta mudam (path filters) — evita rodar build/test de mobile numa mudança que
só tocou o backend, por exemplo. Mudanças em `shared/` disparam os três pipelines, já
que afetam todos os consumidores. Detalhamento fica para quando o CI for configurado
(fora do escopo deste documento de planejamento).

---

Ver também: [Decisões em Aberto](04-decisoes-em-aberto.md) · [MVP](03-mvp.md)
