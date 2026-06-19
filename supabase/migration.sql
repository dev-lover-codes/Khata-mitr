-- Supabase Schema Migration for KhataMitra (खातामित्र) - Phase 2

create extension if not exists "pgcrypto";

-- -----------------------------------------------------
-- 1. PROFILES TABLE
-- -----------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  phone text unique,
  role text check (role in ('retailer','customer')) not null,
  business_name text,
  preferred_language text default 'hi' check (preferred_language in ('hi','en')),
  created_at timestamptz default now()
);

-- Enable Row-Level Security
alter table public.profiles enable row level security;

-- Profiles Policies: Users can only read and update their own row
create policy "Users can select their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- -----------------------------------------------------
-- 2. RELATIONSHIPS TABLE
-- -----------------------------------------------------
create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.profiles(id) on delete cascade not null,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  balance numeric(12,2) default 0, -- positive = customer owes retailer
  created_at timestamptz default now(),
  unique(retailer_id, customer_id)
);

-- Enable RLS
alter table public.relationships enable row level security;

-- Relationships Policies: Users can only view or modify entries if their auth.uid() matches retailer_id or customer_id
create policy "Users can access relationships linked to them"
  on public.relationships for all
  using (auth.uid() = retailer_id or auth.uid() = customer_id);

-- -----------------------------------------------------
-- 3. TRANSACTIONS TABLE
-- -----------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid references public.relationships(id) on delete cascade not null,
  type text check (type in ('credit','debit')) not null,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  transaction_date date default current_date,
  created_at timestamptz default now()
);
create index if not exists transactions_relationship_id_idx on public.transactions(relationship_id);

-- Enable RLS
alter table public.transactions enable row level security;

-- Transactions Policies: Users can only access if they are the retailer or customer of the relationship
create policy "Users can access transactions linked to their relationships"
  on public.transactions for all
  using (
    exists (
      select 1 from public.relationships r
      where r.id = relationship_id 
      and (auth.uid() = r.retailer_id or auth.uid() = r.customer_id)
    )
  );

-- -----------------------------------------------------
-- 4. REMINDERS TABLE
-- -----------------------------------------------------
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  relationship_id uuid references public.relationships(id) on delete cascade,
  remind_at timestamptz not null,
  type text check (type in ('call','payment')) not null,
  message text not null,
  status text default 'pending' check (status in ('pending','sent','done')),
  channel text default 'app' check (channel in ('app','whatsapp','sms','email')),
  created_at timestamptz default now()
);
create index if not exists reminders_pending_idx on public.reminders(user_id, remind_at) where status = 'pending';

-- Enable RLS
alter table public.reminders enable row level security;

-- Reminders Policies: Users can only access their own reminders
create policy "Users can access their own reminders"
  on public.reminders for all
  using (auth.uid() = user_id);

-- -----------------------------------------------------
-- 5. CHAT LOGS TABLE
-- -----------------------------------------------------
create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('user','assistant')) not null,
  message text not null,
  language text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.chat_logs enable row level security;

-- Chat Logs Policies: Completely private to the owner
create policy "Users can access their own chat logs"
  on public.chat_logs for all
  using (auth.uid() = user_id);

-- -----------------------------------------------------
-- TRIGGERS & FUNCTIONS
-- -----------------------------------------------------
-- Automatic running balance calculator
create or replace function public.update_relationship_balance()
returns trigger as $$
begin
  update public.relationships
  set balance = balance + (case when NEW.type = 'credit' then NEW.amount else -NEW.amount end)
  where id = NEW.relationship_id;
  return NEW;
end;
$$ language plpgsql;

create or replace trigger trg_update_balance
after insert on public.transactions
for each row execute function public.update_relationship_balance();
