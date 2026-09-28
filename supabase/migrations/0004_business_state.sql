-- Each domain has its own owner-scoped relation. The JSON column preserves
-- optional client fields while generated columns enforce core types and links.
create table public.business_state_revisions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

create table public.clients (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  name text generated always as (data->>'name') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (name is not null and length(name) between 1 and 200)
);
create table public.suppliers (like public.clients including all);
create table public.employees (like public.clients including all);
alter table public.suppliers add foreign key (owner_id) references auth.users(id) on delete cascade;
alter table public.employees add foreign key (owner_id) references auth.users(id) on delete cascade;

create table public.stock_items (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  name text generated always as (data->>'name') stored,
  quantity numeric generated always as ((data->>'quantity')::numeric) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (name is not null and length(name) between 1 and 200),
  check (quantity is not null and quantity >= 0 and quantity <= 1000000000)
);
create table public.catalog_items (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  name text generated always as (data->>'name') stored,
  stock_item_id text generated always as (data->>'stockItemId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (name is not null and length(name) between 1 and 200),
  foreign key (owner_id, stock_item_id) references public.stock_items(owner_id,id) deferrable initially deferred
);

create table public.orders (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  client_id text generated always as (data->>'clientId') stored,
  employee_id text generated always as (data->>'employeeId') stored,
  total numeric generated always as ((data->>'total')::numeric) stored,
  status text generated always as (data->>'status') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (total is not null and total >= 0 and total <= 1000000000),
  check (status in ('aberto','concluido','cancelado')),
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, employee_id) references public.employees(owner_id,id) deferrable initially deferred
);
create table public.quotes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  client_id text generated always as (data->>'clientId') stored,
  order_id text generated always as (data->>'orderId') stored,
  total numeric generated always as ((data->>'total')::numeric) stored,
  status text generated always as (data->>'status') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (total is not null and total >= 0 and total <= 1000000000),
  check (status in ('pendente','aprovado','recusado','expirado')),
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, order_id) references public.orders(owner_id,id) deferrable initially deferred
);
create table public.contracts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  client_id text generated always as (data->>'clientId') stored,
  value numeric generated always as ((data->>'value')::numeric) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (value is not null and value >= 0 and value <= 1000000000),
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred
);
create table public.tasks (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  description text generated always as (data->>'description') stored,
  client_id text generated always as (data->>'clientId') stored,
  supplier_id text generated always as (data->>'supplierId') stored,
  employee_id text generated always as (data->>'employeeId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (description is not null and length(description) between 1 and 2000),
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, supplier_id) references public.suppliers(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, employee_id) references public.employees(owner_id,id) deferrable initially deferred
);
create table public.calendar_events (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  description text generated always as (data->>'description') stored,
  event_date text generated always as (data->>'date') stored,
  task_id text generated always as (data->>'taskId') stored,
  client_id text generated always as (data->>'clientId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (description is not null and length(description) between 1 and 2000),
  check (event_date is not null and event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  foreign key (owner_id, task_id) references public.tasks(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred
);
create table public.transactions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  description text generated always as (data->>'description') stored,
  amount numeric generated always as ((data->>'amount')::numeric) stored,
  client_id text generated always as (data->>'clientId') stored,
  supplier_id text generated always as (data->>'supplierId') stored,
  task_id text generated always as (data->>'taskId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (description is not null and length(description) between 1 and 2000),
  check (amount is not null and amount between -1000000000 and 1000000000),
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, supplier_id) references public.suppliers(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, task_id) references public.tasks(owner_id,id) deferrable initially deferred
);
create table public.stock_movements (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  stock_item_id text generated always as (data->>'itemId') stored,
  quantity numeric generated always as ((data->>'quantity')::numeric) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (quantity is not null and quantity between -1000000000 and 1000000000),
  foreign key (owner_id, stock_item_id) references public.stock_items(owner_id,id) deferrable initially deferred
);
create table public.deliveries (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  order_id text generated always as (data->>'orderId') stored,
  employee_id text generated always as (data->>'employeeId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (owner_id, order_id) references public.orders(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, employee_id) references public.employees(owner_id,id) deferrable initially deferred
);
create table public.appointments (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  client_id text generated always as (data->>'clientId') stored,
  quote_id text generated always as (data->>'quoteId') stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  foreign key (owner_id, client_id) references public.clients(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, quote_id) references public.quotes(owner_id,id) deferrable initially deferred
);
create table public.commissions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  employee_id text generated always as (data->>'employeeId') stored,
  order_id text generated always as (data->>'orderId') stored,
  amount numeric generated always as ((data->>'amount')::numeric) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), check (amount is not null and amount between 0 and 1000000000),
  foreign key (owner_id, employee_id) references public.employees(owner_id,id) deferrable initially deferred,
  foreign key (owner_id, order_id) references public.orders(owner_id,id) deferrable initially deferred
);
create table public.generic_plugin_items (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  plugin_id text not null check (length(plugin_id) between 1 and 50),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, plugin_id, id)
);
create table public.business_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

create index catalog_items_stock_owner_idx on public.catalog_items(owner_id,stock_item_id);
create index orders_client_owner_idx on public.orders(owner_id,client_id);
create index orders_employee_owner_idx on public.orders(owner_id,employee_id);
create index quotes_client_owner_idx on public.quotes(owner_id,client_id);
create index quotes_order_owner_idx on public.quotes(owner_id,order_id);
create index contracts_client_owner_idx on public.contracts(owner_id,client_id);
create index tasks_client_owner_idx on public.tasks(owner_id,client_id);
create index tasks_supplier_owner_idx on public.tasks(owner_id,supplier_id);
create index tasks_employee_owner_idx on public.tasks(owner_id,employee_id);
create index events_task_owner_idx on public.calendar_events(owner_id,task_id);
create index events_date_owner_idx on public.calendar_events(owner_id,event_date);
create index transactions_client_owner_idx on public.transactions(owner_id,client_id);
create index transactions_supplier_owner_idx on public.transactions(owner_id,supplier_id);
create index transactions_task_owner_idx on public.transactions(owner_id,task_id);
create index movements_stock_owner_idx on public.stock_movements(owner_id,stock_item_id);
create index deliveries_order_owner_idx on public.deliveries(owner_id,order_id);
create index appointments_client_owner_idx on public.appointments(owner_id,client_id);
create index commissions_employee_owner_idx on public.commissions(owner_id,employee_id);
create index commissions_order_owner_idx on public.commissions(owner_id,order_id);

-- Direct access is scoped to the verified JWT. Mutations go through the
-- revision-checked RPC below; direct writes remain disallowed.
do $$ declare relation_name text;
begin
  foreach relation_name in array array['business_state_revisions','clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items','business_preferences'] loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))', relation_name || '_own_select', relation_name);
  end loop;
end $$;

do $$ declare relation_name text;
begin
  foreach relation_name in array array['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'] loop
    execute format('alter table public.%I add column position integer not null default 0 check (position >= 0)', relation_name);
  end loop;
end $$;

create or replace function public.get_business_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result jsonb := '{}'::jsonb; relation_name text; items jsonb; current_revision bigint;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select revision into current_revision from public.business_state_revisions where owner_id = uid;
  result := jsonb_build_object('revision', coalesce(current_revision, 0));
  foreach relation_name in array array['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'] loop
    execute format('select coalesce(jsonb_agg(data order by position), ''[]''::jsonb) from public.%I where owner_id = $1', relation_name) into items using uid;
    result := result || jsonb_build_object(relation_name, items);
  end loop;
  select data into items from public.business_preferences where owner_id = uid;
  return result || jsonb_build_object('preferences', coalesce(items, '{}'::jsonb));
end $$;

create or replace function public.replace_business_state(expected_revision bigint, snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); current_revision bigint; relation_name text; item jsonb; line_item jsonb; item_count integer; item_position integer; prefs jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if snapshot is null or jsonb_typeof(snapshot) <> 'object' or length(snapshot::text) > 2000000 then
    raise exception 'Invalid snapshot' using errcode = '22023';
  end if;
  insert into public.business_state_revisions(owner_id) values (uid) on conflict do nothing;
  select revision into current_revision from public.business_state_revisions where owner_id = uid for update;
  if current_revision <> expected_revision then raise sqlstate 'PT409' using message = 'Revision conflict'; end if;
  set constraints all deferred;
  foreach relation_name in array array['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'] loop
    if jsonb_typeof(snapshot->relation_name) <> 'array' then raise exception 'Invalid collection' using errcode = '22023'; end if;
    item_count := jsonb_array_length(snapshot->relation_name);
    if item_count > 5000 then raise exception 'Collection too large' using errcode = '22023'; end if;
    item_position := 0;
    for item in select value from jsonb_array_elements(snapshot->relation_name) loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'id') <> 'string' or length(item->>'id') not between 1 and 100 then
        raise exception 'Invalid item' using errcode = '22023';
      end if;
      if relation_name in ('orders','quotes') then
        if jsonb_typeof(item->'items') <> 'array' or jsonb_array_length(item->'items') > 200 then
          raise exception 'Invalid order items' using errcode = '22023';
        end if;
        for line_item in select value from jsonb_array_elements(item->'items') loop
          if jsonb_typeof(line_item) <> 'object' or jsonb_typeof(line_item->'quantity') <> 'number' or
             jsonb_typeof(line_item->'unitPrice') <> 'number' or (line_item->>'quantity')::numeric <= 0 or
             (line_item->>'unitPrice')::numeric < 0 then
            raise exception 'Invalid order line' using errcode = '22023';
          end if;
          if line_item ? 'stockItemId' and not exists (
            select 1 from jsonb_array_elements(snapshot->'stock_items') as ref(value) where ref.value->>'id' = line_item->>'stockItemId'
          ) then raise exception 'Invalid stock reference' using errcode = '23503'; end if;
          if line_item ? 'catalogItemId' and not exists (
            select 1 from jsonb_array_elements(snapshot->'catalog_items') as ref(value) where ref.value->>'id' = line_item->>'catalogItemId'
          ) then raise exception 'Invalid catalog reference' using errcode = '23503'; end if;
        end loop;
      end if;
      if relation_name = 'generic_plugin_items' then
        if jsonb_typeof(item->'pluginId') <> 'string' then raise exception 'Invalid plugin' using errcode = '22023'; end if;
        insert into public.generic_plugin_items(owner_id,id,plugin_id,data,position)
          values (uid,item->>'id',item->>'pluginId',item,item_position)
          on conflict (owner_id,plugin_id,id) do update set data = excluded.data, position = excluded.position, updated_at = now();
      else
        execute format('insert into public.%I(owner_id,id,data,position) values ($1,$2,$3,$4) on conflict (owner_id,id) do update set data = excluded.data, position = excluded.position, updated_at = now()', relation_name)
          using uid,item->>'id',item,item_position;
      end if;
      item_position := item_position + 1;
    end loop;
    if relation_name = 'generic_plugin_items' then
      delete from public.generic_plugin_items old_item where old_item.owner_id = uid and not exists (
        select 1 from jsonb_array_elements(snapshot->'generic_plugin_items') as entry(value)
        where entry.value->>'id' = old_item.id and entry.value->>'pluginId' = old_item.plugin_id
      );
    else
      execute format('delete from public.%I old_item where old_item.owner_id = $1 and not exists (select 1 from jsonb_array_elements($2) as entry(value) where entry.value->>''id'' = old_item.id)', relation_name)
        using uid,snapshot->relation_name;
    end if;
  end loop;
  prefs := snapshot->'preferences';
  if jsonb_typeof(prefs) <> 'object' then raise exception 'Invalid preferences' using errcode = '22023'; end if;
  insert into public.business_preferences(owner_id,data) values (uid,prefs)
    on conflict (owner_id) do update set data = excluded.data, updated_at = now();
  update public.business_state_revisions set revision = revision + 1, updated_at = now() where owner_id = uid returning revision into current_revision;
  return current_revision;
end $$;

revoke all on function public.get_business_state() from public;
revoke all on function public.replace_business_state(bigint,jsonb) from public;
grant execute on function public.get_business_state() to authenticated;
grant execute on function public.replace_business_state(bigint,jsonb) to authenticated;

create policy onboarding_delete_own on public.onboarding_records for delete to authenticated using (auth.uid() = user_id);
