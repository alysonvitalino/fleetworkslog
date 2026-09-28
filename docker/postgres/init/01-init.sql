-- Executado apenas na primeira criação do volume do Postgres.
-- Habilita o PostGIS no banco principal e cria o banco usado pelos testes de integração.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE DATABASE fleetworkslog_test;
\connect fleetworkslog_test
CREATE EXTENSION IF NOT EXISTS postgis;
