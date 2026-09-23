# Quem Define o Preço do Frete (decidido)

## Decisão

- Empresa sugere um preço ao publicar a carga (`shipments.price_offered`)
- Transportadora **ou motorista autônomo** (ver
  [Motorista Autônomo](02-modelo-de-dados.md#motorista-autônomo)) pode **aceitar** esse
  preço ou fazer **uma contraproposta** (`shipment_offers.price_proposed`)
- Empresa **aceita ou recusa** cada proposta/contraproposta recebida
- Uma única rodada de negociação por oferta — sem contraproposta em cima de
  contraproposta (ver [Fora de escopo](#fora-de-escopo-do-mvp))

Não exige mudança de schema em relação ao que já foi desenhado em
[Modelo de Dados](02-modelo-de-dados.md) — `price_offered` e `price_proposed` já cobrem
os dois valores. O que faltava era formalizar o fluxo e os estados.

## Fluxo

```
Empresa publica shipment
   │  price_offered = R$ X
   ▼
Transportadora A vê a carga
   │
   ├── Aceita R$ X                    ──▶ shipment_offers { price_proposed: X,  status: PENDENTE }
   └── Contrapropõe R$ Y              ──▶ shipment_offers { price_proposed: Y,  status: PENDENTE }

(Transportadora B, motorista autônomo C... podem fazer o mesmo, em paralelo, na mesma carga)

Empresa revisa as ofertas recebidas (pode ter várias, de transportadoras diferentes)
   │
   ├── Aceita a oferta de A           ──▶ offer(A).status = ACEITA
   │                                       shipment.status = ACEITA
   │                                       todas as outras offers dessa carga → CANCELADA
   │
   └── Recusa a oferta de A           ──▶ offer(A).status = RECUSADA
                                            (negociação com A encerrada nesta carga —
                                             sem nova contraproposta)
```

## Por que revisão manual, não "primeiro que aceitar leva"

Como o marketplace é aberto (qualquer transportadora ou motorista autônomo cadastrado vê
a carga — ver [Visão e Problema](01-visao-e-problema.md#modelo-de-negócio)), duas
abordagens eram possíveis:

- **Corrida** (tipo Uber): primeiro a aceitar no preço listado leva a carga
  automaticamente
- **Revisão** (escolhida): empresa vê todas as ofertas/contrapropostas recebidas — de
  transportadoras e/ou motoristas autônomos — e decide qual aceitar

A decisão de permitir contraproposta já empurra para o modelo de revisão — não dá pra
"correr para aceitar" e ao mesmo tempo negociar preço. Então mesmo quem aceita o preço
listado (sem contrapropor) entra na fila de ofertas pendentes até a empresa confirmar, em
vez de fechar o negócio instantaneamente. Isso também dá à empresa a chance de comparar,
se mais de um interessado topar a mesma carga.

## Estados de `shipment_offers.status`

| Status | Significado |
|---|---|
| `PENDENTE` | Oferta/contraproposta enviada, aguardando decisão da empresa |
| `ACEITA` | Empresa aceitou — vira uma `delivery` |
| `RECUSADA` | Empresa recusou — negociação encerrada para esta oferta |
| `CANCELADA` | Oferta perdeu validade porque a empresa aceitou outra transportadora para a mesma carga |

Quando uma oferta é `ACEITA`, o backend deve, na mesma transação: marcar `shipment.status
= ACEITA`, criar a `delivery`, e mover todas as outras `shipment_offers` PENDENTES
daquela carga para `CANCELADA` (evita que duas transportadoras achem que fecharam a
mesma carga).

## Fora de escopo do MVP

- **Rodadas múltiplas de contraproposta** (transportadora contrapropor de novo depois de
  recusada, empresa contrapropor de volta) — fica como negociação de uma via só;
  se travar, as partes negociam fora da plataforma e a transportadora publica nova oferta
  se quiser tentar de novo
- **Leilão/melhor oferta automática** — empresa decide manualmente, sem ranking ou
  seleção automática por menor preço
- **Notificação em tempo real de nova oferta/contraproposta** — cai na lista de
  notificações do pós-MVP já mapeada em `init.md`

---

Ver também: [Decisões em Aberto](04-decisoes-em-aberto.md) · [Modelo de Dados](02-modelo-de-dados.md) · [MVP](03-mvp.md)
