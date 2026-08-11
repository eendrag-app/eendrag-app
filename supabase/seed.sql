-- Seed data. Runs on `supabase db reset` (fresh database) — plain INSERTs.
--
-- EVERYTHING BELOW EXCEPT THE 12 SECTIONS IS PLACEHOLDER DATA and is flagged
-- as such in docs/BUILD-LOG.md. Replace sports, fixtures, announcements,
-- events, players, and results with real data by editing THIS ONE FILE.
-- The dev admin account is NOT created here — run `npm run create-admin`
-- (scripts/create-admin.ts, documented in README.md).
--
-- Times below are written as res times ("19:00" means 19:00 in Stellenbosch).
-- date_trunc() on a timestamptz truncates in the SESSION's timezone, which is
-- UTC by default — so without this line every seeded event would land two
-- hours later than its own copy claims.
set timezone = 'Africa/Johannesburg';

-- ---------------------------------------------------------------------------
-- The 12 sections. These names are REAL — everything else in this file is
-- placeholder. Sections have no colours (migration 0104); they are told apart
-- by name, the way the res tells them apart.
-- ---------------------------------------------------------------------------
insert into sections (name, sort_order) values
  ('Here XVII',     1),
  ('Wallstreet',    2),
  ('Ingang',        3),
  ('Stopstraat',    4),
  ('Katstraat',     5),
  ('Bun Boulevard', 6),
  ('District',      7),
  ('Sensasie',      8),
  ('Wineroute',     9),
  ('Jacaranda',     10),
  ('Arendstraat',   11),
  ('Route 61',      12);

-- ---------------------------------------------------------------------------
-- Sports (placeholder list — edit freely). rep_id stays null until real reps
-- exist as signed-up users; assign via Profile → Admin or scripts/create-admin.
-- ---------------------------------------------------------------------------
insert into sports (name, description, practice_info, venue, coach) values
  ('Rugby',        'Res rugby for all levels — league and friendlies. Beginners welcome, boots help but are not required.', 'Tue & Thu 18:30–20:00', 'Coetzenburg B-field', 'Placeholder Coach'),
  ('Hockey',       'Mixed social and league hockey. Sticks available to borrow.', 'Mon & Wed 19:00–20:30', 'Coetzenburg Astro', ''),
  ('Soccer',       'Five- and eleven-a-side. Socials on Fridays.', 'Wed 18:00–19:30', 'Lentelus fields', ''),
  ('Cricket',      'Summer league plus indoor nets in winter.', 'Tue 17:00–19:00', 'Coetzenburg nets', ''),
  ('Tennis',       'Social round-robins and a ladder. All levels.', 'Thu 17:00–19:00', 'Coetzenburg courts', ''),
  ('Squash',       'Ladder and inter-res league. Rackets to borrow from the rep.', 'Mon 18:00–20:00', 'Neelsie squash courts', ''),
  ('Basketball',   'Pick-up games and an inter-res team.', 'Fri 17:00–18:30', 'Coetzenburg indoor hall', ''),
  ('Table Tennis', 'Tables in the common room — league nights are competitive.', 'Sun 19:00', 'Eendrag common room', '');

-- ---------------------------------------------------------------------------
-- Announcements (placeholder). author_id null = shown as "Eendrag HK".
-- ---------------------------------------------------------------------------
insert into announcements (title, body, is_urgent, status, published_at) values
  ('Water off on Thursday morning',
   'Municipal maintenance: no water in the building Thursday 08:00–12:00. Fill a bottle the night before.',
   true, 'published', now() - interval '1 day'),
  ('Huisvergadering Sunday 19:00',
   'Compulsory house meeting in the saal this Sunday at 19:00. Intersection prize-giving included.',
   false, 'published', now() - interval '3 days'),
  ('Gym card renewals',
   'Renew your Maties gym card at the HK office before end of month for the res discount.',
   false, 'published', now() - interval '6 days');

insert into announcements (title, body, is_urgent, status, target_section_id, published_at)
values
  ('Katstraat section meeting',
   'Katstraat: quick section meeting tonight 21:30 in the gang. Five minutes, promise.',
   false, 'published',
   (select id from sections where name = 'Katstraat'),
   now() - interval '2 days');

insert into announcements (title, body, status, scheduled_for) values
  ('Res photo — dress code',
   'Formal res photo next week. Details on dress code and times to follow here.',
   'scheduled', now() + interval '2 days');

-- ---------------------------------------------------------------------------
-- Calendar events (placeholder). Manual admin-created entries have
-- source_module null; the two mirrored sport fixtures below show what
-- module-generated entries look like.
-- ---------------------------------------------------------------------------
insert into events (title, description, category, location, starts_at, ends_at) values
  ('Huisvergadering', 'Compulsory house meeting.', 'res_wide', 'Eendrag saal',
   date_trunc('day', now()) + interval '5 days' + interval '19 hours',
   date_trunc('day', now()) + interval '5 days' + interval '20 hours'),
  ('Karnaval sokkie', 'Social with Huis ten Bosch.', 'social', 'Eendrag quad',
   date_trunc('day', now()) + interval '9 days' + interval '20 hours',
   date_trunc('day', now()) + interval '9 days' + interval '23 hours');

insert into events (title, category, section_id, location, starts_at) values
  ('Wineroute braai', 'section',
   (select id from sections where name = 'Wineroute'),
   'Braai area',
   date_trunc('day', now()) + interval '3 days' + interval '18 hours');

-- ---------------------------------------------------------------------------
-- Sport fixtures & results (placeholder).
-- ---------------------------------------------------------------------------
insert into sport_fixtures (sport_id, opponent, location, starts_at, notes) values
  ((select id from sports where name = 'Rugby'), 'Wilgenhof', 'Coetzenburg B-field',
   date_trunc('day', now()) + interval '4 days' + interval '18 hours 30 minutes', 'League round 3'),
  ((select id from sports where name = 'Hockey'), 'Helshoogte', 'Coetzenburg Astro',
   date_trunc('day', now()) + interval '6 days' + interval '19 hours', ''),
  ((select id from sports where name = 'Squash'), 'Simonsberg', 'Neelsie courts',
   date_trunc('day', now()) + interval '8 days' + interval '18 hours', 'Bring your own racket if you can');

-- Mirror the first two fixtures into the shared calendar the same way
-- src/core/calendar does at runtime (source_module + source_ref = fixture id).
insert into events (title, category, location, starts_at, source_module, source_ref)
select 'Rugby vs ' || f.opponent, 'sport', f.location, f.starts_at, 'sport', f.id::text
from sport_fixtures f
where f.opponent = 'Wilgenhof';

insert into events (title, category, location, starts_at, source_module, source_ref)
select 'Hockey vs ' || f.opponent, 'sport', f.location, f.starts_at, 'sport', f.id::text
from sport_fixtures f
where f.opponent = 'Helshoogte';

insert into sport_results (sport_id, summary, score, played_at) values
  ((select id from sports where name = 'Rugby'), 'Beat Dagbreek at home', '24–17',
   now() - interval '4 days'),
  ((select id from sports where name = 'Table Tennis'), 'Lost the league night to Majuba', '3–5',
   now() - interval '2 days');

-- ---------------------------------------------------------------------------
-- Intersection (placeholder): one COMPLETED event with a full bracket, one
-- upcoming event without a draw, players and rosters.
-- Bracket result: Katstraat champion, District runner-up.
-- ---------------------------------------------------------------------------
do $$
declare
  ev uuid;
  upcoming uuid;
  ga uuid; gb uuid; gc uuid; gd uuid;
  -- section ids, named after the section for readability
  here_xvii uuid; wallstreet uuid; ingang uuid; stopstraat uuid;
  katstraat uuid; bun_blvd uuid; district uuid; sensasie uuid;
  wineroute uuid; jacaranda uuid; arendstraat uuid; route_61 uuid;
  d0 timestamptz := date_trunc('day', now()) - interval '14 days';
begin
  select id into here_xvii   from sections where name = 'Here XVII';
  select id into wallstreet  from sections where name = 'Wallstreet';
  select id into ingang      from sections where name = 'Ingang';
  select id into stopstraat  from sections where name = 'Stopstraat';
  select id into katstraat   from sections where name = 'Katstraat';
  select id into bun_blvd    from sections where name = 'Bun Boulevard';
  select id into district    from sections where name = 'District';
  select id into sensasie    from sections where name = 'Sensasie';
  select id into wineroute   from sections where name = 'Wineroute';
  select id into jacaranda   from sections where name = 'Jacaranda';
  select id into arendstraat from sections where name = 'Arendstraat';
  select id into route_61    from sections where name = 'Route 61';

  insert into intersection_events (name, start_date, rules, status)
  values ('Touch Rugby Day', d0::date,
          'Seven a side, two five-minute halves. Win = 3 points, head-to-head breaks ties. Mixed teams encouraged.',
          'completed')
  returning id into ev;

  insert into intersection_groups (event_id, name) values (ev, 'A') returning id into ga;
  insert into intersection_groups (event_id, name) values (ev, 'B') returning id into gb;
  insert into intersection_groups (event_id, name) values (ev, 'C') returning id into gc;
  insert into intersection_groups (event_id, name) values (ev, 'D') returning id into gd;

  insert into intersection_group_teams (group_id, section_id, slot) values
    (ga, here_xvii, 0),  (ga, wallstreet, 1),  (ga, ingang, 2),
    (gb, stopstraat, 0), (gb, katstraat, 1),   (gb, bun_blvd, 2),
    (gc, district, 0),   (gc, sensasie, 1),    (gc, wineroute, 2),
    (gd, jacaranda, 0),  (gd, arendstraat, 1), (gd, route_61, 2);

  -- Group stage: rounds interleave one match per group, pairs (0,1) (1,2) (0,2).
  insert into intersection_matches
    (event_id, stage, group_id, team_a_section_id, team_b_section_id,
     winner_section_id, note, played, scheduled_at, sort_order)
  values
    -- round 1: slots 0 v 1
    (ev, 'group', ga, here_xvii, wallstreet,   here_xvii, '3–1', true, d0 + interval '9 hours',  1),
    (ev, 'group', gb, stopstraat, katstraat,   katstraat, '0–2', true, d0 + interval '9 hours',  2),
    (ev, 'group', gc, district, sensasie,      district,  '4–0', true, d0 + interval '9 hours',  3),
    (ev, 'group', gd, jacaranda, arendstraat,  jacaranda, '2–1', true, d0 + interval '9 hours',  4),
    -- round 2: slots 1 v 2
    (ev, 'group', ga, wallstreet, ingang,      wallstreet, '2–0', true, d0 + interval '10 hours', 5),
    (ev, 'group', gb, katstraat, bun_blvd,     katstraat,  '3–0', true, d0 + interval '10 hours', 6),
    (ev, 'group', gc, sensasie, wineroute,     wineroute,  '1–2', true, d0 + interval '10 hours', 7),
    (ev, 'group', gd, arendstraat, route_61,   route_61,   '0–1', true, d0 + interval '10 hours', 8),
    -- round 3: slots 0 v 2
    (ev, 'group', ga, here_xvii, ingang,       here_xvii,  '5–0', true, d0 + interval '11 hours', 9),
    (ev, 'group', gb, stopstraat, bun_blvd,    stopstraat, '2–1', true, d0 + interval '11 hours', 10),
    (ev, 'group', gc, district, wineroute,     district,   '3–1', true, d0 + interval '11 hours', 11),
    (ev, 'group', gd, jacaranda, route_61,     route_61,   '1–3', true, d0 + interval '11 hours', 12);

  -- Knockouts. Pairings: QF1 A1–B2, QF2 C1–D2, QF3 B1–A2, QF4 D1–C2;
  -- SF1 = QF1/QF2 winners, SF2 = QF3/QF4 winners.
  insert into intersection_matches
    (event_id, stage, slot, source_a, source_b, team_a_section_id,
     team_b_section_id, winner_section_id, note, played, scheduled_at, sort_order)
  values
    (ev, 'qf', 1, 'A1', 'B2', here_xvii, stopstraat, here_xvii, '2–1', true, d0 + interval '13 hours', 101),
    (ev, 'qf', 2, 'C1', 'D2', district,  jacaranda,  district,  '4–2', true, d0 + interval '13 hours', 102),
    (ev, 'qf', 3, 'B1', 'A2', katstraat, wallstreet, katstraat, '1–0', true, d0 + interval '14 hours', 103),
    (ev, 'qf', 4, 'D1', 'C2', route_61,  wineroute,  route_61,  '3–3 (sudden death)', true, d0 + interval '14 hours', 104),
    (ev, 'sf', 1, 'QF1', 'QF2', here_xvii, district,  district,  '0–1', true, d0 + interval '15 hours', 111),
    (ev, 'sf', 2, 'QF3', 'QF4', katstraat, route_61,  katstraat, '2–0', true, d0 + interval '15 hours', 112);

  insert into intersection_matches
    (event_id, stage, slot, source_a, source_b, team_a_section_id,
     team_b_section_id, winner_section_id, note, played, scheduled_at, sort_order)
  values
    (ev, 'final', 1, 'SF1', 'SF2', district, katstraat, katstraat, '1–2 after extra time', true,
     d0 + interval '16 hours', 121);

  -- Two placeholder players per section, rostered for the completed event.
  insert into intersection_players (name, section_id)
  values
    ('Johan van der Merwe', here_xvii),  ('Pieter Botha', here_xvii),
    ('Willem Pretorius', wallstreet),    ('Dawid le Roux', wallstreet),
    ('Christiaan Nel', ingang),          ('Ruan Fourie', ingang),
    ('Stefan du Toit', stopstraat),      ('Heinrich Muller', stopstraat),
    ('Jaco Steyn', katstraat),           ('Divan van Zyl', katstraat),
    ('Marco Venter', bun_blvd),          ('Franco Joubert', bun_blvd),
    ('Tiaan Bezuidenhout', district),    ('Wian Kruger', district),
    ('Etienne Marais', sensasie),        ('Zander Coetzee', sensasie),
    ('Lian Swanepoel', wineroute),       ('Armand Grobler', wineroute),
    ('Neil Erasmus', jacaranda),         ('Wikus Olivier', jacaranda),
    ('Gerhard Meyer', arendstraat),      ('Schalk Burger', arendstraat),
    ('Vian de Klerk', route_61),         ('Hanro Smit', route_61);

  insert into intersection_rosters (event_id, player_id)
  select ev, p.id from intersection_players p;

  -- An upcoming event with no draw yet — the admin generates it in the app.
  insert into intersection_events (name, start_date, rules, status)
  values ('5-a-side Soccer', (date_trunc('day', now()) + interval '21 days')::date,
          'Five a side, ten-minute games, no keepers rush. Squad of eight per section.',
          'upcoming')
  returning id into upcoming;

  -- Mirror the completed event's final onto the calendar the way
  -- src/core/calendar does for intersection fixtures.
  insert into events (title, category, location, starts_at, source_module, source_ref)
  select 'Intersection: Touch Rugby final', 'intersection', 'Eendrag field',
         m.scheduled_at, 'intersection', m.id::text
  from intersection_matches m
  where m.event_id = ev and m.stage = 'final';
end $$;
