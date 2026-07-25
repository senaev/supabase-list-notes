-- Unconditionally dropped (not just `create table if not exists`) because
-- this schema is still evolving (column renames/type changes) - re-running
-- this script must always produce the current shape below, not silently
-- skip creation and leave a stale `items` table from a previous version.
drop table if exists public.items;

create table public.items (
    id text primary key, -- generated client-side (crypto.randomUUID()); text type required by RxDB
    title text not null,
    type text default null check (char_length(type) <= 32),
    checked_at timestamptz default null,
    created_at timestamptz not null,
    -- Modified-timestamp checkpoint field for the RxDB Supabase replication
    -- plugin (rxdb/plugins/replication-supabase). Named `_modified` to match
    -- the plugin's default `modifiedField`, so no override is needed.
    _modified timestamptz not null,
    -- Soft-delete tombstone flag for the same plugin (its default `_deleted`).
    _deleted boolean not null default false
);

-- Required for the replication plugin's checkpoint-based pull: documents
-- must be deterministically sortable by (modified field, primary key).
create index if not exists items_modified_id_idx on public.items (_modified, id);
create index if not exists items_type_idx on public.items (type);
create index if not exists items_checked_at_idx on public.items (checked_at);


alter table public.items replica identity full;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'items'
    ) then
        alter publication supabase_realtime add table public.items;
    end if;
end
$$;

alter table public.items enable row level security;

create or replace function public.handle_items_timestamps()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        new.created_at = timezone('utc', now());
        new._modified = timezone('utc', now());
        if new.checked_at is not null then
            new.checked_at = timezone('utc', now());
        end if;
    else
        new._modified = timezone('utc', now());
        if new.checked_at is not null and old.checked_at is null then
            new.checked_at = timezone('utc', now());
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists handle_items_insert on public.items;
create trigger handle_items_insert
    before insert on public.items
    for each row
    execute procedure public.handle_items_timestamps();

drop trigger if exists handle_items_update on public.items;
create trigger handle_items_update
    before update on public.items
    for each row
    execute procedure public.handle_items_timestamps();

-- Fully open policies (publishable key, no auth flow)
drop policy if exists items_select on public.items;
create policy items_select on public.items for select to anon, authenticated using (true);
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert to anon, authenticated with check (true);
drop policy if exists items_update on public.items;
create policy items_update on public.items for update to anon, authenticated using (true) with check (true);
-- No delete policy: deletion is always a soft-delete via the `_deleted`
-- flag (an UPDATE), never a real SQL DELETE.
drop policy if exists items_delete on public.items;
