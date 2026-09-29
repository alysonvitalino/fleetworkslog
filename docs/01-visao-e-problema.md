# Visão e Problema

## Visão

Plataforma de logística B2B — Um marketplace focado em
**transportadoras e frotas de caminhão** para transporte de cargas, com acompanhamento
da operação em tempo real.

Três pilares:

1. **Marketplace** — empresa publica carga, transportadora ou motorista independente aceita
2. **Gestão de Frota** — transportadora administra veículos, motoristas, disponibilidade
3. **Rastreamento em Tempo Real** — GPS do motorista, visível para empresa/cliente

## Motorista autônomo

Além de transportadoras (com frota e motoristas vinculados), um **motorista independente**
pode se cadastrar diretamente na plataforma com seu próprio veículo, sem estar ligado a
nenhuma transportadora. Ele ofertа e executa entregas como qualquer outro participante do
marketplace — é especialmente relevante para **fretes urbanos e de curta distância**, onde
é comum o motorista ser dono do próprio veículo (van, utilitário, caminhão pequeno).

Impacto direto no modelo de dados: `carrier_id` é opcional em `drivers`/`vehicles`, e
`shipment_offers` pode vir de uma transportadora **ou** diretamente de um motorista
autônomo. Detalhes em [Modelo de Dados](02-modelo-de-dados.md#motorista-autônomo).

## Modelo de negócio

**Marketplace aberto**: qualquer transportadora/motorista cadastrado na plataforma pode
visualizar e aceitar cargas publicadas por qualquer empresa (modelo tipo Uber Freight).
Não há vínculo contratual pré-existente entre empresa e transportadora — a plataforma é
quem faz o match.

Implicações dessa escolha:

- Precisa de mecanismo de **reputação/avaliação** desde cedo (empresa avaliando
  transportadora e vice-versa), já que não há relação de confiança prévia
- Precisa de critério de **matching/visibilidade de cargas** (por região, tipo de
  veículo, disponibilidade) — não é simplesmente "lista todas as cargas para todos"
- Preço: entra em jogo a questão de **quem define o preço** (empresa oferece, transportadora
  oferece, ou plataforma calcula) — ver [Decisões em Aberto](04-decisoes-em-aberto.md)

## Problema que resolve

Empresas que precisam transportar cargas hoje enfrentam:

- Dificuldade em encontrar transportadora/veículo disponível e compatível
- Falta de visibilidade da localização e status da carga
- Gestão manual de motoristas e veículos (para as transportadoras)
- Falta de histórico e comprovação de entrega centralizados

## Perfis de usuário

| Perfil | Papel | Canal |
|---|---|---|
| `EMPRESA` | Publica solicitações de transporte, acompanha entregas | Mobile |
| `TRANSPORTADORA` | Gerencia frota/motoristas, aceita cargas | Web |
| `MOTORISTA` | Executa o transporte, envia GPS, atualiza status — com ou sem vínculo a uma transportadora (o autônomo também oferta em cargas) | Mobile |
| `OPERADOR` | Opera a Torre de Controle (equipe da plataforma) | Web |
| `ADMIN` | Administração geral da plataforma | Web |

Detalhes de autorização por perfil ficam em [Modelo de Dados](02-modelo-de-dados.md#autenticação-e-perfis);
canal por perfil em [Monorepo](07-monorepo.md#canal-por-perfil).

---

Ver também: [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md) · [Arquitetura e Decisões Técnicas](04-decisoes-em-aberto.md)

Documento original (brainstorm completo): [`../init.md`](../init.md)
