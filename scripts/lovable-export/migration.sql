-- Funções auxiliares para a exportação de dados (migração para Vercel + Prisma).
-- Acessíveis apenas com a chave de serviço; remova após a migração.

create or replace function public.export_auth_credentials()
returns table(id uuid, encrypted_password text, last_sign_in_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.encrypted_password::text, u.last_sign_in_at from auth.users u;
$$;

create or replace function public.export_storage_objects(_offset int, _limit int)
returns table(name text, owner uuid, mimetype text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select o.name, o.owner, o.metadata->>'mimetype', o.created_at
    from storage.objects o
   where o.bucket_id = 'imagens' and o.name not like '%.emptyFolderPlaceholder'
   order by o.created_at, o.name
  offset _offset limit _limit;
$$;

revoke all on function public.export_auth_credentials() from public, anon, authenticated;
revoke all on function public.export_storage_objects(int, int) from public, anon, authenticated;
grant execute on function public.export_auth_credentials() to service_role;
grant execute on function public.export_storage_objects(int, int) to service_role;
