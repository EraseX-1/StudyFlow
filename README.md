# StudyFlow (core build)

Status: written but NOT yet run. The build sandbox had no internet, so `npm install`, the build and the SQL were never executed. Expect to fix small errors on first run.

## 1. Supabase
1. Create a free project at supabase.com.
2. SQL Editor > New query > paste `supabase/migrations/001_core.sql` > Run.
3. Authentication > URL Configuration: set Site URL to `http://localhost:5173` (add your Vercel URL later).
4. Project Settings > API: copy the Project URL and the `anon` public key. Never put the `service_role` key in this app.

Then run, in order, `002_revision_notes.sql`, `003_timer_guard.sql` `004_syllabus.sql` and `005_planner_timer.sql` (planner tasks, chapter-aware timer; chapters, section-wise unlocking, Hindi Course A only, corrected exam dates). 004 is safe to re-run.

## 2. Run
    cp .env.example .env     # then paste your two values
    npm install
    npm run dev              # open http://localhost:5173

## 3. Syllabus status
Imported by 004_syllabus.sql from the lists you supplied (all marked unverified in the database):
Maths 14 chapters (copied to both Standard 041 and Basic 241), Science 13, Social Science 22 (History 5, Geography 7, Political Science 5, Economics 5, each its own unlock sequence), English Language and Literature 28 (Prose 9, Poems 10, Footprints 9), Hindi Course A 20 (Kshitij 15, Kritika 5).
Not imported, still awaiting the official lists: Artificial Intelligence 417, English Communicative 101, topics, grammar/writing/reading modules, practicals and projects.

Exam date corrections (your dates -> reports of the 6 Nov 2026 CBSE date sheet): English 27 Feb -> 26 Feb; Hindi 2 Mar -> 3 Mar.
Confirmed unchanged: Maths 17 Feb, Science 22 Feb, Social Science 8 Mar. AI (417) is 24 Feb, 10:30-12:30. The official PDF itself could not be read here; check it on cbse.gov.in.

## 4. Deploy (Vercel)
Push to GitHub > vercel.com > Import project > add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
as environment variables > Deploy. Then add the Vercel URL in Supabase > Authentication > URL Configuration.

## Backup
Supabase dashboard > Database > Backups (paid plans), or export tables from the Table Editor.

## Built vs not built
Built: dashboard (progress, today's minutes, streak, next exam), revision manager (3/7/14/30-day gaps), notes with autosave and search, settings (change subjects), signup, login, forgot/reset password, email verification, subject setup, per-subject sequential
locking enforced in the database, unlock override (recorded), difficulty, duplicate-safe study timer,
exam countdown, credits.
Not built: full onboarding wizard, planner, calendar, ranks/points/achievements,
analytics charts, availability and targets, account deletion, data export, PWA, chapter topics.

## Import template for a missing subject (AI 417, English Communicative)
Only use chapter names copied from the official CBSE document.

    insert into chapters (subject_id, section, number, title, default_difficulty, est_minutes, position)
    select id, 'Unit name', 1, 'Official chapter or unit title', 'medium', 180, 101 from subjects where code = '417';
    update subjects set catalogue_status = 'unverified' where code = '417';  -- set 'verified' after a check
