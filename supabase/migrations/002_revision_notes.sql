-- Run AFTER 001_core.sql.
create table public.revision_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chapter_id uuid not null references public.chapters on delete cascade,
  due_date date not null,
  attempt int not null default 1,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, chapter_id, due_date)
);
create index on public.revision_tasks (user_id, due_date);
alter table public.revision_tasks enable row level security;
create policy "own revisions read" on public.revision_tasks for select to authenticated using (user_id = auth.uid());
create policy "own revisions delete" on public.revision_tasks for delete to authenticated using (user_id = auth.uid());
-- creating/finishing revisions goes through the functions below, so it stays separate from chapter completion

create or replace function public.schedule_revision(p_chapter uuid, p_due date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if not exists (select 1 from chapter_progress where user_id = auth.uid() and chapter_id = p_chapter and status = 'completed') then
    raise exception 'Complete this chapter before scheduling a revision.';
  end if;
  if exists (select 1 from revision_tasks where user_id = auth.uid() and chapter_id = p_chapter and done_at is null) then
    raise exception 'This chapter already has a revision waiting.';
  end if;
  insert into revision_tasks (user_id, chapter_id, due_date) values (auth.uid(), p_chapter, p_due) on conflict do nothing;
end $$;

-- Finishing a revision schedules the next one 3, 7, 14, then 30 days later. Finishing twice does nothing.
create or replace function public.complete_revision(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t revision_tasks; gaps int[] := array[3,7,14,30];
begin
  select * into t from revision_tasks where id = p_task and user_id = auth.uid() for update;
  if not found then raise exception 'Revision not found.'; end if;
  if t.done_at is not null then return; end if;
  update revision_tasks set done_at = now() where id = t.id;
  if t.attempt <= 4 then
    insert into revision_tasks (user_id, chapter_id, due_date, attempt)
    values (auth.uid(), t.chapter_id, current_date + gaps[t.attempt], t.attempt + 1) on conflict do nothing;
  end if;
end $$;

create or replace view public.my_revisions with (security_invoker = true) as
select r.id, r.chapter_id, r.due_date, r.done_at, r.attempt,
  c.number as chapter_number, c.title as chapter_title, s.name as subject_name
from public.revision_tasks r
join public.chapters c on c.id = r.chapter_id
join public.subjects s on s.id = c.subject_id;

revoke execute on function public.schedule_revision(uuid, date), public.complete_revision(uuid) from public, anon;
grant execute on function public.schedule_revision(uuid, date), public.complete_revision(uuid) to authenticated;

create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chapter_id uuid references public.chapters on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);
create index on public.study_notes (user_id, updated_at desc);
alter table public.study_notes enable row level security;
create policy "own notes read" on public.study_notes for select to authenticated using (user_id = auth.uid());
create policy "own notes insert" on public.study_notes for insert to authenticated with check (user_id = auth.uid());
create policy "own notes update" on public.study_notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notes delete" on public.study_notes for delete to authenticated using (user_id = auth.uid());
