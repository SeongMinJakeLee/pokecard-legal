-- list_cards (security invoker) joins user_cards/wishlist_items; guests need the table privilege to plan the query.
-- RLS policies are `to authenticated` only, so anon still sees zero rows.
grant select on public.user_cards, public.wishlist_items to anon;
