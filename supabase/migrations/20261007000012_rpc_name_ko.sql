-- RPCs learn about cards.name_ko: search by Korean name, return `nameKo`, sort by Korean name.
-- Implemented as controlled rewrites of the existing function bodies so 002 stays the single source of the RPC logic.
do $mig$
declare
  v text;
  procs text[] := array[
    'public.list_cards(text, text[], text[], text[], text, text, text, int, text)',
    'public.list_wishlist(int, text)',
    'public.get_card(text)'
  ];
  p text;
begin
  foreach p in array procs loop
    v := pg_get_functiondef(p::regprocedure);

    v := replace(v, 'and ($1 is null or c.name ilike $1)', 'and ($1 is null or c.name ilike $1 or c.name_ko ilike $1)');
    v := replace(v, 'select c.id, c.name, c.number,', 'select c.id, c.name, c.name_ko, c.number,');
    v := replace(v, '''id'', p.id, ''name'', p.name,', '''id'', p.id, ''name'', p.name, ''nameKo'', p.name_ko,');
    v := replace(v, 'lower(c.name) collate "C"', 'lower(coalesce(c.name_ko, c.name)) collate "C"');
    v := replace(v, '''id'', c.id, ''name'', c.name,', '''id'', c.id, ''name'', c.name, ''nameKo'', c.name_ko,');

    if v = pg_get_functiondef(p::regprocedure) then
      raise exception 'no rewrite applied to %', p;
    end if;
    execute v;
  end loop;
end
$mig$;
