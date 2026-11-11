-- Run AFTER 002. Stops fake or doubled study time at the database level.
create or replace function public.guard_study_session() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.started_at + make_interval(secs => new.seconds) > now() + interval '2 minutes' then
    raise exception 'That session is longer than the time that has actually passed.';
  end if;
  if exists (select 1 from study_sessions s
             where s.user_id = new.user_id and s.id <> new.id
               and s.started_at < new.started_at + make_interval(secs => new.seconds)
               and s.started_at + make_interval(secs => s.seconds) > new.started_at) then
    raise exception 'That session overlaps another saved session.';
  end if;
  return new;
end $$;
drop trigger if exists study_session_guard on public.study_sessions;
create trigger study_session_guard before insert on public.study_sessions
  for each row execute function public.guard_study_session();
