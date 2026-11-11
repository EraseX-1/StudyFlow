-- Run AFTER 004. Safe to re-run. Adds the planner task table, chapter-aware sessions and catalogue status.

alter table public.study_sessions
  add column if not exists chapter_id uuid references public.chapters on delete set null,
  add column if not exists session_type text not null default 'learning' check (session_type in ('learning','practice','revision','mock_test'));

-- Subjects whose chapter list is missing stay 'awaiting' and are not counted as imported.
alter table public.subjects add column if not exists catalogue_status text not null default 'awaiting' check (catalogue_status in ('awaiting','unverified','verified'));
update public.subjects set catalogue_status = 'unverified'
  where catalogue_status = 'awaiting' and id in (select distinct subject_id from public.chapters);
-- English grammar/writing/reading can be added later as their own sections with these categories
alter table public.chapters drop constraint if exists chapters_assessment_category_check;
alter table public.chapters add constraint chapters_assessment_category_check
  check (assessment_category in ('theory','practical','project','portfolio','grammar','writing','reading','literature'));

-- One task table shared by the planner (and later the calendar). Revisions stay in revision_tasks.
create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chapter_id uuid not null references public.chapters on delete cascade,
  task_type text not null default 'learning' check (task_type in ('learning','practice','mock_test')),
  planned_date date not null,
  start_time time,
  end_time time,
  est_minutes int not null check (est_minutes between 10 and 240),
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  check (start_time is null or end_time is null or end_time > start_time)
);
create unique index if not exists study_tasks_no_dupes on public.study_tasks (user_id, chapter_id, task_type, planned_date) where status = 'planned';
create index if not exists study_tasks_user_date on public.study_tasks (user_id, planned_date);
alter table public.study_tasks enable row level security;
drop policy if exists "own tasks read" on public.study_tasks;
drop policy if exists "own tasks insert" on public.study_tasks;
drop policy if exists "own tasks update" on public.study_tasks;
drop policy if exists "own tasks delete" on public.study_tasks;
create policy "own tasks read" on public.study_tasks for select to authenticated using (user_id = auth.uid());
create policy "own tasks insert" on public.study_tasks for insert to authenticated with check (user_id = auth.uid());
create policy "own tasks update" on public.study_tasks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks delete" on public.study_tasks for delete to authenticated using (user_id = auth.uid());

-- Limits a day to 6 hours of planned work and blocks tasks for locked chapters.
create or replace function public.guard_study_task() returns trigger
language plpgsql set search_path = public as $$
declare load int;
begin
  if new.status = 'planned' then
    if (tg_op = 'INSERT' or new.chapter_id <> old.chapter_id) and not is_unlocked(new.chapter_id) then
      raise exception 'Unlock this chapter before planning it.';
    end if;
    select coalesce(sum(est_minutes), 0) into load from study_tasks
      where user_id = new.user_id and status = 'planned' and planned_date = new.planned_date and id <> new.id;
    if load + new.est_minutes > 360 then
      raise exception 'That day already has % minutes planned (limit is 6 hours). Choose another day.', load;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists study_task_guard on public.study_tasks;
create trigger study_task_guard before insert or update on public.study_tasks
  for each row execute function public.guard_study_task();

-- Moves missed (past, still planned) tasks to the next days that have room. Nothing is deleted.
create or replace function public.reschedule_missed() returns int
language plpgsql security definer set search_path = public as $$
declare t record; d date; moved int := 0; load int;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  for t in select * from study_tasks where user_id = auth.uid() and status = 'planned' and planned_date < current_date
           order by planned_date, created_at loop
    for i in 0..13 loop
      d := current_date + i;
      select coalesce(sum(est_minutes), 0) into load from study_tasks
        where user_id = auth.uid() and status = 'planned' and planned_date = d;
      if load + t.est_minutes <= 360 and not exists (
           select 1 from study_tasks x where x.user_id = auth.uid() and x.chapter_id = t.chapter_id
             and x.task_type = t.task_type and x.planned_date = d and x.status = 'planned') then
        update study_tasks set planned_date = d, start_time = null, end_time = null where id = t.id;
        moved := moved + 1; exit;
      end if;
    end loop;
  end loop;
  return moved;
end $$;
revoke execute on function public.reschedule_missed() from public, anon;
grant execute on function public.reschedule_missed() to authenticated;
