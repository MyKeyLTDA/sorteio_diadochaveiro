# Sorteio Dia do Chaveiro — MyKey

Cadastro direto e sorteio no servidor. Toda a lógica e o acesso ao banco ficam em Netlify Functions — o navegador nunca fala com o Supabase nem vê credenciais.

## Como funciona a segurança

- **Nenhuma credencial no front-end.** As páginas só chamam `/api/...`.
- **Supabase com RLS bloqueando tudo** para chaves públicas. Só a `service_role` (que fica nas variáveis de ambiente do Netlify) acessa as tabelas.
- **Anti-duplicado:** bloqueia se o e-mail OU o telefone já existir. E-mail normalizado (Gmail com pontos/+tag colapsam), telefone comparado só por dígitos, `unique` no banco e limite por IP.
- **Admin em página separada** (`/admin.html`, com `noindex`), protegida por senha validada no servidor.
- **Sorteio feito no servidor** com aleatoriedade criptográfica.

> Observação honesta: telefone é tratado como dado livre internacional (não é chave de identidade). A identidade fica no e-mail verificado. Mesmo com OTP, alguém muito determinado pode usar vários e-mails — o OTP eleva muito o custo da fraude, mas não a torna impossível. Para um sorteio promocional é uma proteção proporcional.

## Passo a passo de deploy

> **IMPORTANTE — não arraste a pasta para o Netlify (Deploy manual).**
> Este projeto tem Netlify Functions, que dependem das bibliotecas `@supabase/supabase-js`
> e `nodemailer`. O "Deploy manual" (arrastar pasta) NÃO roda `npm install` nem builda as
> Functions — o site abriria, mas todo `/api/...` quebraria. O deploy precisa rodar o build,
> o que acontece de duas formas:
>
> - **Via GitHub (recomendado):** o Netlify roda `npm install` automaticamente e reimplanta a cada push.
> - **Via Netlify CLI:** instale o CLI, rode `npm install` e `netlify deploy --build`.
>
> Use uma das duas. As instruções abaixo seguem o caminho GitHub.

### 1. Supabase
1. Crie um projeto novo (ou use um dedicado).
2. SQL Editor → cole e rode o conteúdo de `supabase_setup.sql`.
3. Project Settings → API → copie a **URL** e a **service_role key**.
   - **Onde usar:** NÃO cole no código. Guarde para o passo 3.3, onde você vai colá-las
     nas variáveis de ambiente do Netlify com os nomes `SUPABASE_URL` e
     `SUPABASE_SERVICE_ROLE_KEY`. As Functions leem esses valores via `process.env`
     em tempo de execução — é por isso que nada aparece no código-fonte do site.

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

## Alternativa sem Git: Netlify CLI (Windows)

Se preferir não usar GitHub, dá para implantar pela linha de comando:

1. Instale o Node.js (se ainda não tiver) e o CLI:
   ```
   npm install -g netlify-cli
   ```
2. Dentro da pasta do projeto:
   ```
   npm install
   netlify login
   netlify deploy --build --prod
   ```
3. As variáveis de ambiente: defina pelo painel do Netlify (Site settings → Environment
   variables) ou pelo CLI com `netlify env:set NOME valor` antes do deploy.

A diferença para arrastar a pasta é que aqui o `npm install` e o build das Functions acontecem.

## Endpoints (Functions)

- `POST /api/cadastrar` — valida dados, bloqueia e-mail/telefone repetido, grava e devolve o número.
- `POST /api/listar` — (admin) lista participantes. Exige senha.
- `POST /api/sortear` — (admin) sorteia ganhador no servidor. Exige senha.

## Dica de SMTP
Use uma conta de e-mail do seu domínio dedicada ao envio (ex.: `sorteio@seudominio.com.br`). Se os e-mails caírem em spam, configure SPF/DKIM no DNS do domínio.
