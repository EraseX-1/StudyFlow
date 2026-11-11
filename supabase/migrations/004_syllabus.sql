-- Run AFTER 003. Safe to run more than once. Keeps existing user progress.
-- Chapter lists below were supplied by the project owner and are NOT yet checked against the
-- official 2026-27 CBSE syllabus, so every chapter is stored with verified = false.

alter table public.chapters
  add column if not exists section text not null default '',        -- own unlock sequence (e.g. History, Geography)
  add column if not exists category text,                           -- label only (e.g. Physics)
  add column if not exists position int not null default 0,
  add column if not exists default_difficulty text not null default 'medium' check (default_difficulty in ('easy','medium','hard','very_hard')),
  add column if not exists est_minutes int not null default 180,
  add column if not exists assessment_category text not null default 'theory' check (assessment_category in ('theory','practical','project','portfolio')),
  add column if not exists verified boolean not null default false;
alter table public.chapters drop constraint if exists chapters_subject_id_number_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chapters_subject_section_number_key') then
    alter table public.chapters add constraint chapters_subject_section_number_key unique (subject_id, section, number);
  end if;
end $$;
-- personal difficulty is now optional; when empty the chapter's suggested difficulty is shown
alter table public.chapter_progress alter column difficulty drop not null, alter column difficulty drop default;

-- Hindi Course A only
update public.profiles
  set subject_codes = (select array_agg(distinct x) from unnest(array_remove(subject_codes, '085') || array['002']) x)
  where '085' = any(subject_codes);
delete from public.subjects s where s.code = '085' and not exists (select 1 from public.study_sessions z where z.subject_id = s.id);

-- Each section (History, Geography, ...) unlocks on its own; subjects never affect each other.
create or replace function public.is_unlocked(p_chapter uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from chapters c
    where c.id = p_chapter and (
      not exists (select 1 from chapters x where x.subject_id = c.subject_id and x.section = c.section and x.number < c.number)
      or exists (select 1 from chapter_unlock_overrides o where o.user_id = auth.uid() and o.chapter_id = c.id)
      or exists (
        select 1 from chapters p
        join chapter_progress cp on cp.chapter_id = p.id and cp.user_id = auth.uid() and cp.status = 'completed'
        where p.subject_id = c.subject_id and p.section = c.section
          and p.number = (select max(y.number) from chapters y where y.subject_id = c.subject_id and y.section = c.section and y.number < c.number)
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
  values (auth.uid(), p_chapter, coalesce(p_status,'not_started'), p_difficulty, case when p_status = 'completed' then now() end)
  on conflict (user_id, chapter_id) do update set
    status = coalesce(p_status, chapter_progress.status),
    difficulty = coalesce(p_difficulty, chapter_progress.difficulty),
    completed_at = case when p_status = 'completed' and chapter_progress.status <> 'completed' then now() else chapter_progress.completed_at end,
    updated_at = now();
end $$;

drop view if exists public.my_chapters;
create view public.my_chapters with (security_invoker = true) as
select c.id, c.subject_id, c.section, c.category, c.position, c.number, c.title, c.est_minutes, c.assessment_category, c.verified,
  coalesce(cp.status, 'not_started') as status,
  coalesce(cp.difficulty, c.default_difficulty) as difficulty,
  (cp.difficulty is not null) as difficulty_changed,
  public.is_unlocked(c.id) as unlocked
from public.chapters c
left join public.chapter_progress cp on cp.chapter_id = c.id and cp.user_id = auth.uid();
grant select on public.my_chapters to authenticated;

-- Chapter seed. Difficulty: e/m/h/v = Easy/Medium/Hard/Very hard (initial estimates, not CBSE ratings).
-- English and Hindi difficulties were not supplied, so they start at Medium.
-- Science categories are only labels; Science is one sequence. Maths seeds both tracks (041 and 241).
with seed(code, section, category, n, title, d) as (values
 ('M','',null,1,'Real Numbers','m'),('M','',null,2,'Polynomials','m'),('M','',null,3,'Pair of Linear Equations in Two Variables','h'),
 ('M','',null,4,'Quadratic Equations','h'),('M','',null,5,'Arithmetic Progressions','m'),('M','',null,6,'Triangles','v'),
 ('M','',null,7,'Coordinate Geometry','e'),('M','',null,8,'Introduction to Trigonometry','h'),('M','',null,9,'Some Applications of Trigonometry','m'),
 ('M','',null,10,'Circles','h'),('M','',null,11,'Areas Related to Circles','m'),('M','',null,12,'Surface Areas and Volumes','h'),
 ('M','',null,13,'Statistics','m'),('M','',null,14,'Probability','e'),
 ('086','','Chemistry',1,'Chemical Reactions and Equations','m'),('086','','Chemistry',2,'Acids, Bases and Salts','m'),
 ('086','','Chemistry',3,'Metals and Non-metals','m'),('086','','Chemistry',4,'Carbon and Its Compounds','h'),
 ('086','','Biology',5,'Life Processes','v'),('086','','Biology',6,'Control and Coordination','h'),
 ('086','','Biology',7,'How do Organisms Reproduce?','m'),('086','','Biology',8,'Heredity','h'),
 ('086','','Physics',9,'Light – Reflection and Refraction','h'),('086','','Physics',10,'The Human Eye and the Colourful World','m'),
 ('086','','Physics',11,'Electricity','v'),('086','','Physics',12,'Magnetic Effects of Electric Current','h'),
 ('086','','Biology',13,'Our Environment','e'),
 ('087','History',null,1,'The Rise of Nationalism in Europe','h'),('087','History',null,2,'Nationalism in India','h'),
 ('087','History',null,3,'The Making of a Global World','v'),('087','History',null,4,'The Age of Industrialisation','m'),
 ('087','History',null,5,'Print Culture and the Modern World','h'),
 ('087','Geography',null,1,'Resources and Development','m'),('087','Geography',null,2,'Forest and Wildlife Resources','m'),
 ('087','Geography',null,3,'Water Resources','m'),('087','Geography',null,4,'Agriculture','h'),
 ('087','Geography',null,5,'Minerals and Energy Resources','m'),('087','Geography',null,6,'Manufacturing Industries','h'),
 ('087','Geography',null,7,'Lifelines of National Economy','m'),
 ('087','Political Science',null,1,'Power-sharing','e'),('087','Political Science',null,2,'Federalism','m'),
 ('087','Political Science',null,3,'Gender, Religion and Caste','m'),('087','Political Science',null,4,'Political Parties','m'),
 ('087','Political Science',null,5,'Outcomes of Democracy','e'),
 ('087','Economics',null,1,'Development','e'),('087','Economics',null,2,'Sectors of the Indian Economy','m'),
 ('087','Economics',null,3,'Money and Credit','m'),('087','Economics',null,4,'Globalisation and the Indian Economy','h'),
 ('087','Economics',null,5,'Consumer Rights','e'),
 ('184','First Flight — Prose',null,1,'A Letter to God','m'),('184','First Flight — Prose',null,2,'Nelson Mandela: Long Walk to Freedom','m'),
 ('184','First Flight — Prose',null,3,'Two Stories about Flying','m'),('184','First Flight — Prose',null,4,'From the Diary of Anne Frank','m'),
 ('184','First Flight — Prose',null,5,'Glimpses of India','m'),('184','First Flight — Prose',null,6,'Mijbil the Otter','m'),
 ('184','First Flight — Prose',null,7,'Madam Rides the Bus','m'),('184','First Flight — Prose',null,8,'The Sermon at Benares','m'),
 ('184','First Flight — Prose',null,9,'The Proposal','m'),
 ('184','First Flight — Poems',null,1,'Dust of Snow','m'),('184','First Flight — Poems',null,2,'Fire and Ice','m'),
 ('184','First Flight — Poems',null,3,'A Tiger in the Zoo','m'),('184','First Flight — Poems',null,4,'How to Tell Wild Animals','m'),
 ('184','First Flight — Poems',null,5,'The Ball Poem','m'),('184','First Flight — Poems',null,6,'Amanda!','m'),
 ('184','First Flight — Poems',null,7,'The Trees','m'),('184','First Flight — Poems',null,8,'Fog','m'),
 ('184','First Flight — Poems',null,9,'The Tale of Custard the Dragon','m'),('184','First Flight — Poems',null,10,'For Anne Gregory','m'),
 ('184','Footprints Without Feet',null,1,'A Triumph of Surgery','m'),('184','Footprints Without Feet',null,2,'The Thief''s Story','m'),
 ('184','Footprints Without Feet',null,3,'The Midnight Visitor','m'),('184','Footprints Without Feet',null,4,'A Question of Trust','m'),
 ('184','Footprints Without Feet',null,5,'Footprints Without Feet','m'),('184','Footprints Without Feet',null,6,'The Making of a Scientist','m'),
 ('184','Footprints Without Feet',null,7,'The Necklace','m'),('184','Footprints Without Feet',null,8,'Bholi','m'),
 ('184','Footprints Without Feet',null,9,'The Book That Saved the Earth','m'),
 ('002','क्षितिज भाग–2',null,1,'सूरदास — पद','m'),('002','क्षितिज भाग–2',null,2,'तुलसीदास — राम-लक्ष्मण-परशुराम संवाद','m'),
 ('002','क्षितिज भाग–2',null,3,'देव — सवैया और कवित्त','m'),('002','क्षितिज भाग–2',null,4,'जयशंकर प्रसाद — आत्मकथ्य','m'),
 ('002','क्षितिज भाग–2',null,5,'सूर्यकांत त्रिपाठी ''निराला'' — उत्साह और अट नहीं रही है','m'),
 ('002','क्षितिज भाग–2',null,6,'नागार्जुन — यह दंतुरित मुस्कान और फसल','m'),('002','क्षितिज भाग–2',null,7,'गिरिजाकुमार माथुर — छाया मत छूना','m'),
 ('002','क्षितिज भाग–2',null,8,'ऋतुराज — कन्यादान','m'),('002','क्षितिज भाग–2',null,9,'मंगलेश डबराल — संगतकार','m'),
 ('002','क्षितिज भाग–2',null,10,'स्वयं प्रकाश — नेताजी का चश्मा','m'),('002','क्षितिज भाग–2',null,11,'रामवृक्ष बेनीपुरी — बालगोबिन भगत','m'),
 ('002','क्षितिज भाग–2',null,12,'यशपाल — लखनवी अंदाज़','m'),('002','क्षितिज भाग–2',null,13,'मन्नू भंडारी — एक कहानी यह भी','m'),
 ('002','क्षितिज भाग–2',null,14,'महावीर प्रसाद द्विवेदी — नौबतखाने में इबादत','m'),('002','क्षितिज भाग–2',null,15,'यतीन्द्र मिश्र — संस्कृति','m'),
 ('002','कृतिका भाग–2',null,1,'माता का आँचल','m'),('002','कृतिका भाग–2',null,2,'जॉर्ज पंचम की नाक','m'),
 ('002','कृतिका भाग–2',null,3,'साना-साना हाथ जोड़ि','m'),('002','कृतिका भाग–2',null,4,'एही ठैयाँ झुलनी हेरानी हो रामा!','m'),
 ('002','कृतिका भाग–2',null,5,'मैं क्यों लिखता हूँ?','m')
)
insert into public.chapters (subject_id, section, category, number, title, default_difficulty, est_minutes, position, verified)
select s.id, seed.section, seed.category, seed.n, seed.title,
  case seed.d when 'e' then 'easy' when 'm' then 'medium' when 'h' then 'hard' else 'very_hard' end,
  case seed.d when 'e' then 120 when 'm' then 180 when 'h' then 240 else 300 end,
  coalesce(array_position(array['History','Geography','Political Science','Economics','First Flight — Prose','First Flight — Poems','Footprints Without Feet','क्षितिज भाग–2','कृतिका भाग–2'], seed.section), 0) * 100 + seed.n,
  false
from seed
join public.subjects s on s.code = any (case when seed.code = 'M' then array['041','241'] else array[seed.code] end)
on conflict (subject_id, section, number) do update set
  title = excluded.title, category = excluded.category, default_difficulty = excluded.default_difficulty,
  est_minutes = excluded.est_minutes, position = excluded.position;

-- Official exam events (user_id is null). Personal events are never touched.
alter table public.exam_events add column if not exists ends_at time;
delete from public.exam_events where user_id is null;
insert into public.exam_events (subject_code, title, exam_date, starts_at, ends_at, verified) values
 ('041','Mathematics Standard','2027-02-17','10:30','13:30',true),
 ('241','Mathematics Basic','2027-02-17','10:30','13:30',true),
 ('086','Science','2027-02-22','10:30','13:30',true),
 ('417','Artificial Intelligence','2027-02-24','10:30','12:30',true),
 ('184','English Language and Literature','2027-02-26','10:30','13:30',true),
 ('101','English Communicative','2027-02-26','10:30','13:30',true),
 ('002','Hindi Course A','2027-03-03','10:30','13:30',true),
 ('087','Social Science','2027-03-08','10:30','13:30',true);
