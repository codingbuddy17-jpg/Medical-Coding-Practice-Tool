-- Import quality queue + batch audit/rollback tables for PracticeBuddy Lab

create table if not exists import_batches (
  id bigserial primary key,
  batch_id text not null unique,
  uploaded_by text,
  source_name text,
  total_rows integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  warn_count integer not null default 0,
  fail_count integer not null default 0,
  notes text,
  rollback_count integer not null default 0,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_batches_created_at on import_batches(created_at desc);
create index if not exists idx_import_batches_batch_id on import_batches(batch_id);

create table if not exists import_batch_items (
  id bigserial primary key,
  batch_id text not null,
  question_id text,
  disposition text not null default 'inserted',
  created_at timestamptz not null default now()
);

create index if not exists idx_import_batch_items_batch_id on import_batch_items(batch_id);
create index if not exists idx_import_batch_items_question_id on import_batch_items(question_id);

create table if not exists import_review_queue (
  id uuid primary key default gen_random_uuid(),
  batch_id text,
  status text not null default 'open',
  tag text,
  question text not null,
  answer text,
  reasons jsonb not null default '[]'::jsonb,
  source_row_number integer,
  created_by text,
  resolution_action text,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_review_queue_status on import_review_queue(status);
create index if not exists idx_import_review_queue_created_at on import_review_queue(created_at desc);
create index if not exists idx_import_review_queue_batch_id on import_review_queue(batch_id);

-- Optional: keep updated_at fresh automatically
create or replace function set_updated_at_import_review_queue()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_import_review_queue_updated_at on import_review_queue;
create trigger trg_import_review_queue_updated_at
before update on import_review_queue
for each row execute function set_updated_at_import_review_queue();
