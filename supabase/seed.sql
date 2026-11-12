-- Bloud seed — generated from src/data/catalogue.ts + src/data/seed.ts
-- Re-runnable: every statement is an upsert on the natural key.

insert into public.app_users (id, display_name, initials, color_a, color_b) values
  ('me', 'Alex', 'A', '#4fe3a1', '#1a8f68'),
  ('partner', 'Sam', 'S', '#ff8fb1', '#b43d78')
on conflict (id) do update set display_name = excluded.display_name, initials = excluded.initials, color_a = excluded.color_a, color_b = excluded.color_b;

insert into public.artists (id, name, genre, bio, monthly_listeners, art) values
  ('mira-calder', 'Mira Calder', 'Dream pop', 'Hushed vocals and hazy synths from a bedroom studio above a bakery.', 2418903, '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"orbit","seed":3}'::jsonb),
  ('hollow-atlas', 'Hollow Atlas', 'Electronic', 'Two producers mapping coastlines in pulses and long reverb tails.', 1204551, '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"rings","seed":5}'::jsonb),
  ('juno-and-the-tides', 'Juno & the Tides', 'Folk', 'Fingerpicked guitars, harbour towns and four-part harmonies.', 893240, '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"sun","seed":2}'::jsonb),
  ('vesper-lane', 'Vesper Lane', 'R&B', 'Late-night R&B built from voicemails, vinyl crackle and slow bass.', 3102776, '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"waves","seed":4}'::jsonb),
  ('koji-aurel', 'Kōji Aurel', 'Ambient', 'Patient, room-sized ambient pieces for reading and rain.', 540118, '{"palette":["#9fb7c9","#1d2a35","#e9e2d0"],"pattern":"dunes","seed":1}'::jsonb),
  ('paper-satellites', 'The Paper Satellites', 'Indie rock', 'Four friends, one van, and choruses made for open windows.', 1776340, '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":6}'::jsonb),
  ('noor-valen', 'Noor Valen', 'Alt pop', 'Glossy hooks with a restless heart.', 4020912, '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"sun","seed":5}'::jsonb),
  ('static-orchard', 'Static Orchard', 'Synthwave', 'Analogue arpeggios and chrome-plated nostalgia.', 962004, '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":2}'::jsonb),
  ('lune-ardent', 'Lune Ardent', 'Pop', 'Soft-focus chanson-pop, sung at the edge of sleep.', 1330421, '{"palette":["#f7c6d9","#5b2a4a","#fff0c2"],"pattern":"orbit","seed":1}'::jsonb),
  ('dax-meridian', 'Dax Meridian', 'Hip-hop', 'Lo-fi boom-bap diary entries from the night bus.', 2240876, '{"palette":["#ff9f1c","#1b1b1b","#2ec4b6"],"pattern":"stripes","seed":3}'::jsonb)
on conflict (id) do update set name = excluded.name, genre = excluded.genre, bio = excluded.bio, monthly_listeners = excluded.monthly_listeners, art = excluded.art;

insert into public.albums (id, title, artist_id, year, genre, art, added_at, track_ids) values
  ('afterglow-theory', 'Afterglow Theory', 'noor-valen', 2025, 'Alt pop', '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"split","seed":16}'::jsonb, '2025-05-02', ARRAY['afterglow-theory-1-afterglow-theory','afterglow-theory-2-second-skin','afterglow-theory-3-gold-hour','afterglow-theory-4-flicker']),
  ('midnight-parade', 'Midnight Parade', 'mira-calder', 2024, 'Dream pop', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":15}'::jsonb, '2025-04-18', ARRAY['midnight-parade-1-neon-orchard','midnight-parade-2-midnight-parade','midnight-parade-3-slow-fireworks','midnight-parade-4-glass-hour','midnight-parade-5-paper-moons']),
  ('velvet-static', 'Velvet Static', 'vesper-lane', 2024, 'R&B', '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"orbit","seed":13}'::jsonb, '2025-04-02', ARRAY['velvet-static-1-velvet-static','velvet-static-2-stay-till-morning','velvet-static-3-honey-weather','velvet-static-4-2-am-voicemail']),
  ('low-tide-signals', 'Low Tide Signals', 'hollow-atlas', 2023, 'Electronic', '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"waves","seed":16}'::jsonb, '2025-03-21', ARRAY['low-tide-signals-1-low-tide','low-tide-signals-2-signal-fade','low-tide-signals-3-cartographer','low-tide-signals-4-afterimage']),
  ('lowlight-tapes', 'Lowlight Tapes', 'dax-meridian', 2024, 'Hip-hop', '{"palette":["#ff9f1c","#1b1b1b","#2ec4b6"],"pattern":"stripes","seed":14}'::jsonb, '2025-03-09', ARRAY['lowlight-tapes-1-lowlight','lowlight-tapes-2-corner-store-poetr','lowlight-tapes-3-metro-hum','lowlight-tapes-4-late-bus-home']),
  ('northern-lines', 'Northern Lines', 'juno-and-the-tides', 2024, 'Folk', '{"palette":["#7fb5ff","#0e2038","#e6f0ff"],"pattern":"waves","seed":14}'::jsonb, '2025-02-24', ARRAY['northern-lines-1-northern-lines','northern-lines-2-frostbite-letters','northern-lines-3-cabin-radio']),
  ('chrome-horizon', 'Chrome Horizon', 'static-orchard', 2022, 'Synthwave', '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":14}'::jsonb, '2025-02-11', ARRAY['chrome-horizon-1-chrome-horizon','chrome-horizon-2-night-drive-84','chrome-horizon-3-laser-garden','chrome-horizon-4-rewind-city']),
  ('satellite-hearts', 'Satellite Hearts', 'paper-satellites', 2023, 'Indie rock', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":16}'::jsonb, '2025-01-30', ARRAY['satellite-hearts-1-satellite-hearts','satellite-hearts-2-backseat-constella','satellite-hearts-3-run-it-back','satellite-hearts-4-sundial','satellite-hearts-5-loose-change']),
  ('salt-and-cedar', 'Salt & Cedar', 'juno-and-the-tides', 2022, 'Folk', '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"dunes","seed":12}'::jsonb, '2025-01-12', ARRAY['salt-and-cedar-1-salt-and-cedar','salt-and-cedar-2-harbor-lights','salt-and-cedar-3-the-long-way-round','salt-and-cedar-4-kindling','salt-and-cedar-5-tidewater']),
  ('fleur-de-minuit', 'Fleur de Minuit', 'lune-ardent', 2023, 'Pop', '{"palette":["#f7c6d9","#5b2a4a","#fff0c2"],"pattern":"rings","seed":15}'::jsonb, '2024-12-20', ARRAY['fleur-de-minuit-1-fleur-de-minuit','fleur-de-minuit-2-soleil-bleu','fleur-de-minuit-3-danse-lente','fleur-de-minuit-4-petit-matin']),
  ('blue-hour', 'Blue Hour', 'mira-calder', 2022, 'Dream pop', '{"palette":["#4f7cff","#0d1440","#9ee7ff"],"pattern":"rings","seed":9}'::jsonb, '2024-11-30', ARRAY['blue-hour-1-blue-hour','blue-hour-2-window-seat','blue-hour-3-paper-moons-acoust']),
  ('quiet-rooms', 'Quiet Rooms', 'koji-aurel', 2021, 'Ambient', '{"palette":["#9fb7c9","#1d2a35","#e9e2d0"],"pattern":"dunes","seed":11}'::jsonb, '2024-11-02', ARRAY['quiet-rooms-1-quiet-rooms-i','quiet-rooms-2-quiet-rooms-ii','quiet-rooms-3-paper-lanterns','quiet-rooms-4-snowfall-in-august'])
on conflict (id) do update set title = excluded.title, artist_id = excluded.artist_id, year = excluded.year, genre = excluded.genre, art = excluded.art, added_at = excluded.added_at, track_ids = excluded.track_ids;

insert into public.tracks (id, title, artist_id, album_id, duration, genre, art, added_at, lyric_set, explicit, position) values
  ('afterglow-theory-1-afterglow-theory', 'Afterglow Theory', 'noor-valen', 'afterglow-theory', 199, 'Alt pop', '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"split","seed":16}'::jsonb, '2025-05-02', 0, false, 1),
  ('afterglow-theory-2-second-skin', 'Second Skin', 'noor-valen', 'afterglow-theory', 214, 'Alt pop', '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"split","seed":16}'::jsonb, '2025-05-02', 0, false, 2),
  ('afterglow-theory-3-gold-hour', 'Gold Hour', 'noor-valen', 'afterglow-theory', 227, 'Alt pop', '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"split","seed":16}'::jsonb, '2025-05-02', 0, false, 3),
  ('afterglow-theory-4-flicker', 'Flicker', 'noor-valen', 'afterglow-theory', 184, 'Alt pop', '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"split","seed":16}'::jsonb, '2025-05-02', 0, false, 4),
  ('midnight-parade-1-neon-orchard', 'Neon Orchard', 'mira-calder', 'midnight-parade', 212, 'Dream pop', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":15}'::jsonb, '2025-04-18', 0, false, 1),
  ('midnight-parade-2-midnight-parade', 'Midnight Parade', 'mira-calder', 'midnight-parade', 198, 'Dream pop', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":15}'::jsonb, '2025-04-18', 0, false, 2),
  ('midnight-parade-3-slow-fireworks', 'Slow Fireworks', 'mira-calder', 'midnight-parade', 241, 'Dream pop', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":15}'::jsonb, '2025-04-18', 0, false, 3),
  ('midnight-parade-4-glass-hour', 'Glass Hour', 'mira-calder', 'midnight-parade', 187, 'Dream pop', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":15}'::jsonb, '2025-04-18', 0, false, 4),
  ('midnight-parade-5-paper-moons', 'Paper Moons', 'mira-calder', 'midnight-parade', 226, 'Dream pop', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":15}'::jsonb, '2025-04-18', 0, false, 5),
  ('velvet-static-1-velvet-static', 'Velvet Static', 'vesper-lane', 'velvet-static', 208, 'R&B', '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"orbit","seed":13}'::jsonb, '2025-04-02', 1, false, 1),
  ('velvet-static-2-stay-till-morning', 'Stay Till Morning', 'vesper-lane', 'velvet-static', 236, 'R&B', '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"orbit","seed":13}'::jsonb, '2025-04-02', 1, false, 2),
  ('velvet-static-3-honey-weather', 'Honey Weather', 'vesper-lane', 'velvet-static', 192, 'R&B', '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"orbit","seed":13}'::jsonb, '2025-04-02', 1, false, 3),
  ('velvet-static-4-2-am-voicemail', '2 AM Voicemail', 'vesper-lane', 'velvet-static', 215, 'R&B', '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"orbit","seed":13}'::jsonb, '2025-04-02', 1, false, 4),
  ('low-tide-signals-1-low-tide', 'Low Tide', 'hollow-atlas', 'low-tide-signals', 263, 'Electronic', '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"waves","seed":16}'::jsonb, '2025-03-21', 2, false, 1),
  ('low-tide-signals-2-signal-fade', 'Signal Fade', 'hollow-atlas', 'low-tide-signals', 221, 'Electronic', '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"waves","seed":16}'::jsonb, '2025-03-21', 2, false, 2),
  ('low-tide-signals-3-cartographer', 'Cartographer', 'hollow-atlas', 'low-tide-signals', 284, 'Electronic', '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"waves","seed":16}'::jsonb, '2025-03-21', 2, false, 3),
  ('low-tide-signals-4-afterimage', 'Afterimage', 'hollow-atlas', 'low-tide-signals', 207, 'Electronic', '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"waves","seed":16}'::jsonb, '2025-03-21', 2, false, 4),
  ('lowlight-tapes-1-lowlight', 'Lowlight', 'dax-meridian', 'lowlight-tapes', 171, 'Hip-hop', '{"palette":["#ff9f1c","#1b1b1b","#2ec4b6"],"pattern":"stripes","seed":14}'::jsonb, '2025-03-09', 3, false, 1),
  ('lowlight-tapes-2-corner-store-poetr', 'Corner Store Poetry', 'dax-meridian', 'lowlight-tapes', 198, 'Hip-hop', '{"palette":["#ff9f1c","#1b1b1b","#2ec4b6"],"pattern":"stripes","seed":14}'::jsonb, '2025-03-09', 3, true, 2),
  ('lowlight-tapes-3-metro-hum', 'Metro Hum', 'dax-meridian', 'lowlight-tapes', 186, 'Hip-hop', '{"palette":["#ff9f1c","#1b1b1b","#2ec4b6"],"pattern":"stripes","seed":14}'::jsonb, '2025-03-09', 3, false, 3),
  ('lowlight-tapes-4-late-bus-home', 'Late Bus Home', 'dax-meridian', 'lowlight-tapes', 209, 'Hip-hop', '{"palette":["#ff9f1c","#1b1b1b","#2ec4b6"],"pattern":"stripes","seed":14}'::jsonb, '2025-03-09', 3, true, 4),
  ('northern-lines-1-northern-lines', 'Northern Lines', 'juno-and-the-tides', 'northern-lines', 221, 'Folk', '{"palette":["#7fb5ff","#0e2038","#e6f0ff"],"pattern":"waves","seed":14}'::jsonb, '2025-02-24', 4, false, 1),
  ('northern-lines-2-frostbite-letters', 'Frostbite Letters', 'juno-and-the-tides', 'northern-lines', 199, 'Folk', '{"palette":["#7fb5ff","#0e2038","#e6f0ff"],"pattern":"waves","seed":14}'::jsonb, '2025-02-24', 4, false, 2),
  ('northern-lines-3-cabin-radio', 'Cabin Radio', 'juno-and-the-tides', 'northern-lines', 208, 'Folk', '{"palette":["#7fb5ff","#0e2038","#e6f0ff"],"pattern":"waves","seed":14}'::jsonb, '2025-02-24', 4, false, 3),
  ('chrome-horizon-1-chrome-horizon', 'Chrome Horizon', 'static-orchard', 'chrome-horizon', 245, 'Synthwave', '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":14}'::jsonb, '2025-02-11', 2, false, 1),
  ('chrome-horizon-2-night-drive-84', 'Night Drive 84', 'static-orchard', 'chrome-horizon', 232, 'Synthwave', '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":14}'::jsonb, '2025-02-11', 2, false, 2),
  ('chrome-horizon-3-laser-garden', 'Laser Garden', 'static-orchard', 'chrome-horizon', 218, 'Synthwave', '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":14}'::jsonb, '2025-02-11', 2, false, 3),
  ('chrome-horizon-4-rewind-city', 'Rewind City', 'static-orchard', 'chrome-horizon', 256, 'Synthwave', '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":14}'::jsonb, '2025-02-11', 2, false, 4),
  ('satellite-hearts-1-satellite-hearts', 'Satellite Hearts', 'paper-satellites', 'satellite-hearts', 203, 'Indie rock', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":16}'::jsonb, '2025-01-30', 3, false, 1),
  ('satellite-hearts-2-backseat-constella', 'Backseat Constellations', 'paper-satellites', 'satellite-hearts', 189, 'Indie rock', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":16}'::jsonb, '2025-01-30', 3, false, 2),
  ('satellite-hearts-3-run-it-back', 'Run It Back', 'paper-satellites', 'satellite-hearts', 217, 'Indie rock', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":16}'::jsonb, '2025-01-30', 3, false, 3),
  ('satellite-hearts-4-sundial', 'Sundial', 'paper-satellites', 'satellite-hearts', 196, 'Indie rock', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":16}'::jsonb, '2025-01-30', 3, false, 4),
  ('satellite-hearts-5-loose-change', 'Loose Change', 'paper-satellites', 'satellite-hearts', 181, 'Indie rock', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":16}'::jsonb, '2025-01-30', 3, false, 5),
  ('salt-and-cedar-1-salt-and-cedar', 'Salt & Cedar', 'juno-and-the-tides', 'salt-and-cedar', 195, 'Folk', '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"dunes","seed":12}'::jsonb, '2025-01-12', 4, false, 1),
  ('salt-and-cedar-2-harbor-lights', 'Harbor Lights', 'juno-and-the-tides', 'salt-and-cedar', 218, 'Folk', '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"dunes","seed":12}'::jsonb, '2025-01-12', 4, false, 2),
  ('salt-and-cedar-3-the-long-way-round', 'The Long Way Round', 'juno-and-the-tides', 'salt-and-cedar', 232, 'Folk', '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"dunes","seed":12}'::jsonb, '2025-01-12', 4, false, 3),
  ('salt-and-cedar-4-kindling', 'Kindling', 'juno-and-the-tides', 'salt-and-cedar', 176, 'Folk', '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"dunes","seed":12}'::jsonb, '2025-01-12', 4, false, 4),
  ('salt-and-cedar-5-tidewater', 'Tidewater', 'juno-and-the-tides', 'salt-and-cedar', 204, 'Folk', '{"palette":["#e8b86b","#2e4a3a","#d9693f"],"pattern":"dunes","seed":12}'::jsonb, '2025-01-12', 4, false, 5),
  ('fleur-de-minuit-1-fleur-de-minuit', 'Fleur de Minuit', 'lune-ardent', 'fleur-de-minuit', 190, 'Pop', '{"palette":["#f7c6d9","#5b2a4a","#fff0c2"],"pattern":"rings","seed":15}'::jsonb, '2024-12-20', 0, false, 1),
  ('fleur-de-minuit-2-soleil-bleu', 'Soleil Bleu', 'lune-ardent', 'fleur-de-minuit', 205, 'Pop', '{"palette":["#f7c6d9","#5b2a4a","#fff0c2"],"pattern":"rings","seed":15}'::jsonb, '2024-12-20', 0, false, 2),
  ('fleur-de-minuit-3-danse-lente', 'Danse Lente', 'lune-ardent', 'fleur-de-minuit', 222, 'Pop', '{"palette":["#f7c6d9","#5b2a4a","#fff0c2"],"pattern":"rings","seed":15}'::jsonb, '2024-12-20', 0, false, 3),
  ('fleur-de-minuit-4-petit-matin', 'Petit Matin', 'lune-ardent', 'fleur-de-minuit', 178, 'Pop', '{"palette":["#f7c6d9","#5b2a4a","#fff0c2"],"pattern":"rings","seed":15}'::jsonb, '2024-12-20', 0, false, 4),
  ('blue-hour-1-blue-hour', 'Blue Hour', 'mira-calder', 'blue-hour', 213, 'Dream pop', '{"palette":["#4f7cff","#0d1440","#9ee7ff"],"pattern":"rings","seed":9}'::jsonb, '2024-11-30', 1, false, 1),
  ('blue-hour-2-window-seat', 'Window Seat', 'mira-calder', 'blue-hour', 231, 'Dream pop', '{"palette":["#4f7cff","#0d1440","#9ee7ff"],"pattern":"rings","seed":9}'::jsonb, '2024-11-30', 1, false, 2),
  ('blue-hour-3-paper-moons-acoust', 'Paper Moons (Acoustic)', 'mira-calder', 'blue-hour', 205, 'Dream pop', '{"palette":["#4f7cff","#0d1440","#9ee7ff"],"pattern":"rings","seed":9}'::jsonb, '2024-11-30', 1, false, 3),
  ('quiet-rooms-1-quiet-rooms-i', 'Quiet Rooms I', 'koji-aurel', 'quiet-rooms', 312, 'Ambient', '{"palette":["#9fb7c9","#1d2a35","#e9e2d0"],"pattern":"dunes","seed":11}'::jsonb, '2024-11-02', null, false, 1),
  ('quiet-rooms-2-quiet-rooms-ii', 'Quiet Rooms II', 'koji-aurel', 'quiet-rooms', 287, 'Ambient', '{"palette":["#9fb7c9","#1d2a35","#e9e2d0"],"pattern":"dunes","seed":11}'::jsonb, '2024-11-02', null, false, 2),
  ('quiet-rooms-3-paper-lanterns', 'Paper Lanterns', 'koji-aurel', 'quiet-rooms', 344, 'Ambient', '{"palette":["#9fb7c9","#1d2a35","#e9e2d0"],"pattern":"dunes","seed":11}'::jsonb, '2024-11-02', null, false, 3),
  ('quiet-rooms-4-snowfall-in-august', 'Snowfall in August', 'koji-aurel', 'quiet-rooms', 301, 'Ambient', '{"palette":["#9fb7c9","#1d2a35","#e9e2d0"],"pattern":"dunes","seed":11}'::jsonb, '2024-11-02', null, false, 4)
on conflict (id) do update set title = excluded.title, artist_id = excluded.artist_id, album_id = excluded.album_id, duration = excluded.duration, genre = excluded.genre, art = excluded.art, added_at = excluded.added_at, lyric_set = excluded.lyric_set, explicit = excluded.explicit, position = excluded.position;

insert into public.videos (id, title, artist_id, track_id, duration, year, views, art) values
  ('v-neon-orchard-official-vi', 'Neon Orchard (Official Video)', 'mira-calder', 'midnight-parade-1-neon-orchard', 226, 2024, '4.2M', '{"palette":["#ff5f8d","#3b1a6b","#ffb36b"],"pattern":"sun","seed":18}'::jsonb),
  ('v-low-tide-live-at-the-boa', 'Low Tide — Live at the Boathouse', 'hollow-atlas', 'low-tide-signals-1-low-tide', 277, 2023, '1.1M', '{"palette":["#2de2e6","#0a2a5e","#8a5bff"],"pattern":"waves","seed":19}'::jsonb),
  ('v-satellite-hearts-officia', 'Satellite Hearts (Official Video)', 'paper-satellites', 'satellite-hearts-1-satellite-hearts', 217, 2023, '2.8M', '{"palette":["#ffd23f","#c0392b","#1a1a1a"],"pattern":"split","seed":19}'::jsonb),
  ('v-velvet-static-visualiser', 'Velvet Static (Visualiser)', 'vesper-lane', 'velvet-static-1-velvet-static', 222, 2024, '6.5M', '{"palette":["#a855f7","#1b1030","#f472b6"],"pattern":"orbit","seed":16}'::jsonb),
  ('v-chrome-horizon-official-', 'Chrome Horizon (Official Video)', 'static-orchard', 'chrome-horizon-1-chrome-horizon', 259, 2022, '980K', '{"palette":["#ff2e93","#2b0f5c","#00e5ff"],"pattern":"grid","seed":17}'::jsonb),
  ('v-gold-hour-studio-session', 'Gold Hour — Studio Session', 'noor-valen', 'afterglow-theory-3-gold-hour', 241, 2025, '3.4M', '{"palette":["#ff7a45","#7a1f5c","#ffd1a1"],"pattern":"split","seed":19}'::jsonb)
on conflict (id) do update set title = excluded.title, artist_id = excluded.artist_id, track_id = excluded.track_id, duration = excluded.duration, year = excluded.year, views = excluded.views, art = excluded.art;

insert into public.categories (id, name, query, color, pattern) values
  ('pop', 'Pop', 'pop', '#c2185b', 'sun'),
  ('electronic', 'Electronic', 'electronic', '#0e7490', 'waves'),
  ('folk', 'Folk', 'folk', '#9a6b2f', 'dunes'),
  ('rnb', 'R&B', 'r&b', '#6d28d9', 'orbit'),
  ('ambient', 'Ambient', 'ambient', '#47657a', 'rings'),
  ('rock', 'Rock', 'rock', '#b4361f', 'stripes'),
  ('hiphop', 'Hip-hop', 'hip-hop', '#a15c00', 'split'),
  ('synthwave', 'Synthwave', 'synthwave', '#a21caf', 'grid')
on conflict (id) do update set name = excluded.name, query = excluded.query, color = excluded.color, pattern = excluded.pattern;

insert into public.lyrics_sets (id, lines) values
  (0, ARRAY['Streetlights blur like watercolour','and you''re laughing at the radio','say you''ll stay another hour','I''ll pretend the clock is slow','','We''re a slow firework','bright and fading, nothing left to prove','hold the light a little longer','I''ll be here when it''s through','','Paper crowns and borrowed jackets','windows down on Seventh Street','every song is half a promise','and the chorus is our feet','','We''re a slow firework','bright and fading, nothing left to prove','hold the light a little longer','I''ll be here when it''s through']),
  (1, ARRAY['Leave the lamp on in the hallway','I''ll be late but I''ll be there','honey weather, half past midnight','static dancing in your hair','','Say it softly, say it twice','let the quiet do the rest','I don''t need the whole forever','just the minute that''s the best','','Stay till morning, stay till morning','let the kettle take its time','all the world can keep on turning','if your hand is wrapped in mine']),
  (2, ARRAY['Counting waves along the harbour','every signal finds a shore','drawing lines across the water','to a place we''ve been before','','(instrumental break)','','Lights go out and lights come on','someone''s listening, someone''s gone','hold the tide and let it run','we were here and we were young']),
  (3, ARRAY['Backseat full of borrowed time','map held upside down','radio is playing our song','in a half-forgotten town','','Run it back, run it back','one more lap around the sun','loose change on the dashboard','and the night has just begun','','Roll the windows, kill the lights','sing it loud and sing it wrong','nobody''s keeping score tonight','we''re just chasing down the song']),
  (4, ARRAY['Woodsmoke on the winter air','letters written, never sent','salt and cedar in your coat','wherever this road went','','Light a fire, call me home','the long way round is still the way','harbour lights and kitchen songs','carry me through to the day','','Tidewater, tidewater','bring me back to you','every north I''ve ever known','points to something true'])
on conflict (id) do update set lines = excluded.lines;

insert into public.playlists (id, name, description, owner_id, collaborative, kind, art, created_at, updated_at) values
  ('mix-evening', 'Evening Mix', 'Mellow picks for the last light of the day, tuned to what you both replay.', 'tandem', false, 'mix', '{"palette":["#ff8a5c","#2a1250","#ffd29a"],"pattern":"sun","seed":11}'::jsonb, 1746057600000, 1746057600000),
  ('mix-weekend', 'Weekend Mix', 'Open windows, louder choruses.', 'tandem', false, 'mix', '{"palette":["#ffd23f","#8a1c1c","#ff7a45"],"pattern":"stripes","seed":7}'::jsonb, 1746057600000, 1746057600000),
  ('mix-duet', 'Duet Discovery', 'New for both of you — songs one of you loves that the other hasn''t heard yet.', 'tandem', false, 'mix', '{"palette":["#2de2e6","#1b0f4a","#f472b6"],"pattern":"orbit","seed":5}'::jsonb, 1746057600000, 1746057600000),
  ('pl-our-songs', 'Our Songs', 'Everything that''s ours. Add anything that reminds you of the other.', 'me', true, 'user', '{"palette":["#ff8fb1","#3a0f2e","#4fe3a1"],"pattern":"orbit","seed":8}'::jsonb, 1738281600000, 1745971200000),
  ('pl-sunday-kitchen', 'Sunday Kitchen', 'Slow mornings, coffee and something in the oven.', 'partner', true, 'user', '{"palette":["#e8b86b","#3a2412","#f4efe1"],"pattern":"sun","seed":4}'::jsonb, 1740873600000, 1745712000000),
  ('pl-late-night', 'Late Night Drive', 'Headlights, empty roads, volume up.', 'me', false, 'user', '{"palette":["#ff2e93","#14062e","#00e5ff"],"pattern":"grid","seed":6}'::jsonb, 1735689600000, 1745280000000),
  ('pl-deep-focus', 'Deep Focus', 'Nothing to sing along to. Just room to think.', 'me', false, 'user', '{"palette":["#9fb7c9","#0f1820","#e9e2d0"],"pattern":"rings","seed":2}'::jsonb, 1728777600000, 1744329600000)
on conflict (id) do update set name = excluded.name, description = excluded.description, owner_id = excluded.owner_id, collaborative = excluded.collaborative, kind = excluded.kind, art = excluded.art, created_at = excluded.created_at, updated_at = excluded.updated_at;

insert into public.playlist_items (playlist_id, track_id, added_by, added_at, position) values
  ('mix-evening', 'midnight-parade-1-neon-orchard', 'me', 1746057600000, 0),
  ('mix-evening', 'blue-hour-2-window-seat', 'me', 1746057600001, 1),
  ('mix-evening', 'fleur-de-minuit-3-danse-lente', 'me', 1746057600002, 2),
  ('mix-evening', 'velvet-static-3-honey-weather', 'me', 1746057600003, 3),
  ('mix-evening', 'salt-and-cedar-2-harbor-lights', 'me', 1746057600004, 4),
  ('mix-evening', 'quiet-rooms-1-quiet-rooms-i', 'me', 1746057600005, 5),
  ('mix-evening', 'northern-lines-1-northern-lines', 'me', 1746057600006, 6),
  ('mix-evening', 'afterglow-theory-3-gold-hour', 'me', 1746057600007, 7),
  ('mix-weekend', 'satellite-hearts-1-satellite-hearts', 'me', 1746057600000, 0),
  ('mix-weekend', 'afterglow-theory-1-afterglow-theory', 'me', 1746057600001, 1),
  ('mix-weekend', 'satellite-hearts-3-run-it-back', 'me', 1746057600002, 2),
  ('mix-weekend', 'lowlight-tapes-2-corner-store-poetr', 'me', 1746057600003, 3),
  ('mix-weekend', 'midnight-parade-2-midnight-parade', 'me', 1746057600004, 4),
  ('mix-weekend', 'chrome-horizon-2-night-drive-84', 'me', 1746057600005, 5),
  ('mix-duet', 'low-tide-signals-3-cartographer', 'me', 1746057600000, 0),
  ('mix-duet', 'chrome-horizon-3-laser-garden', 'me', 1746057600001, 1),
  ('mix-duet', 'fleur-de-minuit-1-fleur-de-minuit', 'me', 1746057600002, 2),
  ('mix-duet', 'velvet-static-2-stay-till-morning', 'me', 1746057600003, 3),
  ('mix-duet', 'lowlight-tapes-3-metro-hum', 'me', 1746057600004, 4),
  ('mix-duet', 'northern-lines-3-cabin-radio', 'me', 1746057600005, 5),
  ('mix-duet', 'salt-and-cedar-4-kindling', 'me', 1746057600006, 6),
  ('pl-our-songs', 'midnight-parade-1-neon-orchard', 'me', 1746057600000, 0),
  ('pl-our-songs', 'velvet-static-2-stay-till-morning', 'partner', 1745971200000, 1),
  ('pl-our-songs', 'salt-and-cedar-1-salt-and-cedar', 'me', 1745884800000, 2),
  ('pl-our-songs', 'afterglow-theory-3-gold-hour', 'partner', 1745798400000, 3),
  ('pl-our-songs', 'fleur-de-minuit-3-danse-lente', 'me', 1745712000000, 4),
  ('pl-our-songs', 'satellite-hearts-1-satellite-hearts', 'partner', 1745625600000, 5),
  ('pl-our-songs', 'blue-hour-1-blue-hour', 'me', 1745539200000, 6),
  ('pl-our-songs', 'northern-lines-2-frostbite-letters', 'partner', 1745452800000, 7),
  ('pl-our-songs', 'chrome-horizon-2-night-drive-84', 'me', 1745366400000, 8),
  ('pl-sunday-kitchen', 'salt-and-cedar-2-harbor-lights', 'partner', 1746057600000, 0),
  ('pl-sunday-kitchen', 'salt-and-cedar-5-tidewater', 'me', 1745971200000, 1),
  ('pl-sunday-kitchen', 'fleur-de-minuit-2-soleil-bleu', 'partner', 1745884800000, 2),
  ('pl-sunday-kitchen', 'quiet-rooms-3-paper-lanterns', 'partner', 1745798400000, 3),
  ('pl-sunday-kitchen', 'blue-hour-2-window-seat', 'me', 1745712000000, 4),
  ('pl-sunday-kitchen', 'northern-lines-3-cabin-radio', 'partner', 1745625600000, 5),
  ('pl-sunday-kitchen', 'fleur-de-minuit-4-petit-matin', 'partner', 1745539200000, 6),
  ('pl-late-night', 'chrome-horizon-1-chrome-horizon', 'me', 1746057600000, 0),
  ('pl-late-night', 'chrome-horizon-2-night-drive-84', 'me', 1745971200000, 1),
  ('pl-late-night', 'low-tide-signals-1-low-tide', 'me', 1745884800000, 2),
  ('pl-late-night', 'velvet-static-1-velvet-static', 'me', 1745798400000, 3),
  ('pl-late-night', 'afterglow-theory-4-flicker', 'me', 1745712000000, 4),
  ('pl-late-night', 'lowlight-tapes-4-late-bus-home', 'me', 1745625600000, 5),
  ('pl-late-night', 'chrome-horizon-4-rewind-city', 'me', 1745539200000, 6),
  ('pl-late-night', 'low-tide-signals-3-cartographer', 'me', 1745452800000, 7),
  ('pl-deep-focus', 'quiet-rooms-1-quiet-rooms-i', 'me', 1746057600000, 0),
  ('pl-deep-focus', 'quiet-rooms-2-quiet-rooms-ii', 'me', 1745971200000, 1),
  ('pl-deep-focus', 'quiet-rooms-3-paper-lanterns', 'me', 1745884800000, 2),
  ('pl-deep-focus', 'quiet-rooms-4-snowfall-in-august', 'me', 1745798400000, 3),
  ('pl-deep-focus', 'low-tide-signals-3-cartographer', 'me', 1745712000000, 4),
  ('pl-deep-focus', 'low-tide-signals-4-afterimage', 'me', 1745625600000, 5)
on conflict (playlist_id, track_id) do update set added_by = excluded.added_by, added_at = excluded.added_at, position = excluded.position;

insert into public.liked_tracks (user_id, track_id) values
  ('me', 'midnight-parade-1-neon-orchard'),
  ('me', 'velvet-static-2-stay-till-morning'),
  ('me', 'satellite-hearts-1-satellite-hearts'),
  ('me', 'chrome-horizon-2-night-drive-84'),
  ('me', 'salt-and-cedar-1-salt-and-cedar'),
  ('me', 'afterglow-theory-3-gold-hour'),
  ('me', 'low-tide-signals-1-low-tide'),
  ('me', 'fleur-de-minuit-3-danse-lente'),
  ('me', 'northern-lines-1-northern-lines'),
  ('me', 'lowlight-tapes-2-corner-store-poetr'),
  ('me', 'blue-hour-2-window-seat'),
  ('me', 'quiet-rooms-1-quiet-rooms-i')
on conflict (user_id, track_id) do nothing;

insert into public.saved_albums (user_id, album_id) values
  ('me', 'midnight-parade'),
  ('me', 'velvet-static'),
  ('me', 'salt-and-cedar'),
  ('me', 'chrome-horizon'),
  ('me', 'satellite-hearts'),
  ('me', 'quiet-rooms')
on conflict (user_id, album_id) do nothing;

insert into public.followed_artists (user_id, artist_id) values
  ('me', 'mira-calder'),
  ('me', 'vesper-lane'),
  ('me', 'juno-and-the-tides'),
  ('me', 'hollow-atlas'),
  ('me', 'noor-valen'),
  ('me', 'static-orchard'),
  ('me', 'koji-aurel')
on conflict (user_id, artist_id) do nothing;

insert into public.recent_searches (user_id, query, searched_at) values
  ('me', 'Mira Calder', now() - interval '0 seconds'),
  ('me', 'late night', now() - interval '60 seconds'),
  ('me', 'folk', now() - interval '120 seconds')
on conflict (user_id, query) do update set searched_at = excluded.searched_at;

insert into public.play_history (user_id, track_id, played_at) values
  ('me', 'afterglow-theory-2-second-skin', now() - interval '0 seconds'),
  ('me', 'midnight-parade-3-slow-fireworks', now() - interval '60 seconds'),
  ('me', 'velvet-static-1-velvet-static', now() - interval '120 seconds'),
  ('me', 'salt-and-cedar-3-the-long-way-round', now() - interval '180 seconds'),
  ('me', 'chrome-horizon-1-chrome-horizon', now() - interval '240 seconds'),
  ('me', 'satellite-hearts-2-backseat-constella', now() - interval '300 seconds'),
  ('me', 'fleur-de-minuit-1-fleur-de-minuit', now() - interval '360 seconds'),
  ('me', 'low-tide-signals-2-signal-fade', now() - interval '420 seconds')
on conflict (user_id, track_id) do update set played_at = excluded.played_at;

delete from public.continue_listening where user_id = 'me';
insert into public.continue_listening (user_id, type, item_id, position) values
  ('me', 'track', 'low-tide-signals-3-cartographer', 96),
  ('me', 'album', 'salt-and-cedar', 2),
  ('me', 'track', 'midnight-parade-3-slow-fireworks', 143),
  ('me', 'album', 'quiet-rooms', 1);
