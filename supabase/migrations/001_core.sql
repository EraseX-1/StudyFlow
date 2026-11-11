-- StudyFlow core schema. Paste into Supabase > SQL Editor > Run.
create extension if not exists pgcrypto;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  session text not null default '2026-27'
);
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects on delete cascade,
  number int not null check (number > 0),
  title text not null,
  unique (subject_id, number)
);
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  subject_codes text[] not null default '{}',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.chapter_progress (
  user_id uuid not null references auth.users on delete cascade,
  chapter_id uuid not null references public.chapters on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard','very_hard')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create table public.chapter_unlock_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  chapter_id uuid not null references public.chapters on delete cascade,
  reason text not null default 'Already studied',
  created_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);
create table public.study_sessions (
  id uuid primary key,  -- made by the browser, so retrying a save can never duplicate a session
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references public.subjects,
  started_at timestamptz not null,
  seconds int not null check (seconds between 60 and 43200)
);
create index on public.study_sessions (user_id, started_at);
create table public.exam_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,  -- null = official CBSE event
  subject_code text,
  title text not null,
  exam_date date not null,
  starts_at time,
  verified boolean not null default false
);

alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.profiles enable row level security;
alter table public.chapter_progress enable row level security;
alter table public.chapter_unlock_overrides enable row level security;
alter table public.study_sessions enable row level security;
alter table public.exam_events enable row level security;

create policy "read subjects" on public.subjects for select to authenticated using (true);
create policy "read chapters" on public.chapters for select to authenticated using (true);
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- progress and overrides are read-only from the browser; changes go through the functions below
create policy "own progress read" on public.chapter_progress for select to authenticated using (user_id = auth.uid());
create policy "own overrides read" on public.chapter_unlock_overrides for select to authenticated using (user_id = auth.uid());
create policy "own sessions read" on public.study_sessions for select to authenticated using (user_id = auth.uid());
create policy "own sessions insert" on public.study_sessions for insert to authenticated with check (user_id = auth.uid());
create policy "own sessions delete" on public.study_sessions for delete to authenticated using (user_id = auth.uid());
create policy "read exams" on public.exam_events for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "own exams insert" on public.exam_events for insert to authenticated with check (user_id = auth.uid());
create policy "own exams delete" on public.exam_events for delete to authenticated using (user_id = auth.uid());

-- Unlock rule: first chapter of a subject, or previous chapter completed, or an override by this user.
create or replace function public.is_unlocked(p_chapter uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from chapters c
    where c.id = p_chapter and (
      not exists (select 1 from chapters x where x.subject_id = c.subject_id and x.number < c.number)
      or exists (select 1 from chapter_unlock_overrides o where o.user_id = auth.uid() and o.chapter_id = c.id)
      or exists (
        select 1 from chapters p
        join chapter_progress cp on cp.chapter_id = p.id and cp.user_id = auth.uid() and cp.status = 'completed'
        where p.subject_id = c.subject_id
          and p.number = (select max(number) from chapters where subject_id = c.subject_id and number < c.number)
      )
    )
  );
$$;

create or replace function public.update_chapter(p_chapter uuid, p_status text default null, p_difficulty text default null)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if not exists (select 1 from chapters where id = p_chapter) then raise exception 'Chapter not found.'; end if;
  select status into cur from chapter_progress where user_id = auth.uid() and chapter_id = p_chapter;
  if p_status is not null then
    if p_status not in ('not_started','in_progress','completed') then raise exception 'Invalid status.'; end if;
    if not is_unlocked(p_chapter) then raise exception 'This chapter is locked. Finish the previous chapter first.'; end if;
    if cur = 'completed' and p_status <> 'completed' then raise exception 'Completed chapters stay completed.'; end if;
  end if;
  if p_difficulty is not null and p_difficulty not in ('easy','medium','hard','very_hard') then raise exception 'Invalid difficulty.'; end if;
  insert into chapter_progress (user_id, chapter_id, status, difficulty, completed_at)
  values (auth.uid(), p_chapter, coalesce(p_status,'not_started'), coalesce(p_difficulty,'medium'),
          case when p_status = 'completed' then now() end)
  on conflict (user_id, chapter_id) do update set
    status = coalesce(p_status, chapter_progress.status),
    difficulty = coalesce(p_difficulty, chapter_progress.difficulty),
    completed_at = case when p_status = 'completed' and chapter_progress.status <> 'completed' then now() else chapter_progress.completed_at end,
    updated_at = now();
end $$;

-- Override: unlocks one chapter and records it. Earlier chapters are NOT marked completed.
create or replace function public.request_unlock(p_chapter uuid, p_reason text default 'Already studied this chapter')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if not exists (select 1 from chapters where id = p_chapter) then raise exception 'Chapter not found.'; end if;
  insert into chapter_unlock_overrides (user_id, chapter_id, reason)
  values (auth.uid(), p_chapter, left(coalesce(p_reason, ''), 200)) on conflict do nothing;
end $$;

create or replace view public.my_chapters with (security_invoker = true) as
select c.id, c.subject_id, c.number, c.title,
  coalesce(cp.status, 'not_started') as status,
  coalesce(cp.difficulty, 'medium') as difficulty,
  public.is_unlocked(c.id) as unlocked
from public.chapters c
left join public.chapter_progress cp on cp.chapter_id = c.id and cp.user_id = auth.uid();

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

insert into public.subjects (code, name) values
 ('041','Mathematics Standard'),('241','Mathematics Basic'),('086','Science'),('087','Social Science'),
 ('184','English Language and Literature'),('101','English Communicative'),
 ('002','Hindi Course A'),('085','Hindi Course B'),('417','Artificial Intelligence');

-- CBSE Class 10 main exams 2027, all at 10:30. Edit here if CBSE revises the date sheet.
insert into public.exam_events (subject_code, title, exam_date, starts_at, verified) values
 ('041','Mathematics Standard','2027-02-17','10:30',true),
 ('241','Mathematics Basic','2027-02-17','10:30',true),
 ('086','Science','2027-02-22','10:30',true),
 ('184','English Language and Literature','2027-02-26','10:30',true),
 ('101','English Communicative','2027-02-26','10:30',true),
 ('002','Hindi Course A','2027-03-03','10:30',true),
 ('085','Hindi Course B','2027-03-03','10:30',true),
 ('087','Social Science','2027-03-08','10:30',true),
 ('417','Artificial Intelligence','2027-02-24','10:30',false);
