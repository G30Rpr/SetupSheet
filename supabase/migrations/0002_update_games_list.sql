-- Updates the supported games list: drops F1 2019-23, adds F1 25 and
-- Gran Turismo 7. Run this after 0001_init_setups_schema.sql has already
-- been applied (paste into the Supabase SQL Editor and run, same as before).

-- Remove any existing setups for the games being dropped, so the new
-- check constraint below doesn't fail on rows that no longer qualify.
delete from public.setups
where game in ('F1 23', 'F1 22', 'F1 21', 'F1 2020', 'F1 2019');

alter table public.setups drop constraint setups_game_check;

alter table public.setups add constraint setups_game_check check (game in (
  'iRacing', 'Assetto Corsa EVO', 'Assetto Corsa Competizione', 'Assetto Corsa',
  'Le Mans Ultimate', 'Automobilista 2', 'Gran Turismo 7',
  'F1 25', 'F1 24'
));
