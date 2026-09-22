# Visão e Problema

## Visão

Plataforma de logística B2B — não um "Uber genérico", mas um marketplace focado em
**transportadoras e frotas de caminhão** para transporte de cargas, com acompanhamento
da operação em tempo real.

Três pilares:

1. **Marketplace** — empresa publica carga, transportadora/motorista aceita
2. **Gestão de Frota** — transportadora administra veículos, motoristas, disponibilidade
3. **Rastreamento em Tempo Real** — GPS do motorista, visível para empresa/cliente

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

| Perfil | Papel |
|---|---|
| `EMPRESA` | Publica solicitações de transporte, acompanha entregas |
| `TRANSPORTADORA` | Gerencia frota/motoristas, aceita cargas |
| `MOTORISTA` | Executa o transporte, envia GPS, atualiza status |
| `OPERADOR` | Opera a Torre de Controle (equipe da plataforma) |
| `ADMIN` | Administração geral da plataforma |

Detalhes de autorização por perfil ficam em [Modelo de Dados](02-modelo-de-dados.md#autenticação-e-perfis).

---

Ver também: [MVP](03-mvp.md) · [Modelo de Dados](02-modelo-de-dados.md) · [Arquitetura](04-arquitetura.md)

Documento original (brainstorm completo): [`../init.md`](../init.md)
