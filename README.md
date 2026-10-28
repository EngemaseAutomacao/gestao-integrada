# Gestão Integrada Engemase

Sistema interno da Engemase Engenharia para controle de **ferramentas** e **veículos**
(retirada, devolução, histórico, notificações e relatórios). Funciona como PWA, inclusive
offline, com fila de sincronização.

Esta versão (3.x) substitui a anterior, feita no Lovable com Supabase:

| Antes (Lovable) | Agora |
|---|---|
| Supabase Postgres + RLS | **Prisma Postgres** + regras no servidor |
| Supabase Auth | Login próprio (cookie httpOnly + bcrypt). As senhas atuais continuam valendo |
| Edge Functions | API em **Hono** numa função serverless da Vercel (`api/index.ts`) |
| Triggers do banco | Serviços em `server/services/*` |
| Storage (bucket `imagens`) | **Vercel Blob** privado, servido por `/api/files/...` |
| pg_cron | **Vercel Cron** (`vercel.json`) |
| Realtime | Atualização a cada 30 s e ao voltar para a aba |
| Lovable AI Gateway (hodômetro) | API da Anthropic (opcional) |

## Estrutura

```
src/                 Frontend (React + Vite + Tailwind + shadcn/ui) — mesmas telas de antes
  lib/api.ts         Cliente HTTP da API (substitui o cliente do Supabase)
server/
  app.ts             App Hono (rotas em /api)
  routes/            Rotas HTTP (auth, users, tools, vehicles, files, notifications...)
  services/          Regras de negócio (retiradas, devoluções, rotinas, sincronizações)
  lib/               Banco (Prisma), sessão, armazenamento, push, auditoria, rate limit
  dev.ts             Servidor da API para desenvolvimento
api/index.ts         Função serverless da Vercel (encaminha para server/app.ts)
prisma/              Schema e migrations
scripts/             Seed do primeiro admin e migração de dados do Supabase
```

## Desenvolvimento local

Pré-requisitos: Node 20+ e um Postgres (local ou o próprio Prisma Postgres).

```sh
npm install
cp .env.example .env          # preencha DATABASE_URL e AUTH_SECRET
npm run db:deploy             # cria as tabelas
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='SenhaForte#1' npm run db:seed
npm run dev                   # API em :3001 e app em http://localhost:8080
```

Sem `BLOB_READ_WRITE_TOKEN`, as fotos ficam em `.data/uploads` localmente.

## Implantação na Vercel

1. **Importe o repositório** na Vercel. O `vercel.json` já define build, função e crons.
2. **Banco:** em *Storage*, crie um **Prisma Postgres** e conecte ao projeto. Isso cria a `DATABASE_URL`.
3. **Fotos:** em *Storage*, crie um **Blob** e conecte ao projeto. Isso cria o `BLOB_READ_WRITE_TOKEN`.
4. **Variáveis de ambiente** (*Settings → Environment Variables*), conforme o `.env.example`:
   - `AUTH_SECRET` (obrigatória): gere com `openssl rand -base64 48`.
   - `CRON_SECRET` (obrigatória para as rotinas automáticas).
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: use **as mesmas do Supabase**, para os
     aparelhos já inscritos continuarem recebendo push.
   - `TRELLO_*`, `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEET_ID`, `ANTHROPIC_API_KEY` (opcionais).
5. **Deploy.** O build roda `prisma migrate deploy`, então as tabelas são criadas automaticamente.
6. **Primeiro acesso:** migre os dados (abaixo) ou crie o admin com `npm run db:seed`,
   apontando `DATABASE_URL` para o banco de produção.

### Rotinas agendadas (Vercel Cron)

| Rota | Quando | O quê |
|---|---|---|
| `/api/cron/notifications` | diário 08:00 (Brasília) | Avisos de atraso e uso prolongado + reenvio de push |
| `/api/cron/trello` | diário 03:00 (Brasília) | Sincroniza obras com o Trello |
| `/api/cron/sheets` | diário 03:10 (Brasília) | Sincroniza ferramentas com a planilha |
| `/api/cron/cleanup` | diário 03:00 (Brasília) | Política de retenção de dados |

> No plano **Hobby** da Vercel os crons só rodam uma vez por dia. Por isso a verificação de
> atrasos também é disparada quando alguém usa o app (no máximo a cada 10 minutos).
> No plano **Pro** dá para mudar o cron de notificações para `*/10 * * * *` no `vercel.json`.

## Migração dos dados do Supabase

O script copia usuários (com as senhas atuais), ferramentas, veículos, retiradas, obras,
notificações, inscrições de push, logs e configurações. Ele pode ser executado mais de uma vez.

```sh
# String de conexão em Supabase → Project Settings → Database → Connection string (URI)
SOURCE_DATABASE_URL="postgresql://postgres:<senha>@db.<projeto>.supabase.co:5432/postgres" \
DATABASE_URL="<DATABASE_URL de produção>" \
npm run migrate:supabase

# Para copiar também as fotos do bucket "imagens" para o Vercel Blob:
SUPABASE_URL="https://<projeto>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service role>" \
BLOB_READ_WRITE_TOKEN="<token do Blob>" \
SOURCE_DATABASE_URL="..." DATABASE_URL="..." \
npm run migrate:supabase -- --with-files
```

Depois da migração, desative os crons do Supabase para os avisos não serem enviados em dobro.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | API + frontend em modo desenvolvimento |
| `npm run build` | Gera o Prisma Client e o build do frontend |
| `npm run typecheck` | Checagem de tipos do frontend e do servidor |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Cria uma nova migration a partir do `prisma/schema.prisma` |
| `npm run db:deploy` | Aplica as migrations |
| `npm run db:seed` | Cria o primeiro administrador |
| `npm run migrate:supabase` | Migra os dados do projeto antigo |
