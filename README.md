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
scripts/             Seed do primeiro admin e build da Vercel
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
   No plano Hobby o Blob tem 1 GB; por isso o app comprime as fotos antes de enviar.
4. **Variáveis de ambiente** (*Settings → Environment Variables*), conforme o `.env.example`:
   - `AUTH_SECRET` (obrigatória): gere com `openssl rand -base64 48`.
   - `CRON_SECRET` (obrigatória para as rotinas automáticas).
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: use **as mesmas do Supabase**, para os
     aparelhos já inscritos continuarem recebendo push.
   - `TRELLO_*`, `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEET_ID`, `ANTHROPIC_API_KEY` (opcionais).
5. **Deploy.** O build roda `prisma migrate deploy`, então as tabelas são criadas automaticamente.
6. **Banco novo (sem dados):** crie o primeiro admin com `npm run db:seed`,
   apontando `DATABASE_URL` para o banco de produção.

### Rotinas agendadas (Vercel Cron)

| Rota | Quando | O quê |
|---|---|---|
| `/api/cron/notifications` | diário 08:00 (Brasília) | Avisos de atraso e uso prolongado + reenvio de push |
| `/api/cron/trello` | diário 03:00 (Brasília) | Sincroniza obras com o Trello |
| `/api/cron/sheets` | diário 03:10 (Brasília) | Sincroniza ferramentas com a planilha |
| `/api/cron/cleanup` | diário 03:00 (Brasília) | Política de retenção de dados |

| `/api/cron/tick` | a cada 5 min (agendador externo) | Verificação rápida: só roda os avisos se algo venceu |

> No plano **Hobby** da Vercel os crons só rodam uma vez por dia. Para os avisos de atraso
> saírem poucos minutos depois de vencerem, um agendador externo gratuito (ex.: cron-job.org)
> chama `GET /api/cron/tick?key=<TICK_SECRET>` a cada 5 minutos. Quando não há nada vencido
> (quase sempre), cada chamada custa uma única consulta leve ao banco (~9 mil/mês, dentro do
> plano gratuito do Prisma Postgres). O uso do app também dispara a mesma verificação.

## Migração do sistema antigo

A migração do Lovable/Supabase foi concluída em 28/10/2026 (usuários com as senhas atuais,
ferramentas, veículos, histórico, obras, notificações e fotos). As ferramentas usadas só
para isso (página `/importar` e scripts) foram removidas; estão no histórico do git, no
commit anterior a "Remove código de migração".

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
