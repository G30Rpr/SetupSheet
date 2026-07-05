-- Seeds the setups table with sample data across all 9 supported games.
-- Supersedes the old seed.sql + seed_more_games.sql: those used one
-- generic setup_values shape for every game, which no longer matches
-- src/lib/setup-schemas.ts (each game now has its own real setup-screen
-- fields). If you ran the old files already, wipe the table first:
--
--   truncate public.setups cascade;
--
-- Then log in with Discord at least once (so a public.profiles row exists
-- to attribute these rows to) and run this file in the Supabase SQL
-- Editor. Values are informed by public setup-guide consensus (Coach Dave
-- Academy, F1Laps, GT Planet, simracingsetup.com, etc.), not copied from
-- any single published setup — see git history for sources.

insert into public.setups
  (user_id, game, car, track, condition, lap_time, description, tags, rig_profile,
   setup_values, pace, predictability, upvotes, downloads, created_at)
select
  (select id from public.profiles order by created_at asc limit 1),
  v.game, v.car, v.track, v.condition, v.lap_time, v.description, v.tags, v.rig_profile,
  v.setup_values, v.pace, v.predictability, v.upvotes, v.downloads, v.created_at
from (values

  -- iRacing --------------------------------------------------------------
  ('iRacing', 'Porsche 992 GT3 Cup', 'Spa-Francorchamps', 'Dry', '2:16.482',
   'Stable rear end through Eau Rouge with a touch more front splitter for confidence on entry. Great for long stints.',
   array['Safe', 'Race'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '23.5 psi', 'rearTirePressure', '24.0 psi', 'crossWeight', '50.0%',
     'frontCamber', '-3.2°', 'rearCamber', '-2.7°',
     'frontSpring', '850 lbs/in', 'rearSpring', '950 lbs/in',
     'frontArb', '3 clicks', 'rearArb', '4 clicks',
     'frontRideHeight', '65 mm', 'rearRideHeight', '72 mm',
     'frontAero', '3', 'rearAero', '5',
     'diffPreload', '65 Nm', 'brakeBias', '56% front', 'finalDrive', '4.10'
   ),
   4, 5, 214, 1820, '2026-06-28'::timestamptz),

  ('iRacing', 'Ferrari 296 GT3', 'Suzuka', 'Dry', '2:02.556',
   'Aggressive trim for the Esses, stiffer rear to handle the elevation changes. Watch tire temps building through 130R.',
   array['Race', 'Aggressive'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '22.5 psi', 'rearTirePressure', '23.0 psi', 'crossWeight', '49.5%',
     'frontCamber', '-3.6°', 'rearCamber', '-2.9°',
     'frontSpring', '900 lbs/in', 'rearSpring', '1000 lbs/in',
     'frontArb', '4 clicks', 'rearArb', '3 clicks',
     'frontRideHeight', '60 mm', 'rearRideHeight', '68 mm',
     'frontAero', '4', 'rearAero', '6',
     'diffPreload', '70 Nm', 'brakeBias', '57% front', 'finalDrive', '3.90'
   ),
   4, 4, 88, 410, '2026-05-10'::timestamptz),

  -- Assetto Corsa Competizione ---------------------------------------------
  ('Assetto Corsa Competizione', 'Ferrari 296 GT3', 'Monza', 'Dry', '1:47.312',
   'Low drag qualifying setup, max top speed down the straights. Twitchy on cold tires so build up to the limit.',
   array['Quali', 'Aggressive'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '26.3 psi', 'rearTirePressure', '26.8 psi',
     'frontCamber', '-4.3°', 'rearCamber', '-3.8°', 'frontToe', '0.02°', 'rearToe', '0.10°',
     'frontArb', '2 clicks', 'rearArb', '2 clicks',
     'frontBumpRebound', '8/9 clicks', 'rearBumpRebound', '7/8 clicks',
     'brakeBias', '58% front', 'brakeDuct', '4/3',
     'frontSplitter', '1 (min downforce)', 'rearWing', '2',
     'frontRideHeight', '52 mm', 'rearRideHeight', '58 mm',
     'diffPreload', '40 Nm (GT3 fixed lock)', 'finalDrive', 'Short — Monza top speed'
   ),
   5, 2, 358, 2650, '2026-06-30'::timestamptz),

  ('Assetto Corsa Competizione', 'McLaren 720S GT3', 'Nürburgring', 'Wet', '2:15.320',
   'Full wet tune with max wing and softer bias to manage the standing water through the old Nordschleife sections.',
   array['Wet Weather', 'Safe'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '25.0 psi', 'rearTirePressure', '25.5 psi',
     'frontCamber', '-2.6°', 'rearCamber', '-2.0°', 'frontToe', '0.05°', 'rearToe', '0.15°',
     'frontArb', '1 click', 'rearArb', '1 click',
     'frontBumpRebound', '6/7 clicks', 'rearBumpRebound', '5/6 clicks',
     'brakeBias', '54% front', 'brakeDuct', '5/4',
     'frontSplitter', '4', 'rearWing', '6 (max wet wing)',
     'frontRideHeight', '66 mm', 'rearRideHeight', '72 mm',
     'diffPreload', '45 Nm (GT3 fixed lock)', 'finalDrive', 'Tall — standing water'
   ),
   3, 4, 51, 240, '2026-05-25'::timestamptz),

  -- Assetto Corsa (base) ----------------------------------------------------
  ('Assetto Corsa', 'Mazda MX-5 Cup', 'Suzuka', 'Dry', '2:02.410',
   'Simple, planted setup for newcomers to the track. Predictable rotation through the Esses with no snap oversteer.',
   array['Beginner', 'Safe'], 'Gamepad',
   jsonb_build_object(
     'frontTirePressure', '30.0 psi', 'rearTirePressure', '29.0 psi',
     'frontCamber', '-2.0°', 'rearCamber', '-1.5°',
     'frontArb', '2 clicks (soft)', 'rearArb', '1 click', 'brakeBias', '60% front',
     'frontRideHeight', '90 mm', 'rearRideHeight', '95 mm', 'wing', 'N/A (no wing)',
     'diffPower', 'Stock (one-make spec)', 'finalDrive', 'Stock'
   ),
   3, 5, 64, 402, '2026-06-18'::timestamptz),

  ('Assetto Corsa', 'Ferrari 458 GT2', 'Spa-Francorchamps', 'Dry', '2:24.850',
   'GT2-class balance tune — a bit more ride height than a GT3 car needs for the Spa kerbs, softened rear for traction on exit.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '27.5 psi', 'rearTirePressure', '28.0 psi',
     'frontCamber', '-3.2°', 'rearCamber', '-2.6°',
     'frontArb', '2 clicks', 'rearArb', '2 clicks', 'brakeBias', '56% front',
     'frontRideHeight', '62 mm', 'rearRideHeight', '68 mm', 'wing', '4',
     'diffPower', '50% / 35%', 'finalDrive', 'Long — Spa''s straights'
   ),
   4, 4, 39, 175, '2026-05-02'::timestamptz),

  -- Assetto Corsa EVO -------------------------------------------------------
  ('Assetto Corsa EVO', 'BMW M4 GT3', 'Brands Hatch', 'Dry', '1:23.115',
   'Fresh EVO-physics tune — slightly more front camber than you''d run in ACC to lean into the new tire model''s grip window. Confident through Paddock Hill Bend.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '27.0 psi', 'rearTirePressure', '27.5 psi',
     'frontCamber', '-3.8°', 'rearCamber', '-3.2°',
     'frontArb', '2 clicks', 'rearArb', '3 clicks',
     'frontRideHeight', '58 mm', 'rearRideHeight', '64 mm',
     'frontAero', '3', 'rearAero', '4', 'brakeBias', '56% front',
     'diffPreload', '55 Nm', 'finalDrive', 'Balanced — Paddock Hill Bend'
   ),
   4, 4, 42, 180, '2026-07-02'::timestamptz),

  ('Assetto Corsa EVO', 'Porsche 911 GT3 R', 'Silverstone', 'Dry', '1:51.204',
   'Aggressive qualifying trim through the fast middle sector. Stiffer front end for late braking into Stowe.',
   array['Race', 'Aggressive'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '26.5 psi', 'rearTirePressure', '27.0 psi',
     'frontCamber', '-4.0°', 'rearCamber', '-3.4°',
     'frontArb', '3 clicks', 'rearArb', '2 clicks',
     'frontRideHeight', '55 mm', 'rearRideHeight', '60 mm',
     'frontAero', '2', 'rearAero', '3', 'brakeBias', '58% front',
     'diffPreload', '45 Nm', 'finalDrive', 'Balanced for Maggotts-Becketts'
   ),
   5, 3, 27, 110, '2026-05-08'::timestamptz),

  -- Le Mans Ultimate ---------------------------------------------------------
  ('Le Mans Ultimate', 'BMW M4 GT3', 'Fuji Speedway', 'Dry', '1:52.771',
   'Beginner friendly setup with softer springs and extra ride height for the kerbs. Forgiving under braking.',
   array['Beginner', 'Safe'], 'Gamepad',
   jsonb_build_object(
     'frontTirePressure', '25.0 psi', 'rearTirePressure', '25.5 psi',
     'frontCamber', '-3.0°', 'rearCamber', '-2.5°',
     'frontSpring', 'Soft', 'rearSpring', 'Medium',
     'frontArb', '1 click', 'rearArb', '2 clicks',
     'frontRideHeight', '70 mm', 'rearRideHeight', '76 mm',
     'frontSplitter', '3', 'rearWing', '4',
     'diffPreload', '35 Nm', 'brakeBias', '53% front', 'finalDrive', 'Medium — Fuji''s back straight'
   ),
   3, 5, 89, 610, '2026-06-20'::timestamptz),

  ('Le Mans Ultimate', 'Porsche 911 GT3 R', 'Sebring', 'Dry', '2:01.933',
   'Beginner-safe ride height and soft compression to absorb the bumps without unsettling the car through the infield.',
   array['Beginner', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '24.0 psi', 'rearTirePressure', '24.5 psi',
     'frontCamber', '-2.8°', 'rearCamber', '-2.3°',
     'frontSpring', 'Soft', 'rearSpring', 'Soft',
     'frontArb', '1 click (soft)', 'rearArb', '2 clicks',
     'frontRideHeight', '72 mm', 'rearRideHeight', '76 mm',
     'frontSplitter', '4', 'rearWing', '5',
     'diffPreload', '35 Nm', 'brakeBias', '54% front', 'finalDrive', 'Medium — bumpy infield section'
   ),
   3, 5, 58, 340, '2026-06-12'::timestamptz),

  ('Le Mans Ultimate', 'Porsche 963', 'Circuit de la Sarthe (Le Mans)', 'Mixed', '3:26.812',
   'Endurance-focused Hypercar setup for a full 24-hour stint — conservative tire wear management down the Mulsanne, stable braking into the Mulsanne corner and Indianapolis.',
   array['Race', 'Safe'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '26.0 psi', 'rearTirePressure', '26.5 psi',
     'frontCamber', '-3.4°', 'rearCamber', '-2.6°',
     'frontSpring', 'Medium-stiff', 'rearSpring', 'Medium-stiff',
     'frontArb', '3 clicks', 'rearArb', '2 clicks',
     'frontRideHeight', '75 mm', 'rearRideHeight', '80 mm',
     'frontSplitter', '6', 'rearWing', '7',
     'diffPreload', '90 Nm', 'diffPower', 'Hybrid-assisted (fixed by BoP)',
     'brakeBias', '57% front', 'finalDrive', 'Long — Mulsanne Straight'
   ),
   4, 4, 64, 340, '2026-06-20'::timestamptz),

  -- Automobilista 2 -----------------------------------------------------------
  ('Automobilista 2', 'Formula Ultimate', 'Interlagos', 'Dry', '1:38.220',
   'Aggressive qualifying trim, minimum downforce for the back straight. Requires precise inputs through Senna S.',
   array['Quali', 'Aggressive'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '24.0 psi', 'rearTirePressure', '22.5 psi',
     'frontCamber', '-3.5°', 'rearCamber', '-1.9°', 'frontToe', '0.05°', 'rearToe', '0.15°',
     'frontArb', '6 clicks', 'rearArb', '4 clicks',
     'frontRideHeight', '28 mm', 'rearRideHeight', '38 mm',
     'frontWing', '2 (min front wing)', 'rearWing', '3',
     'diffPreload', '70 Nm', 'diffPower', 'On 60% / Off 40%',
     'brakeBias', '58% front', 'finalDrive', 'Long — back straight into Juncao'
   ),
   5, 2, 97, 505, '2026-06-22'::timestamptz),

  ('Automobilista 2', 'McLaren 720S GT3', 'Bathurst (Mount Panorama)', 'Mixed', '2:05.318',
   'Softened over the top through the esses with taller ride height for the compression at the top of the mountain. Safe margin for the drop down Conrod Straight.',
   array['Safe', 'Race'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '25.5 psi', 'rearTirePressure', '26.0 psi',
     'frontCamber', '-3.0°', 'rearCamber', '-2.4°', 'frontToe', '0.04°', 'rearToe', '0.10°',
     'frontArb', '2 clicks', 'rearArb', '3 clicks',
     'frontRideHeight', '66 mm', 'rearRideHeight', '72 mm',
     'frontWing', '3', 'rearWing', '4',
     'diffPreload', '50 Nm', 'diffPower', 'Fixed (GT3 homologated)',
     'brakeBias', '55% front', 'finalDrive', 'Long — Conrod Straight'
   ),
   4, 4, 47, 210, '2026-06-05'::timestamptz),

  -- F1 24 -----------------------------------------------------------------
  ('F1 24', 'F1 2024 Car', 'Silverstone', 'Mixed', '1:26.104',
   'Balanced downforce for the fast flowing sections, softened rear anti-roll bar to handle changing grip levels.',
   array['Race', 'Wet Weather'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontWing', '26', 'rearWing', '16',
     'diffOnThrottle', '65%', 'diffOffThrottle', '55%', 'engineBraking', '50%',
     'frontCamber', '-2.90°', 'rearCamber', '-1.50°', 'frontToe', '0.04°', 'rearToe', '0.08°',
     'frontArb', '6/11', 'rearArb', '5/11', 'frontRideHeight', '3/11', 'rearRideHeight', '4/11',
     'brakePressure', '95%', 'brakeBias', '54%',
     'frontTirePressure', '23.0 psi', 'rearTirePressure', '21.0 psi'
   ),
   4, 4, 132, 940, '2026-06-25'::timestamptz),

  ('F1 24', 'F1 2024 Car', 'Monaco', 'Dry', '1:12.037',
   'Max downforce street circuit tune. Short gearing for the tight hairpins, stiff front end for late braking into Turn 1.',
   array['Quali', 'Aggressive'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontWing', '48', 'rearWing', '50',
     'diffOnThrottle', '50%', 'diffOffThrottle', '65%', 'engineBraking', '40%',
     'frontCamber', '-2.60°', 'rearCamber', '-1.20°', 'frontToe', '0.06°', 'rearToe', '0.10°',
     'frontArb', '9/11', 'rearArb', '7/11', 'frontRideHeight', '1/11 (min)', 'rearRideHeight', '2/11',
     'brakePressure', '100%', 'brakeBias', '52%',
     'frontTirePressure', '24.5 psi', 'rearTirePressure', '23.0 psi'
   ),
   5, 3, 289, 2010, '2026-06-24'::timestamptz),

  ('F1 24', 'F1 2024 Car', 'Zandvoort', 'Mixed', '1:11.826',
   'Zandvoort''s banked corners reward a car that rotates freely — a touch more rear anti-roll bar and rear wing help find rotation through Turn 3 and the final banked corner without unsettling the rear on turn-in.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontWing', '28', 'rearWing', '18',
     'diffOnThrottle', '62%', 'diffOffThrottle', '52%', 'engineBraking', '45%',
     'frontCamber', '-2.85°', 'rearCamber', '-1.45°', 'frontToe', '0.05°', 'rearToe', '0.09°',
     'frontArb', '5/11', 'rearArb', '6/11', 'frontRideHeight', '3/11', 'rearRideHeight', '4/11',
     'brakePressure', '94%', 'brakeBias', '54%',
     'frontTirePressure', '22.5 psi', 'rearTirePressure', '20.5 psi'
   ),
   4, 5, 26, 110, '2026-06-30'::timestamptz),

  ('F1 24', 'F1 2024 Car', 'Marina Bay', 'Wet', '1:47.933',
   'High-downforce wet setup for Marina Bay''s bumpy, low-grip street surface — softer suspension and a rearward brake bias keep the car predictable under braking into Turn 7 and Turn 14 when the track is greasy.',
   array['Wet Weather', 'Safe'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontWing', '42', 'rearWing', '32',
     'diffOnThrottle', '58%', 'diffOffThrottle', '62%', 'engineBraking', '35%',
     'frontCamber', '-2.50°', 'rearCamber', '-1.20°', 'frontToe', '0.06°', 'rearToe', '0.11°',
     'frontArb', '3/11', 'rearArb', '4/11', 'frontRideHeight', '4/11', 'rearRideHeight', '5/11',
     'brakePressure', '88%', 'brakeBias', '51%',
     'frontTirePressure', '21.0 psi', 'rearTirePressure', '19.5 psi'
   ),
   3, 5, 33, 150, '2026-07-04'::timestamptz),

  -- F1 25 -----------------------------------------------------------------
  ('F1 25', 'F1 2025 Car', 'Suzuka', 'Dry', '1:28.947',
   'Medium-high downforce for the Esses, precise steering response through 130R without giving up too much on the back straight.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontWing', '24', 'rearWing', '14',
     'diffOnThrottle', '62%', 'diffOffThrottle', '50%',
     'frontCamber', '-2.80°', 'rearCamber', '-1.40°', 'frontToe', '0.04°', 'rearToe', '0.09°',
     'frontArb', '5/11', 'rearArb', '5/11', 'frontRideHeight', '3/11', 'rearRideHeight', '4/11',
     'brakePressure', '96%', 'brakeBias', '55%',
     'frontTirePressure', '23.2 psi', 'rearTirePressure', '21.2 psi'
   ),
   4, 4, 36, 165, '2026-06-27'::timestamptz),

  ('F1 25', 'F1 2025 Car', 'Spa-Francorchamps', 'Wet', '2:05.318',
   'Wet-weather trim with more downforce for confidence through Eau Rouge and Pouhon. Softer diff to manage traction on the painted kerbs.',
   array['Wet Weather', 'Aggressive'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontWing', '30', 'rearWing', '20',
     'diffOnThrottle', '58%', 'diffOffThrottle', '60%',
     'frontCamber', '-3.10°', 'rearCamber', '-1.70°', 'frontToe', '0.05°', 'rearToe', '0.10°',
     'frontArb', '5/11', 'rearArb', '4/11', 'frontRideHeight', '4/11', 'rearRideHeight', '5/11',
     'brakePressure', '92%', 'brakeBias', '53%',
     'frontTirePressure', '21.5 psi', 'rearTirePressure', '19.5 psi'
   ),
   4, 3, 29, 140, '2026-06-29'::timestamptz),

  ('F1 25', 'F1 2025 Car', 'Bahrain (Sakhir)', 'Dry', '1:31.245',
   'Tuned for Sakhir''s heavy braking zones and tire degradation — softer rear anti-roll bar and conservative camber keep the tires alive across a full race stint, while solid brake bias gets you stopped for Turn 1 and Turn 4.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontWing', '32', 'rearWing', '24',
     'diffOnThrottle', '60%', 'diffOffThrottle', '58%',
     'frontCamber', '-2.70°', 'rearCamber', '-1.30°', 'frontToe', '0.05°', 'rearToe', '0.09°',
     'frontArb', '4/11', 'rearArb', '5/11', 'frontRideHeight', '4/11', 'rearRideHeight', '5/11',
     'brakePressure', '97%', 'brakeBias', '53%',
     'frontTirePressure', '24.0 psi', 'rearTirePressure', '22.0 psi'
   ),
   4, 4, 22, 95, '2026-07-01'::timestamptz),

  ('F1 25', 'F1 2025 Car', 'Baku', 'Dry', '1:42.588',
   'Minimum downforce to maximize speed on the back straight, with a stable diff setting to keep the rear planted under the brutal braking zones into Turn 1 and Turn 3.',
   array['Quali', 'Aggressive'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontWing', '20', 'rearWing', '10',
     'diffOnThrottle', '55%', 'diffOffThrottle', '65%',
     'frontCamber', '-2.50°', 'rearCamber', '-1.10°', 'frontToe', '0.03°', 'rearToe', '0.07°',
     'frontArb', '3/11', 'rearArb', '4/11', 'frontRideHeight', '2/11', 'rearRideHeight', '3/11',
     'brakePressure', '100%', 'brakeBias', '56%',
     'frontTirePressure', '23.0 psi', 'rearTirePressure', '21.0 psi'
   ),
   5, 3, 41, 180, '2026-07-02'::timestamptz),

  ('F1 25', 'F1 2025 Car', 'Las Vegas', 'Dry', '1:33.702',
   'Vegas'' cold track temps make tire warm-up the main challenge — low downforce for the long straights paired with conservative camber to help the tires reach operating temperature without overheating late in a stint.',
   array['Race', 'Safe'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontWing', '18', 'rearWing', '8',
     'diffOnThrottle', '50%', 'diffOffThrottle', '60%',
     'frontCamber', '-2.40°', 'rearCamber', '-1.00°', 'frontToe', '0.03°', 'rearToe', '0.06°',
     'frontArb', '3/11', 'rearArb', '3/11', 'frontRideHeight', '2/11', 'rearRideHeight', '3/11',
     'brakePressure', '98%', 'brakeBias', '54%',
     'frontTirePressure', '22.5 psi', 'rearTirePressure', '20.5 psi'
   ),
   4, 4, 18, 77, '2026-07-03'::timestamptz),

  -- Gran Turismo 7 -----------------------------------------------------------
  ('Gran Turismo 7', 'Toyota GR Supra Race Car ''19', 'Fuji Speedway', 'Dry', '1:42.775',
   'Gr.3 tune leaning on the LSD for rotation out of the final corner onto the front straight. Lowered ride height for the elevation changes.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontRideHeight', '95 mm', 'rearRideHeight', '100 mm',
     'frontCamber', '-3.0°', 'rearCamber', '-1.8°',
     'frontToe', '0.10° (toe-in)', 'rearToe', '0.08° (toe-in)',
     'frontArb', '5', 'rearArb', '4',
     'lsdInitial', '12', 'lsdAccel', '25', 'lsdBraking', '18',
     'finalGear', '4.100', 'frontDownforce', '190', 'rearDownforce', '270',
     'brakeBalance', '-2 (rear-biased)', 'ballastWeight', '0 kg', 'ballastPosition', '0 (centered)',
     'tireCompound', 'Racing: Medium'
   ),
   4, 4, 22, 95, '2026-06-08'::timestamptz),

  ('Gran Turismo 7', 'Mazda MX-5 (ND)', 'Tsukuba Circuit', 'Dry', '0:55.412',
   'Simple beginner tune for a short, technical track — softer springs and a calmer LSD so newcomers can find the limit without snap oversteer.',
   array['Beginner', 'Safe'], 'Gamepad',
   jsonb_build_object(
     'frontRideHeight', '110 mm', 'rearRideHeight', '112 mm',
     'frontCamber', '-1.8°', 'rearCamber', '-1.0°',
     'frontToe', '0.05° (toe-in)', 'rearToe', '0.05° (toe-in)',
     'frontArb', '3', 'rearArb', '2',
     'lsdInitial', '8', 'lsdAccel', '15', 'lsdBraking', '10',
     'finalGear', 'Auto-set top speed',
     'brakeBalance', '0 (balanced)', 'ballastWeight', '0 kg', 'ballastPosition', '0 (centered)',
     'tireCompound', 'Sports: Hard'
   ),
   3, 5, 15, 68, '2026-04-25'::timestamptz)

) as v(game, car, track, condition, lap_time, description, tags, rig_profile,
       setup_values, pace, predictability, upvotes, downloads, created_at)
where exists (select 1 from public.profiles);
