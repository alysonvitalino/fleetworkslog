# Armazenamento de Posições GPS (decidido)

## Decisão

- **Redis** guarda a posição atual de cada motorista (leitura em tempo real)
- **PostgreSQL/PostGIS** guarda apenas **amostras esparsas** do trajeto, não cada ping
  recebido — suficiente para reconstruir a rota percorrida sem crescer indefinidamente

## Fluxo

```
App Motorista
    │  GPS a cada ~5s (via WebSocket)
    ▼
Backend
    │
    ├──▶ Redis: SET driver:{driver_id}:position  (sempre sobrescreve, TTL curto)
    │         └──▶ Pub/Sub: publica em driver:{driver_id}:position:updates
    │                   └──▶ clientes conectados (empresa/torre de controle) recebem via WebSocket
    │
    └──▶ avalia critério de amostragem (ver abaixo)
              └── se atende → INSERT em driver_positions (Postgres)
```

## Redis — posição atual

```
Chave:   driver:{driver_id}:position
Valor:   { lat, lng, speed, heading, recorded_at, delivery_id }
TTL:     ~2-5 min (sem atualização nesse intervalo = motorista considerado offline)
```

Pub/Sub separado (`driver:{driver_id}:position:updates`) para distribuir a atualização a
todas as instâncias do backend que tenham clientes WebSocket conectados assistindo aquela
entrega — necessário porque o servidor que recebe o GPS do motorista pode não ser o mesmo
que tem a conexão WebSocket aberta com a empresa acompanhando aquela carga.

## Postgres — amostragem do trajeto

Só grava uma linha em `driver_positions` quando **qualquer um** dos critérios abaixo for
verdadeiro (o que vier primeiro), comparado com a última amostra salva:

| Critério | Valor inicial sugerido | Motivo |
|---|---|---|
| Distância desde a última amostra salva | ≥ 150m | Garante granularidade suficiente pra desenhar a rota no mapa |
| Tempo desde a última amostra salva | ≥ 60s | Garante que trajetos parados/lentos (trânsito, parada) ainda gerem pontos |
| Evento de mudança de status | sempre | Coleta, início de trânsito, atraso detectado, entrega — pontos que importam para auditoria |

Esses valores são ponto de partida, não definitivos — ajustar depois de observar volume
real e qualidade da rota reconstruída no MVP.

**Implementação prática**: guardar a última amostra salva (lat/lng + timestamp) também em
Redis (`driver:{driver_id}:last_sample`), para não precisar consultar o Postgres a cada
ping só pra decidir se amostra ou não.

**Escopo de gravação**: só grava amostra em `driver_positions` quando o motorista está
com uma `delivery_id` ativa vinculada. Fora de uma entrega em andamento, só a posição
atual em Redis é mantida (não há necessidade de histórico de GPS de motorista ocioso).

## Retenção

- `driver_positions` de uma entrega concluída: manter por um período de auditoria/disputa
  (sugestão inicial: 90 dias) antes de arquivar ou remover
- Não é preciso implementar rotina de limpeza automática no MVP — só não pode ser
  "guardar para sempre sem plano". Job de retenção entra como item de infraestrutura
  pós-MVP.

## Por que essa abordagem e não as alternativas

- **Salvar cada ping no Postgres**: descartado — volume de escrita cresce linear com
  número de veículos ativos × frequência de ping, sem ganho real de precisão pro caso de
  uso (ninguém precisa de posição a cada 5s no histórico, só em tempo real)
- **Buffer + batch write periódico**: mais complexo de operar (fila, worker) para um
  ganho marginal sobre amostragem por distância/tempo — fica como possível otimização
  futura se o volume de escrita justificar
- **Tabela particionada por data desde o início**: prematuro para o MVP — reavaliar
  quando o volume de `driver_positions` justificar particionamento

---

Ver também: [Decisões em Aberto](04-decisoes-em-aberto.md) · [Modelo de Dados](02-modelo-de-dados.md)
