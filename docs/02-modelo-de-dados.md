# Modelo de Dados

Rascunho das entidades principais. Tipos e nomes de campo em inglês (padrão de código),
nomes de entidade aqui em português só para facilitar a leitura do documento.

## Autenticação e Perfis

```
users
  id
  email
  password_hash
  role            ENUM(ADMIN, TRANSPORTADORA, MOTORISTA, EMPRESA, OPERADOR)
  created_at
  updated_at

refresh_tokens
  id
  user_id -> users.id
  token_hash
  expires_at
  revoked_at
```

Um `user` de role `TRANSPORTADORA` ou `EMPRESA` tem um perfil associado (`companies`,
ver abaixo). Um `user` de role `MOTORISTA` tem um `drivers` associado. `ADMIN` e
`OPERADOR` não têm perfil de domínio — só acesso à Torre de Controle.

## Empresas e Transportadoras

Empresa (embarcador) e transportadora podem compartilhar a mesma tabela base, já que
ambas são "pessoas jurídicas" na plataforma — diferenciadas por um campo `type`.

```
companies
  id
  user_id -> users.id
  type            ENUM(EMPRESA, TRANSPORTADORA)
  legal_name
  document        (CNPJ)
  phone
  address_json    -- ou tabela separada `addresses` se precisar de múltiplos endereços
  rating_avg
  created_at
```

> Decisão em aberto: uma tabela `companies` com `type` vs. duas tabelas separadas
> (`shippers` e `carriers`). Como ambas têm poucos campos divergentes hoje, uma tabela
> só simplifica — mas revisar se `TRANSPORTADORA` ganhar muitos campos específicos
> (frota, capacidade, certificações) que não fazem sentido para `EMPRESA`.

## Motoristas e Veículos

```
drivers
  id
  user_id -> users.id
  carrier_id -> companies.id      -- transportadora à qual pertence
  cnh_number
  cnh_category
  phone
  status          ENUM(DISPONIVEL, EM_VIAGEM, INDISPONIVEL)
  current_position_id -> driver_positions.id (nullable, última posição conhecida)

vehicles
  id
  carrier_id -> companies.id
  plate
  type            ENUM(VAN, TRUCK_TOCO, TRUCK_TRUCK, CARRETA, ...)
  capacity_kg
  capacity_m3
  status          ENUM(DISPONIVEL, EM_VIAGEM, MANUTENCAO)

driver_vehicles                    -- histórico de qual motorista dirigiu qual veículo
  id
  driver_id -> drivers.id
  vehicle_id -> vehicles.id
  started_at
  ended_at (nullable)
```

## Cargas e Transporte

```
shipments                          -- a "solicitação de transporte" publicada pela empresa
  id
  shipper_id -> companies.id       -- empresa que solicitou
  origin_address
  origin_geo          GEOGRAPHY(Point, 4326)   -- PostGIS
  destination_address
  destination_geo     GEOGRAPHY(Point, 4326)
  cargo_type
  weight_kg
  volume_m3
  required_vehicle_type
  pickup_window_start
  pickup_window_end
  delivery_deadline
  special_requirements  (text/json)
  price_offered          (nullable — empresa pode ou não sugerir preço)
  status              ENUM(ABERTA, ACEITA, EM_TRANSITO, ENTREGUE, CANCELADA)
  created_at

shipment_offers                    -- ofertas/aceites de transportadora sobre uma carga
  id
  shipment_id -> shipments.id
  carrier_id -> companies.id
  driver_id -> drivers.id (nullable até confirmar motorista)
  vehicle_id -> vehicles.id (nullable até confirmar veículo)
  price_proposed
  status              ENUM(PENDENTE, ACEITA, RECUSADA, CANCELADA)
  created_at

deliveries                         -- 1:1 com shipment quando offer é aceita
  id
  shipment_id -> shipments.id
  offer_id -> shipment_offers.id
  status              ENUM(COLETA_PENDENTE, COLETADO, EM_TRANSITO, ENTREGUE, ATRASADO, CANCELADO)
  picked_up_at
  delivered_at
  proof_of_delivery_url    -- foto/assinatura
  created_at

delivery_status_events              -- histórico de mudanças de status (auditoria)
  id
  delivery_id -> deliveries.id
  status
  note
  created_by -> users.id
  created_at
```

## Posições GPS

Esta é a tabela mais sensível a volume — ver a discussão de escala em
[Decisões em Aberto](04-decisoes-em-aberto.md#armazenamento-de-posições-gps).

```
driver_positions                    -- histórico bruto (pode virar tabela particionada/TTL)
  id
  driver_id -> drivers.id
  delivery_id -> deliveries.id (nullable — nem toda posição está ligada a uma entrega ativa)
  position     GEOGRAPHY(Point, 4326)
  speed
  heading
  recorded_at

-- posição atual fica em Redis (chave por driver_id), não é lida do Postgres em tempo real
```

## Avaliações

```
ratings
  id
  delivery_id -> deliveries.id
  rater_company_id -> companies.id   -- quem avalia
  rated_company_id -> companies.id   -- quem é avaliado
  score           (1-5)
  comment
  created_at
```

---

Ver também: [MVP](03-mvp.md) · [Arquitetura](04-arquitetura.md)
