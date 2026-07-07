-- Drops F1 24 from the supported games list, leaving F1 25 as the only F1
-- title. Same pattern as 0002_update_games_list.sql: remove any existing
-- rows for the dropped game first so the new check constraint doesn't fail.

delete from public.setups where game = 'F1 24';

alter table public.setups drop constraint setups_game_check;

alter table public.setups add constraint setups_game_check check (game in (
  'iRacing', 'Assetto Corsa EVO', 'Assetto Corsa Competizione', 'Assetto Corsa',
  'Le Mans Ultimate', 'Automobilista 2', 'Gran Turismo 7',
  'F1 25'
));
