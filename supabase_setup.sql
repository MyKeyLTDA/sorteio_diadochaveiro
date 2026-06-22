-- ============================================================
-- Sorteio Dia do Chaveiro - MyKey
-- Estrutura do banco no Supabase
-- Rode isto no SQL Editor do seu projeto Supabase.
-- ============================================================

-- Tabela de participantes (somente cadastros VERIFICADOS entram aqui)
create table if not exists participantes (
  id           bigint generated always as identity primary key,
  numero       integer unique not null,         -- numero da sorte sequencial
  nome         text not null,
  telefone     text not null,                   -- livre / internacional (com DDI)
  email        text not null,
  email_norm   text unique not null,            -- email normalizado (chave de identidade)
  ip           text,
  created_at   timestamptz default now()
);

-- Tabela de codigos OTP pendentes (cadastros NAO confirmados)
create table if not exists codigos_otp (
  id           bigint generated always as identity primary key,
  email_norm   text not null,
  email        text not null,
  nome         text not null,
  telefone     text not null,
  codigo_hash  text not null,                   -- hash do codigo, nunca o codigo cru
  tentativas   integer default 0,
  ip           text,
  expira_em    timestamptz not null,
  created_at   timestamptz default now()
);

create index if not exists idx_otp_email on codigos_otp (email_norm);
create index if not exists idx_otp_expira on codigos_otp (expira_em);

-- ============================================================
-- RLS: bloqueia TUDO para chaves publicas (anon / authenticated).
-- Apenas a service_role (usada somente nas Netlify Functions)
-- consegue ler/escrever. O navegador NUNCA acessa estas tabelas.
-- ============================================================
alter table participantes enable row level security;
alter table codigos_otp   enable row level security;

-- Nao criamos NENHUMA policy para anon/authenticated.
-- Sem policy = acesso negado. service_role ignora RLS por padrao.

-- ============================================================
-- Sequencia atomica para o numero da sorte (evita corrida)
-- ============================================================
create sequence if not exists seq_numero_sorte start 1;

-- Funcao que pega o proximo numero de forma atomica
create or replace function proximo_numero()
returns integer
language sql
as $$
  select nextval('seq_numero_sorte')::integer;
$$;
