-- Adds sample setups for the games that had zero coverage in seed.sql
-- (Assetto Corsa EVO, F1 23/22/21/2020/2019), plus a few more combos for
-- variety in games that already had entries. Same approach as seed.sql:
-- values are informed by public setup-guide consensus (Coach Dave Academy,
-- simracingsetup.com guides, F1Laps, Outsider Gaming), not copied from any
-- single published setup.
--
-- Run this AFTER seed.sql (or standalone) once you've logged in with
-- Discord at least once. Safe to run alongside seed.sql without touching
-- those rows — this only inserts new ones.

insert into public.setups
  (user_id, game, car, track, condition, lap_time, description, tags, rig_profile,
   setup_values, pace, predictability, upvotes, downloads, created_at)
select
  (select id from public.profiles order by created_at asc limit 1),
  v.game, v.car, v.track, v.condition, v.lap_time, v.description, v.tags, v.rig_profile,
  v.setup_values, v.pace, v.predictability, v.upvotes, v.downloads, v.created_at
from (values
  ('Assetto Corsa EVO', 'BMW M4 GT3', 'Brands Hatch', 'Dry', '1:23.115',
   'Fresh EVO-physics tune — slightly more front camber than you''d run in ACC to lean into the new tire model''s grip window. Confident through Paddock Hill Bend.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '27.0 psi',
     'rearTirePressure', '27.5 psi',
     'frontCamber', '-3.8°',
     'rearCamber', '-3.2°',
     'frontArb', '2 clicks',
     'rearArb', '3 clicks',
     'frontRideHeight', '58 mm',
     'rearRideHeight', '64 mm',
     'frontAero', '3',
     'rearAero', '4',
     'diffPreload', '55 Nm',
     'diffPower', 'Fixed (GT3 homologated)',
     'brakeBias', '56% front',
     'finalDrive', 'Balanced — Paddock Hill Bend'
   ),
   4, 4, 42, 180, '2026-07-02'::timestamptz),

  ('F1 23', 'F1 2023 Car', 'Circuit of the Americas', 'Dry', '1:33.512',
   'Medium downforce build for COTA''s mix of high-speed esses and the long back straight. Stable rotation through the Turn 1 uphill.',
   array['Race'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontTirePressure', '23.5 psi',
     'rearTirePressure', '21.5 psi',
     'frontCamber', 'Fixed (not adjustable in-game)',
     'rearCamber', 'Fixed (not adjustable in-game)',
     'frontArb', '5/11',
     'rearArb', '5/11',
     'frontRideHeight', '4/11',
     'rearRideHeight', '5/11',
     'frontAero', '24',
     'rearAero', '18',
     'diffPreload', 'N/A',
     'diffPower', 'On 60% / Off 50%',
     'brakeBias', '55% front',
     'finalDrive', 'Medium — COTA back straight'
   ),
   4, 4, 76, 410, '2026-06-10'::timestamptz),

  ('F1 22', 'F1 2022 Car', 'Baku City Circuit', 'Dry', '1:42.891',
   'Low downforce street circuit setup for the long main straight, with careful brake bias for the castle section''s heavy stops.',
   array['Quali', 'Aggressive'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontTirePressure', '24.0 psi',
     'rearTirePressure', '22.0 psi',
     'frontCamber', 'Fixed (not adjustable in-game)',
     'rearCamber', 'Fixed (not adjustable in-game)',
     'frontArb', '4/11',
     'rearArb', '4/11',
     'frontRideHeight', '2/11',
     'rearRideHeight', '3/11',
     'frontAero', '12 (low downforce)',
     'rearAero', '9',
     'diffPreload', 'N/A',
     'diffPower', 'On 68% / Off 45%',
     'brakeBias', '51% front',
     'finalDrive', 'Long — main straight top speed'
   ),
   5, 3, 58, 295, '2026-05-28'::timestamptz),

  ('F1 21', 'F1 2021 Car', 'Losail International Circuit', 'Dry', '1:23.196',
   'High-speed flowing layout, medium-high rear wing for stability through the fast middle sector at night.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '23.0 psi',
     'rearTirePressure', '21.5 psi',
     'frontCamber', 'Fixed (not adjustable in-game)',
     'rearCamber', 'Fixed (not adjustable in-game)',
     'frontArb', '6/11',
     'rearArb', '5/11',
     'frontRideHeight', '4/11',
     'rearRideHeight', '4/11',
     'frontAero', '22',
     'rearAero', '15',
     'diffPreload', 'N/A',
     'diffPower', 'On 62% / Off 55%',
     'brakeBias', '54% front',
     'finalDrive', 'Balanced — flowing middle sector'
   ),
   4, 4, 33, 150, '2026-05-15'::timestamptz),

  ('F1 2020', 'F1 2020 Car', 'Mugello', 'Dry', '1:15.144',
   'Historic Mugello layout tune — high-speed direction changes need a stiffer front end, short gearing for the tight Bucine exit.',
   array['Quali', 'Aggressive'], 'Gamepad',
   jsonb_build_object(
     'frontTirePressure', '22.5 psi',
     'rearTirePressure', '21.0 psi',
     'frontCamber', 'Fixed (not adjustable in-game)',
     'rearCamber', 'Fixed (not adjustable in-game)',
     'frontArb', '7/11',
     'rearArb', '5/11',
     'frontRideHeight', '2/11',
     'rearRideHeight', '3/11',
     'frontAero', '20',
     'rearAero', '13',
     'diffPreload', 'N/A',
     'diffPower', 'On 65% / Off 50%',
     'brakeBias', '53% front',
     'finalDrive', 'Short — Bucine exit'
   ),
   5, 2, 21, 96, '2026-04-30'::timestamptz),

  ('F1 2019', 'F1 2019 Car', 'Circuit de Barcelona-Catalunya', 'Dry', '1:17.043',
   'Classic Barcelona all-rounder setup — balanced for Turn 3''s long right-hander and traction out of the final chicane.',
   array['Race', 'Safe'], 'Wheel + Handbrake',
   jsonb_build_object(
     'frontTirePressure', '23.5 psi',
     'rearTirePressure', '22.0 psi',
     'frontCamber', 'Fixed (not adjustable in-game)',
     'rearCamber', 'Fixed (not adjustable in-game)',
     'frontArb', '5/11',
     'rearArb', '5/11',
     'frontRideHeight', '3/11',
     'rearRideHeight', '4/11',
     'frontAero', '27',
     'rearAero', '19',
     'diffPreload', 'N/A',
     'diffPower', 'On 58% / Off 52%',
     'brakeBias', '55% front',
     'finalDrive', 'Balanced — final chicane traction'
   ),
   3, 5, 19, 88, '2026-04-18'::timestamptz),

  ('Automobilista 2', 'McLaren 720S GT3', 'Bathurst (Mount Panorama)', 'Mixed', '2:05.318',
   'Softened over the top through the esses with taller ride height for the compression at the top of the mountain. Safe margin for the drop down Conrod Straight.',
   array['Safe', 'Race'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '25.5 psi',
     'rearTirePressure', '26.0 psi',
     'frontCamber', '-3.0°',
     'rearCamber', '-2.4°',
     'frontArb', '2 clicks',
     'rearArb', '3 clicks',
     'frontRideHeight', '66 mm',
     'rearRideHeight', '72 mm',
     'frontAero', '3',
     'rearAero', '4',
     'diffPreload', '50 Nm',
     'diffPower', 'Fixed (GT3 homologated)',
     'brakeBias', '55% front',
     'finalDrive', 'Long — Conrod Straight'
   ),
   4, 4, 47, 210, '2026-06-05'::timestamptz),

  ('Assetto Corsa', 'Bentley Continental GT3', 'Silverstone', 'Wet', '2:12.640',
   'Wet-weather GT3 tune with taller gearing and extra front wing for standing water through Maggotts-Becketts. Predictable on cold tires at the start.',
   array['Wet Weather', 'Safe'], 'Wheel + 3 Pedals',
   jsonb_build_object(
     'frontTirePressure', '24.5 psi',
     'rearTirePressure', '25.0 psi',
     'frontCamber', '-2.5°',
     'rearCamber', '-2.0°',
     'frontArb', '1 click',
     'rearArb', '1 click',
     'frontRideHeight', '70 mm',
     'rearRideHeight', '76 mm',
     'frontAero', '5',
     'rearAero', '6 (max wet wing)',
     'diffPreload', '45 Nm',
     'diffPower', 'Fixed (GT3-spec mod)',
     'brakeBias', '54% front',
     'finalDrive', 'Tall — standing water'
   ),
   3, 4, 28, 122, '2026-05-20'::timestamptz),

  ('Le Mans Ultimate', 'Porsche 963', 'Circuit de la Sarthe (Le Mans)', 'Mixed', '3:26.812',
   'Endurance-focused Hypercar setup for a full 24-hour stint — conservative tire wear management down the Mulsanne, stable braking into the Mulsanne corner and Indianapolis.',
   array['Race', 'Safe'], 'Direct Drive + Load Cell',
   jsonb_build_object(
     'frontTirePressure', '26.0 psi',
     'rearTirePressure', '26.5 psi',
     'frontCamber', '-3.4°',
     'rearCamber', '-2.6°',
     'frontArb', '3 clicks',
     'rearArb', '2 clicks',
     'frontRideHeight', '75 mm',
     'rearRideHeight', '80 mm',
     'frontAero', '6',
     'rearAero', '7',
     'diffPreload', '90 Nm',
     'diffPower', 'Hybrid-assisted (fixed by BoP)',
     'brakeBias', '57% front',
     'finalDrive', 'Long — Mulsanne Straight'
   ),
   4, 4, 64, 340, '2026-06-20'::timestamptz)
) as v(game, car, track, condition, lap_time, description, tags, rig_profile,
       setup_values, pace, predictability, upvotes, downloads, created_at)
where exists (select 1 from public.profiles);
