create extension if not exists pgcrypto;

create or replace function public.set_updated_at_temp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- TODO: remove temp postfix
create table if not exists public.notes_temp (
    id text primary key,
    title text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

alter table public.notes_temp enable row level security;

drop trigger if exists notes_temp_set_updated_at on public.notes_temp;
create trigger notes_temp_set_updated_at
    before update on public.notes_temp
    for each row
    execute procedure public.set_updated_at_temp();

create table if not exists public.note_items_temp (
    id text primary key,
    note_id text not null references public.notes_temp(id) on delete cascade,
    is_child boolean not null,
    title text not null,
    position bigint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz,
    deleted_at timestamptz
);

create index if not exists note_items_temp_note_id_position_idx
    on public.note_items_temp (note_id, position)
    where deleted_at is null;

alter table public.note_items_temp enable row level security;

drop trigger if exists note_items_temp_set_updated_at on public.note_items_temp;
create trigger note_items_temp_set_updated_at
    before update on public.note_items_temp
    for each row
    execute procedure public.set_updated_at_temp();

create or replace function public.soft_delete_note_temp(note_id_to_delete text)
returns void
language sql
as $$
    update public.notes_temp
    set deleted_at = now()
    where id = note_id_to_delete
        and deleted_at is null;
$$;

create or replace function public.soft_delete_note_item_temp(note_item_id_to_delete text)
returns void
language sql
as $$
    update public.note_items_temp
    set deleted_at = now()
    where id = note_item_id_to_delete
        and deleted_at is null;
$$;

create or replace function public.set_note_item_completed_temp(
    note_item_id_to_update text,
    next_checked boolean
)
returns table (
    completed_at timestamptz,
    updated_at timestamptz
)
language sql
as $$
    update public.note_items_temp
    set completed_at = case
            when next_checked then now()
            else null
        end
    where id = note_item_id_to_update
        and deleted_at is null
    returning
        public.note_items_temp.completed_at,
        public.note_items_temp.updated_at;
$$;

drop policy if exists notes_temp_select on public.notes_temp;
create policy notes_temp_select
    on public.notes_temp
    for select
    to anon, authenticated
    using (true);

drop policy if exists notes_temp_insert on public.notes_temp;
create policy notes_temp_insert
    on public.notes_temp
    for insert
    to anon, authenticated
    with check (true);

drop policy if exists notes_temp_update on public.notes_temp;
create policy notes_temp_update
    on public.notes_temp
    for update
    to anon, authenticated
    using (true)
    with check (true);

drop policy if exists notes_temp_delete on public.notes_temp;
create policy notes_temp_delete
    on public.notes_temp
    for delete
    to anon, authenticated
    using (true);

grant execute on function public.soft_delete_note_temp(text) to anon, authenticated;

drop policy if exists note_items_temp_select on public.note_items_temp;
create policy note_items_temp_select
    on public.note_items_temp
    for select
    to anon, authenticated
    using (true);

drop policy if exists note_items_temp_insert on public.note_items_temp;
create policy note_items_temp_insert
    on public.note_items_temp
    for insert
    to anon, authenticated
    with check (true);

drop policy if exists note_items_temp_update on public.note_items_temp;
create policy note_items_temp_update
    on public.note_items_temp
    for update
    to anon, authenticated
    using (true)
    with check (true);

drop policy if exists note_items_temp_delete on public.note_items_temp;
create policy note_items_temp_delete
    on public.note_items_temp
    for delete
    to anon, authenticated
    using (true);

grant execute on function public.soft_delete_note_item_temp(text) to anon, authenticated;
grant execute on function public.set_note_item_completed_temp(text, boolean) to anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'notes_temp'
    ) then
        alter publication supabase_realtime add table public.notes_temp;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = 'note_items_temp'
    ) then
        alter publication supabase_realtime add table public.note_items_temp;
    end if;
end;
$$;
