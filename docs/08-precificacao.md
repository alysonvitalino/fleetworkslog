# Quem Define o Preço do Frete (decidido)

## Decisão

- Empresa sugere um preço ao publicar a carga (`shipments.price_offered`)
- Transportadora **ou motorista autônomo** (ver
  [Motorista Autônomo](02-modelo-de-dados.md#motorista-autônomo)) pode **aceitar** esse
  preço ou fazer **uma contraproposta** (`shipment_offers.price_proposed`)
- Empresa **aceita ou recusa** cada proposta/contraproposta recebida
- Uma única rodada de negociação por oferta — sem contraproposta em cima de
  contraproposta (ver [Fora de escopo](#fora-de-escopo-do-mvp))

`price_offered` e `price_proposed` em [Modelo de Dados](02-modelo-de-dados.md) já cobrem
os dois valores. A única mudança de schema foi o status `RETIRADA` em `shipment_offers`.

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

Enquanto a oferta está PENDENTE, o próprio ofertante pode desistir:
   Transportadora A retira a oferta   ──▶ offer(A).status = RETIRADA

Empresa cancela a carga (só enquanto ABERTA)
   └──▶ shipment.status = CANCELADA
        todas as offers PENDENTES dessa carga → CANCELADA
```

## Quem pode ofertar de novo na mesma carga

| Última oferta do ofertante | Pode ofertar de novo? |
|---|---|
| `RECUSADA` | **Não** — a recusa encerra a negociação daquele ofertante naquela carga, mesmo que a carga seja reaberta |
| `RETIRADA` | Sim, enquanto a carga estiver `ABERTA` |
| `CANCELADA` | Sim, se a carga voltar para `ABERTA` (ex.: entrega cancelada — ver [Cancelamento de entrega](02-modelo-de-dados.md#cancelamento-de-entrega)) |

Nunca pode existir mais de uma oferta `PENDENTE` do mesmo ofertante na mesma carga.

## Oferta sem motorista/veículo definido

A transportadora pode ofertar **sem** informar motorista e veículo (`driver_id` e
`vehicle_id` nulos) — assim não precisa reservar recurso para uma carga que talvez não
ganhe. A empresa pode aceitar essa oferta normalmente; a `delivery` nasce em
`COLETA_PENDENTE` e **só pode avançar para `COLETADO` depois que a transportadora
atribuir motorista e veículo** (compatíveis com `required_vehicle_type` e capacidade da
carga). A tela de ofertas da empresa mostra quando motorista/veículo ainda não foram
definidos.

O motorista autônomo sempre oferta com `driver_id` (ele mesmo) e `vehicle_id` (veículo
próprio) preenchidos.

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
| `RECUSADA` | Empresa recusou — negociação encerrada com esse ofertante nesta carga |
| `RETIRADA` | O próprio ofertante desistiu enquanto a oferta estava PENDENTE |
| `CANCELADA` | Encerrada pelo sistema: a empresa aceitou outra oferta, cancelou a carga, ou a entrega originada por esta oferta foi cancelada |

Quando uma oferta é `ACEITA`, o backend deve, na mesma transação: marcar `shipment.status
= ACEITA`, criar a `delivery`, e mover todas as outras `shipment_offers` PENDENTES
daquela carga para `CANCELADA` (evita que duas transportadoras achem que fecharam a
mesma carga).

## Fora de escopo do MVP

- **Rodadas múltiplas de contraproposta** (transportadora contrapropor de novo depois de
  recusada, empresa contrapropor de volta) — fica como negociação de uma via só;
  oferta recusada encerra a negociação daquele ofertante naquela carga (ver
  [Quem pode ofertar de novo](#quem-pode-ofertar-de-novo-na-mesma-carga))
- **Leilão/melhor oferta automática** — empresa decide manualmente, sem ranking ou
  seleção automática por menor preço
- **Notificação em tempo real de nova oferta/contraproposta** — cai na lista de
  notificações do pós-MVP já mapeada em `init.md`

---

Ver também: [Decisões em Aberto](04-decisoes-em-aberto.md) · [Modelo de Dados](02-modelo-de-dados.md) · [MVP](03-mvp.md)
