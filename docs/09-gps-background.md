# GPS em Background (decidido)

Adiado para pós-MVP (ver [MVP](03-mvp.md#fora-do-escopo-do-mvp)) — este documento fecha
a decisão de **qual solução usar quando essa feature for construída**, não muda o escopo
do MVP em si.

## Decisão

`expo-location` + `expo-task-manager` — gratuito, nativo do ecossistema Expo já
escolhido para o mobile (ver [Monorepo](07-monorepo.md)).

## Como funciona

- `startLocationUpdatesAsync` + task registrada via `expo-task-manager` para receber
  posições mesmo com o app em background
- Funciona em development/production build (não funciona no Expo Go, mas isso não é
  problema — o app final é sempre uma build própria)
- Geofencing disponível via `startGeofencingAsync` (até 100 regiões no Android, 20 no
  iOS) — útil para pós-MVP quando entrar alerta de chegada/atraso

## Limitações conhecidas (aceitas para este estágio)

- **Android**: se o usuário forçar o encerramento do app (não apenas minimizar), o
  tracking não reinicia sozinho por evento de localização — comportamento varia por
  fabricante
- **Sem inteligência de movimento**: ao contrário de soluções especializadas, não reduz
  frequência de GPS automaticamente quando o veículo está parado — impacto maior em
  consumo de bateria em trajetos longos com paradas
- Ambas exigem "Always" permission no iOS e permissão de localização em background no
  Android, solicitadas em etapas (foreground primeiro, background só quando o motorista
  ativa o modo "em viagem" — não no primeiro login)

## Alternativa avaliada e descartada por ora: `react-native-background-geolocation`

SDK pago (Transistorsoft, plano Starter $399 — licença perpétua, 1 app key, 1 ano de
updates) com detecção de movimento por sensores (acelerômetro/giroscópio) que liga/desliga
o GPS automaticamente e é mais robusto contra o processo ser morto pelo Android. É a
solução mais usada por apps de entrega/frota em produção.

**Por que não agora**: o app está em fase de validação de produto — antes de pagar por
uma SDK especializada em confiabilidade de bateria/background, faz sentido confirmar que
o modelo de negócio (marketplace aberto de cargas) tem tração real. `expo-location`
resolve o suficiente para validar o fluxo com um grupo piloto de motoristas.

## Revisar quando

- O produto passar da fase de validação (tração real de empresas + transportadoras
  usando o marketplace)
- Ou antes disso, se em piloto o comportamento do `expo-location` em Android se mostrar
  não-confiável o bastante (motoristas "somem" do mapa com frequência) — nesse caso a
  migração para `react-native-background-geolocation` deve ser antecipada
  independentemente do estágio de validação de negócio

---

Ver também: [Decisões em Aberto](04-decisoes-em-aberto.md) · [MVP](03-mvp.md)
