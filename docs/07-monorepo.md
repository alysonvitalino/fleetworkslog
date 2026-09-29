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
├── mobile/                 # React Native (Expo SDK 57 + Expo Router) + TypeScript
│   ├── src/
│   │   ├── app/            # rotas (Expo Router): cada arquivo é uma tela
│   │   │   ├── index.tsx   # redireciona conforme o role logado
│   │   │   ├── motorista/  # inclui telas de marketplace do autônomo
│   │   │   └── empresa/
│   │   ├── components/
│   │   ├── features/       # lógica por domínio (sessão, health, ...)
│   │   └── lib/            # cliente HTTP, env, armazenamento seguro de tokens
│   └── package.json
│
├── shared/                 # tipos e contratos compartilhados (enums, DTOs, eventos WebSocket)
│   ├── src/
│   └── package.json
│
├── docs/
├── docker-compose.yml       # PostgreSQL + PostGIS + Redis
├── init.md
└── package.json              # orquestração (workspaces + scripts raiz)
```

### Navegação do mobile: Expo Router

Decidido usar **Expo Router** (padrão atual do Expo) em vez de React Navigation manual.
As áreas de cada perfil são pastas reais (`motorista/`, `empresa/`) — não grupos
`(motorista)`, porque dois `index` em grupos diferentes resolveriam para a mesma URL `/`.
A rota `index.tsx` decide para onde mandar o usuário pelo role; perfis que não usam o app
(TRANSPORTADORA, OPERADOR, ADMIN) caem em `usar-painel-web`.

### Uma única versão de React no monorepo

O Expo SDK fixa a versão do React (hoje `19.2.3`). O `package.json` raiz tem `overrides`
de `react`/`react-dom` nessa versão para impedir que web e mobile instalem cópias
diferentes — duas cópias do React quebram os hooks em runtime. Consequência: o web usa
React Router 7 (o 8 exige `react-dom >= 19.2.7`). **Ao atualizar o SDK do Expo, atualizar
o `overrides` junto.**

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
