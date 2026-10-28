# Exportar os dados do Lovable Cloud

Use este caminho quando o projeto antigo está no **Lovable Cloud** e não há acesso
direto ao Supabase. Uma função temporária é criada no projeto antigo e o script de
migração lê tudo por ela (inclusive as senhas criptografadas, então ninguém precisa
trocar de senha).

## 1. No Lovable (projeto antigo)

1. Gere um segredo longo, por exemplo em https://www.random.org/passwords/?num=1&len=32&format=html&rnd=new
   (ou `openssl rand -hex 32`). Guarde-o.
2. Em **Cloud → Secrets**, adicione o segredo `EXPORT_SECRET` com esse valor.
3. Cole no chat do Lovable o pedido abaixo, junto com o conteúdo dos dois arquivos
   desta pasta:

> Crie uma migration com exatamente este SQL (arquivo `migration.sql`) e uma Edge
> Function chamada `export-data` com exatamente este código (arquivo `export-data.ts`),
> com `verify_jwt = false`. Não altere mais nada no projeto.

4. Confirme que a função `export-data` aparece publicada em **Cloud → Edge Functions**.

O endereço da função é:
`https://ivkqzjwzdaneylitrsgt.supabase.co/functions/v1/export-data`

## 2. No seu computador

```powershell
git clone https://github.com/EngemaseAutomacao/gestao-integrada.git
cd gestao-integrada
npm install

$env:EXPORT_URL    = "https://ivkqzjwzdaneylitrsgt.supabase.co/functions/v1/export-data"
$env:EXPORT_SECRET = "o mesmo segredo cadastrado no Lovable"
$env:DATABASE_URL  = "DATABASE_URL do Prisma Postgres (Vercel → Storage → .env.local)"
$env:BLOB_READ_WRITE_TOKEN = "token do Blob (Vercel → Storage), para copiar as fotos"

npm run migrate:supabase -- --with-files
```

Pode rodar de novo quantas vezes quiser: nada é duplicado.

## 3. Depois

- Peça ao Lovable para **remover a Edge Function `export-data` e as funções
  `export_auth_credentials` / `export_storage_objects`**, e apague o segredo `EXPORT_SECRET`.
- Desative o uso do sistema antigo para os dados não divergirem.
