# MVP

## Objetivo do MVP

Validar o loop central: **empresa publica carga → transportadora aceita → motorista
transporta com GPS → empresa acompanha → entrega é confirmada**. Nada de precificação
automática, roteirização, pagamentos ou app polido — só provar que o fluxo funciona
ponta a ponta com dados reais.

## Escopo (dentro do MVP)

1. Cadastro de empresa (embarcador)
2. Cadastro de transportadora
3. Cadastro de motorista (vinculado a uma transportadora)
4. Cadastro de veículo (vinculado a uma transportadora)
5. Empresa publica solicitação de transporte (`shipments`)
6. Transportadora visualiza cargas disponíveis e aceita uma (`shipment_offers` → `deliveries`)
7. App do motorista envia GPS em foreground (background fica para depois — ver
   [fora do escopo](#fora-do-escopo-do-mvp))
8. Empresa visualiza a carga no mapa em tempo real (WebSocket)
9. Motorista atualiza status manualmente (coletado / em trânsito / entregue)
10. Comprovante de entrega simples (foto ou assinatura, upload único)
11. Histórico básico de entregas (lista, sem filtros avançados)

### Critérios de aceite (Definition of Done do MVP)

- Uma empresa consegue publicar uma carga sem intervenção manual no banco
- Uma transportadora consegue ver a carga e aceitá-la
- Um motorista consegue abrir o app, ver a entrega atribuída e enviar posição GPS
- A empresa vê a posição do motorista se atualizar no mapa em no máximo ~10-15s de delay
- O fluxo completo (publicar → aceitar → transportar → entregar) funciona sem erro em
  ambiente de staging com pelo menos 1 empresa, 1 transportadora, 1 motorista reais (não mock)

## Fora do escopo do MVP

Explicitamente adiado — não é "esquecido", é decisão consciente para não inflar o MVP:

- **GPS em background** (app minimizado/bloqueado) — MVP roda com app aberto
- **Precificação automática / cotação** — preço é combinado fora da plataforma ou campo livre
- **Negociação de preço dentro do app** — aceite é binário (aceita ou não)
- **Roteirização / otimização de rota**
- **Geofencing e alertas automáticos de atraso**
- **Pagamentos** (Stripe ou qualquer gateway)
- **Notificações push**
- **Avaliação de parceiros** (rating) — schema existe, UI fica para depois
- **Torre de Controle completa** — MVP pode ter só uma tela simples de "lista de entregas
  ativas", não o painel com mapa consolidado de toda a frota
- **Múltiplos veículos/motoristas por entrega, sub-contratação**
- **Integrações com ERP/sistemas de transportadora**

## Depois do MVP (não priorizado ainda)

Ver `init.md` seção "Evolução do Produto" para a lista completa de ideias futuras —
não vale re-priorizar isso agora, só decidir quando o MVP validar o loop principal.

---

Ver também: [Modelo de Dados](02-modelo-de-dados.md) · [Arquitetura](04-arquitetura.md)
