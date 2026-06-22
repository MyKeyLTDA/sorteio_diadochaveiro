# Sorteio Dia do Chaveiro — MyKey

Cadastro com verificação por e-mail (OTP) e sorteio no servidor. Toda a lógica e o acesso ao banco ficam em Netlify Functions — o navegador nunca fala com o Supabase nem vê credenciais.

## Como funciona a segurança

- **Nenhuma credencial no front-end.** As páginas só chamam `/api/...`.
- **Supabase com RLS bloqueando tudo** para chaves públicas. Só a `service_role` (que fica nas variáveis de ambiente do Netlify) acessa as tabelas.
- **Cadastro em 2 etapas com OTP por e-mail.** Só vira participante quem confirma um código de 6 dígitos. Isso amarra cada número a um e-mail real.
- **Anti-duplicado:** e-mail normalizado (Gmail com pontos/+tag viram o mesmo), `unique` no banco, limite por IP.
- **Admin em página separada** (`/admin.html`, com `noindex`), protegida por senha validada no servidor.
- **Sorteio feito no servidor** com aleatoriedade criptográfica.

> Observação honesta: telefone é tratado como dado livre internacional (não é chave de identidade). A identidade fica no e-mail verificado. Mesmo com OTP, alguém muito determinado pode usar vários e-mails — o OTP eleva muito o custo da fraude, mas não a torna impossível. Para um sorteio promocional é uma proteção proporcional.

## Passo a passo de deploy

### 1. Supabase
1. Crie um projeto novo (ou use um dedicado).
2. SQL Editor → cole e rode o conteúdo de `supabase_setup.sql`.
3. Project Settings → API → copie a **URL** e a **service_role key**.

### 2. GitHub
1. Crie um repositório e suba esta pasta (o `.gitignore` já evita subir `.env` e `node_modules`).

### 3. Netlify
1. "Add new site" → "Import from Git" → selecione o repositório.
2. Build settings: deixe o Netlify detectar (publish = `public`, functions = `netlify/functions` já estão no `netlify.toml`).
3. **Site settings → Environment variables** → adicione todas as variáveis listadas em `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`, `OTP_SECRET`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
4. Deploy.

### 4. Testar
- Cadastro: `https://seusite.netlify.app/`
- Painel: `https://seusite.netlify.app/admin.html`

## Endpoints (Functions)
- `POST /api/solicitar-codigo` — valida dados, checa duplicado, envia OTP.
- `POST /api/confirmar` — valida OTP, grava participante, devolve número.
- `POST /api/listar` — (admin) lista participantes. Exige senha.
- `POST /api/sortear` — (admin) sorteia ganhador no servidor. Exige senha.

## Dica de SMTP
Use uma conta de e-mail do seu domínio dedicada ao envio (ex.: `sorteio@seudominio.com.br`). Se os e-mails caírem em spam, configure SPF/DKIM no DNS do domínio.
