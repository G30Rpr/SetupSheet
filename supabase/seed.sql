-- Optional: seeds the setups table with the same research-grounded sample
-- data that used to live in src/lib/data.ts, so the site isn't empty right
-- after you apply 0001_init_setups_schema.sql.
--
-- Log in with Discord on the site at least once first (so a row exists in
-- public.profiles), then run this in the Supabase SQL Editor. All 12 rows
-- are attributed to whichever profile was created first — edit the
-- subquery below if you want a different owner.

insert into public.setups
  (user_id, game, car, track, condition, lap_time, description, tags, rig_profile,
   setup_values, pace, predictability, upvotes, downloads, created_at)
select
  (select id from public.profiles order by created_at asc limit 1),
  v.game, v.car, v.track, v.condition, v.lap_time, v.description, v.tags, v.rig_profile,
  v.setup_values, v.pace, v.predictability, v.upvotes, v.downloads, v.created_at
from (values
  ('iRacing', 'Porsche 992 GT3 Cup', 'Spa-Francorchamps', 'Dry', '2:16.482',
   'Stable rear end through Eau Rouge with a touch more front splitter for confidence on entry. Great for long stints.',
   array['Safe', 'Race'], 'Direct Drive + Load Cell',
   '{"frontTirePressure":"23.5 psi","rearTirePressure":"24.0 psi","frontCamber":"-3.2°","rearCamber":"-2.7°","frontArb":"3 clicks","rearArb":"4 clicks","frontRideHeight":"65 mm","rearRideHeight":"72 mm","frontAero":"3","rearAero":"5","diffPreload":"65 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"56% front","finalDrive":"Long — Spa'\''s straights"}'::jsonb,
   4, 5, 214, 1820, '2026-06-28'::timestamptz),

  ('Assetto Corsa Competizione', 'Ferrari 296 GT3', 'Monza', 'Dry', '1:47.312',
   'Low drag qualifying setup, max top speed down the straights. Twitchy on cold tires so build up to the limit.',
   array['Quali', 'Aggressive'], 'Wheel + 3 Pedals',
   '{"frontTirePressure":"26.3 psi","rearTirePressure":"26.8 psi","frontCamber":"-4.3°","rearCamber":"-3.8°","frontArb":"2 clicks","rearArb":"2 clicks","frontRideHeight":"52 mm","rearRideHeight":"58 mm","frontAero":"1 (min downforce)","rearAero":"2","diffPreload":"40 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"58% front","finalDrive":"Short — Monza top speed"}'::jsonb,
   5, 2, 358, 2650, '2026-06-30'::timestamptz),

  ('F1 24', 'F1 2024 Car', 'Silverstone', 'Mixed', '1:26.104',
   'Balanced downforce for the fast flowing sections, softened rear anti-roll bar to handle changing grip levels.',
   array['Race', 'Wet Weather'], 'Wheel + Handbrake',
   '{"frontTirePressure":"23.0 psi","rearTirePressure":"21.0 psi","frontCamber":"Fixed (not adjustable in-game)","rearCamber":"Fixed (not adjustable in-game)","frontArb":"6/11","rearArb":"5/11","frontRideHeight":"3/11","rearRideHeight":"4/11","frontAero":"26","rearAero":"16","diffPreload":"N/A","diffPower":"On 65% / Off 55%","brakeBias":"54% front","finalDrive":"Balanced for Copse/Maggotts-Becketts"}'::jsonb,
   4, 4, 132, 940, '2026-06-25'::timestamptz),

  ('Le Mans Ultimate', 'BMW M4 GT3', 'Fuji Speedway', 'Dry', '1:52.771',
   'Beginner friendly setup with softer springs and extra ride height for the kerbs. Forgiving under braking.',
   array['Beginner', 'Safe'], 'Gamepad',
   '{"frontTirePressure":"25.0 psi","rearTirePressure":"25.5 psi","frontCamber":"-3.0°","rearCamber":"-2.5°","frontArb":"1 click","rearArb":"2 clicks","frontRideHeight":"70 mm","rearRideHeight":"76 mm","frontAero":"3","rearAero":"4","diffPreload":"35 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"53% front","finalDrive":"Medium — Fuji'\''s back straight"}'::jsonb,
   3, 5, 89, 610, '2026-06-20'::timestamptz),

  ('iRacing', 'Dallara IR-18', 'Road America', 'Dry', '2:04.998',
   'High-speed stability build for the oval-adjacent kink. Slightly loose on exit to rotate faster mid-corner.',
   array['Race', 'Aggressive'], 'Direct Drive + Load Cell',
   '{"frontTirePressure":"24.5 psi","rearTirePressure":"23.5 psi","frontCamber":"-3.8°","rearCamber":"-1.8°","frontArb":"5 clicks","rearArb":"3 clicks","frontRideHeight":"35 mm","rearRideHeight":"45 mm","frontAero":"P4 (low downforce)","rearAero":"P5","diffPreload":"80 Nm","diffPower":"45% / 30%","brakeBias":"52% front","finalDrive":"Short — Turn 5-6 exit"}'::jsonb,
   5, 3, 176, 1210, '2026-06-29'::timestamptz),

  ('Assetto Corsa Competizione', 'Audi R8 LMS Evo II', 'Spa-Francorchamps', 'Wet', '2:31.640',
   'Full wet tune with taller gearing for standing water and extra front wing to keep the nose planted at Eau Rouge.',
   array['Wet Weather', 'Safe'], 'Wheel + 3 Pedals',
   '{"frontTirePressure":"25.0 psi","rearTirePressure":"25.5 psi","frontCamber":"-2.8°","rearCamber":"-2.2°","frontArb":"1 click","rearArb":"2 clicks","frontRideHeight":"68 mm","rearRideHeight":"74 mm","frontAero":"5","rearAero":"6 (max wet wing)","diffPreload":"50 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"55% front","finalDrive":"Tall — standing water on Kemmel"}'::jsonb,
   4, 4, 261, 1590, '2026-06-27'::timestamptz),

  ('Automobilista 2', 'Formula Ultimate', 'Interlagos', 'Dry', '1:38.220',
   'Aggressive qualifying trim, minimum downforce for the back straight. Requires precise inputs through Senna S.',
   array['Quali', 'Aggressive'], 'Direct Drive + Load Cell',
   '{"frontTirePressure":"24.0 psi","rearTirePressure":"22.5 psi","frontCamber":"-3.5°","rearCamber":"-1.9°","frontArb":"6 clicks","rearArb":"4 clicks","frontRideHeight":"28 mm","rearRideHeight":"38 mm","frontAero":"2 (min front wing)","rearAero":"3","diffPreload":"70 Nm","diffPower":"On 60% / Off 40%","brakeBias":"58% front","finalDrive":"Long — back straight into Juncao"}'::jsonb,
   5, 2, 97, 505, '2026-06-22'::timestamptz),

  ('Assetto Corsa', 'Mazda MX-5 Cup', 'Suzuka', 'Dry', '2:02.410',
   'Simple, planted setup for newcomers to the track. Predictable rotation through the Esses with no snap oversteer.',
   array['Beginner', 'Safe'], 'Gamepad',
   '{"frontTirePressure":"30.0 psi","rearTirePressure":"29.0 psi","frontCamber":"-2.0°","rearCamber":"-1.5°","frontArb":"2 clicks (soft)","rearArb":"1 click","frontRideHeight":"90 mm","rearRideHeight":"95 mm","frontAero":"N/A (no wing)","rearAero":"N/A (no wing)","diffPreload":"25 Nm","diffPower":"Stock (one-make spec)","brakeBias":"60% front","finalDrive":"Stock"}'::jsonb,
   3, 5, 64, 402, '2026-06-18'::timestamptz),

  ('iRacing', 'Mercedes AMG GT3', 'Watkins Glen', 'Mixed', '1:41.556',
   'Versatile setup for changeable conditions, medium downforce with a wet-ready alignment that still works in the dry.',
   array['Race', 'Safe'], 'Wheel + 3 Pedals',
   '{"frontTirePressure":"24.0 psi","rearTirePressure":"24.5 psi","frontCamber":"-3.0°","rearCamber":"-2.5°","frontArb":"3 clicks","rearArb":"3 clicks","frontRideHeight":"62 mm","rearRideHeight":"68 mm","frontAero":"4","rearAero":"4","diffPreload":"55 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"55% front","finalDrive":"Balanced — the Boot section"}'::jsonb,
   4, 4, 145, 780, '2026-07-01'::timestamptz),

  ('F1 24', 'F1 2024 Car', 'Monaco', 'Dry', '1:12.037',
   'Max downforce street circuit tune. Short gearing for the tight hairpins, stiff front end for late braking into Turn 1.',
   array['Quali', 'Aggressive'], 'Wheel + Handbrake',
   '{"frontTirePressure":"24.5 psi","rearTirePressure":"23.0 psi","frontCamber":"Fixed (not adjustable in-game)","rearCamber":"Fixed (not adjustable in-game)","frontArb":"9/11","rearArb":"7/11","frontRideHeight":"1/11 (min)","rearRideHeight":"2/11","frontAero":"48 (max downforce)","rearAero":"50","diffPreload":"N/A","diffPower":"On 50% / Off 65%","brakeBias":"52% front","finalDrive":"Short — hairpin to hairpin"}'::jsonb,
   5, 3, 289, 2010, '2026-06-24'::timestamptz),

  ('Assetto Corsa Competizione', 'Lamborghini Huracán GT3 Evo2', 'Zandvoort', 'Dry', '1:36.882',
   'Balanced race setup that manages tire wear over 40+ minute stints without losing rear stability in the banked final corner.',
   array['Race', 'Safe'], 'Direct Drive + Load Cell',
   '{"frontTirePressure":"26.5 psi","rearTirePressure":"27.0 psi","frontCamber":"-3.6°","rearCamber":"-3.0°","frontArb":"3 clicks","rearArb":"3 clicks","frontRideHeight":"60 mm","rearRideHeight":"65 mm","frontAero":"4","rearAero":"4","diffPreload":"60 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"56% front","finalDrive":"Balanced — banked final corner"}'::jsonb,
   4, 4, 121, 655, '2026-06-15'::timestamptz),

  ('Le Mans Ultimate', 'Porsche 911 GT3 R', 'Sebring', 'Dry', '2:01.933',
   'Beginner-safe ride height and soft compression to absorb the bumps without unsettling the car through the infield.',
   array['Beginner', 'Safe'], 'Wheel + 3 Pedals',
   '{"frontTirePressure":"24.0 psi","rearTirePressure":"24.5 psi","frontCamber":"-2.8°","rearCamber":"-2.3°","frontArb":"1 click (soft)","rearArb":"2 clicks","frontRideHeight":"72 mm","rearRideHeight":"76 mm","frontAero":"4","rearAero":"5","diffPreload":"35 Nm","diffPower":"Fixed (GT3 homologated)","brakeBias":"54% front","finalDrive":"Medium — bumpy infield section"}'::jsonb,
   3, 5, 58, 340, '2026-06-12'::timestamptz)
) as v(game, car, track, condition, lap_time, description, tags, rig_profile,
       setup_values, pace, predictability, upvotes, downloads, created_at)
where exists (select 1 from public.profiles);
