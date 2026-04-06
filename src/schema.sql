-- TODO: remove temp postfix
create function public.set_replication_modified_temp()
returns trigger
language plpgsql
as $$
begin
    new._modified = now();
    return new;
end;
$$;

create table public.notes_temp (
    id text primary key,
    title text not null,
    created_at timestamptz not null default now(),
    _modified timestamptz not null default now(),
    _deleted boolean not null default false
);

create index notes_temp_modified_idx
    on public.notes_temp (_modified, id);

create trigger notes_temp_set_replication_modified
    before update on public.notes_temp
    for each row
    execute procedure public.set_replication_modified_temp();

alter table public.notes_temp enable row level security;

create policy notes_temp_select
    on public.notes_temp
    for select
    to anon, authenticated
    using (true);

create policy notes_temp_insert
    on public.notes_temp
    for insert
    to anon, authenticated
    with check (true);

create policy notes_temp_update
    on public.notes_temp
    for update
    to anon, authenticated
    using (true)
    with check (true);

create table public.note_items_temp (
    id text primary key,
    note_id text not null references public.notes_temp(id) on delete cascade,
    is_child boolean not null,
    title text not null,
    position bigint not null,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    _modified timestamptz not null default now(),
    _deleted boolean not null default false
);

create index note_items_temp_modified_idx
    on public.note_items_temp (_modified, id);

create trigger note_items_temp_set_replication_modified
    before update on public.note_items_temp
    for each row
    execute procedure public.set_replication_modified_temp();

alter table public.note_items_temp enable row level security;

create policy note_items_temp_select
    on public.note_items_temp
    for select
    to anon, authenticated
    using (true);

create policy note_items_temp_insert
    on public.note_items_temp
    for insert
    to anon, authenticated
    with check (true);

create policy note_items_temp_update
    on public.note_items_temp
    for update
    to anon, authenticated
    using (true)
    with check (true);

alter publication supabase_realtime add table public.notes_temp;
alter publication supabase_realtime add table public.note_items_temp;
