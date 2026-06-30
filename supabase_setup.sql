-- ============================================================
-- Sorteio Dia do Chaveiro - MyKey
-- Estrutura do banco no Supabase (cadastro direto, sem OTP)
-- Rode isto no SQL Editor do seu projeto Supabase.
--
-- Se voce JA rodou a versao anterior, rode ANTES estas linhas
-- para limpar o que mudou:
--   drop table if exists codigos_otp;
--   drop table if exists participantes;
--   drop sequence if exists seq_numero_sorte;
-- e depois rode tudo abaixo.
-- ============================================================

create table if not exists participantes (
  id            bigint generated always as identity primary key,
  numero        integer unique not null,        -- numero da sorte sequencial
  nome          text not null,
  telefone      text not null,                  -- como digitado (internacional)
  telefone_norm text unique not null,           -- so digitos: bloqueia telefone repetido
  email         text not null,
  email_norm    text unique not null,           -- email normalizado: bloqueia email repetido
  ip            text,
  created_at    timestamptz default now()
);

-- ============================================================
-- RLS: bloqueia TUDO para chaves publicas (anon / authenticated).
-- Apenas a service_role (usada somente nas Netlify Functions) acessa.
-- ============================================================
alter table participantes enable row level security;
-- Sem policy para anon/authenticated = acesso negado. service_role ignora RLS.

-- ============================================================
-- Sequencia atomica para o numero da sorte
-- ============================================================
create sequence if not exists seq_numero_sorte start 1;

create or replace function proximo_numero()
returns integer
language sql
as $$
  select nextval('seq_numero_sorte')::integer;
$$;

-- ============================================================
-- Registro dos sorteios realizados (histórico para relatório)
-- Cada clique em "Sortear" grava aqui o ganhador, com data/hora.
-- ============================================================
create table if not exists sorteios (
  id            bigint generated always as identity primary key,
  numero        integer not null,               -- número da sorte do ganhador
  nome          text not null,
  telefone      text,
  email         text,
  total         integer not null,               -- total de participantes no momento do sorteio
  created_at    timestamptz default now()
);

alter table sorteios enable row level security;
-- Sem policy para anon/authenticated = acesso negado. service_role (Functions) ignora RLS.
