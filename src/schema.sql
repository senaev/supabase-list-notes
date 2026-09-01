create table public.items (
    -- Generated client-side (crypto.randomUUID()); text type required by RxDB
    id text primary key,
    title text not null,
    type text not null check (char_length(type) <= 32),
    checked_at timestamptz default null,
    created_at timestamptz not null,
    modified_at timestamptz not null,
    -- Revision counter, incremented by the client on every edit (see
    -- ItemsSyncStore.ts) - unlike modified_at it isn't touched by the
    -- server, so it can't be thrown off by a client's clock being wrong.
    -- Used instead of modified_at to tell a stale echo apart from a fresh
    -- local edit (see pickNewerRow.ts). Default 0 only matters for a row
    -- inserted without the column set (shouldn't happen in practice, since
    -- the client always sends it).
    update_index bigint not null default 0,
    -- Soft-delete tombstone flag for the same plugin (its default `_deleted`).
    _deleted boolean not null default false
);

-- Required for the replication plugin's checkpoint-based pull: documents
-- must be deterministically sortable by (modified field, primary key).
create index items_modified_id_idx on public.items (modified_at, id);
create index items_type_idx on public.items (type);
create index items_checked_at_idx on public.items (checked_at);

alter table public.items replica identity full;
alter publication supabase_realtime add table public.items;
alter table public.items enable row level security;

create function public.handle_items_timestamps()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        new.created_at = timezone('utc', now());
        new.modified_at = timezone('utc', now());
        if new.checked_at is not null then
            new.checked_at = timezone('utc', now());
        end if;
    else
        new.modified_at = timezone('utc', now());
        if new.checked_at is not null and old.checked_at is null then
            new.checked_at = timezone('utc', now());
        end if;
    end if;
    return new;
end;
$$;

create trigger handle_items_insert
    before insert on public.items
    for each row
    execute procedure public.handle_items_timestamps();

create trigger handle_items_update
    before update on public.items
    for each row
    execute procedure public.handle_items_timestamps();

-- Fully open policies (publishable key, no auth flow)
create policy items_select on public.items for select to anon, authenticated using (true);
create policy items_insert on public.items for insert to anon, authenticated with check (true);
create policy items_update on public.items for update to anon, authenticated using (true) with check (true);
-- No delete policy: deletion is always a soft-delete via the `_deleted`
-- flag (an UPDATE), never a real SQL DELETE.
