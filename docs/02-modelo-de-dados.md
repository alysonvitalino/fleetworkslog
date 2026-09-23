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
ver abaixo). Um `user` de role `MOTORISTA` tem um `drivers` associado — **com ou sem**
vínculo a uma transportadora (ver [Motorista Autônomo](#motorista-autônomo) abaixo).
`ADMIN` e `OPERADOR` não têm perfil de domínio — só acesso à Torre de Controle.

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
  carrier_id -> companies.id (nullable)   -- null = motorista autônomo, sem transportadora
  cnh_number
  cnh_category
  phone
  status          ENUM(DISPONIVEL, EM_VIAGEM, INDISPONIVEL)
  current_position_id -> driver_positions.id (nullable, última posição conhecida)

vehicles
  id
  carrier_id -> companies.id (nullable)   -- veículo de frota de uma transportadora
  owner_driver_id -> drivers.id (nullable) -- veículo próprio de motorista autônomo
  plate
  type            ENUM(VAN, TRUCK_TOCO, TRUCK_TRUCK, CARRETA, ...)
  capacity_kg
  capacity_m3
  status          ENUM(DISPONIVEL, EM_VIAGEM, MANUTENCAO)
  -- exatamente um de carrier_id / owner_driver_id deve estar preenchido (constraint de aplicação)

driver_vehicles                    -- histórico de qual motorista dirigiu qual veículo
  id
  driver_id -> drivers.id
  vehicle_id -> vehicles.id
  started_at
  ended_at (nullable)
```

### Motorista autônomo

Um motorista pode se cadastrar na plataforma **sem** estar vinculado a nenhuma
transportadora — cadastra `cnh`, telefone e cadastra seu próprio veículo (`vehicles`
com `owner_driver_id` preenchido, `carrier_id` nulo). Faz sentido especialmente para
frete urbano/curta distância, onde é comum o próprio motorista ser o dono do veículo.

Do ponto de vista do marketplace, um motorista autônomo funciona como uma
"transportadora de um veículo só": ele mesmo oferta em `shipment_offers`
(`driver_id` preenchido diretamente, `carrier_id` nulo), sem precisar de uma camada
intermediária de empresa. Ver o impacto disso em `shipment_offers` e `ratings` abaixo, e
o fluxo completo em [Precificação](08-precificacao.md).

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
  price_offered          -- preço sugerido pela empresa, ver [Precificação](08-precificacao.md)
  status              ENUM(ABERTA, ACEITA, EM_TRANSITO, ENTREGUE, CANCELADA)
  created_at

shipment_offers                    -- ofertas/contrapropostas sobre uma carga
  id                                -- fluxo completo em [Precificação](08-precificacao.md)
  shipment_id -> shipments.id
  carrier_id -> companies.id (nullable)   -- null quando é motorista autônomo ofertando direto
  driver_id -> drivers.id
    -- transportadora: nullable até confirmar motorista
    -- motorista autônomo: preenchido desde a criação da oferta (é o próprio ofertante)
  vehicle_id -> vehicles.id (nullable até confirmar veículo)
  price_proposed                    -- = price_offered se aceite direto, diferente se contraproposta
  status              ENUM(PENDENTE, ACEITA, RECUSADA, CANCELADA)
  created_at
  -- constraint de aplicação: carrier_id nulo ⇒ driver_id obrigatório (motorista autônomo)

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

Esta é a tabela mais sensível a volume — ver o desenho completo em
[Armazenamento de GPS](05-armazenamento-gps.md).

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
  rater_company_id -> companies.id (nullable)
  rater_driver_id -> drivers.id (nullable)     -- exatamente um dos dois "rater_*" preenchido
  rated_company_id -> companies.id (nullable)
  rated_driver_id -> drivers.id (nullable)     -- exatamente um dos dois "rated_*" preenchido
  score           (1-5)
  comment
  created_at
```

Campos duplos (`*_company_id` / `*_driver_id`) porque tanto quem avalia quanto quem é
avaliado pode ser uma empresa/transportadora **ou** um motorista autônomo direto — não
existe sempre uma `company` nos dois lados da entrega.

---

Ver também: [MVP](03-mvp.md) · [Arquitetura e Decisões Técnicas](04-decisoes-em-aberto.md)
