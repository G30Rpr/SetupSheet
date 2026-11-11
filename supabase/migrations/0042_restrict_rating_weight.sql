-- Also protect installations that already applied the original 0041.
-- The rating recompute function runs as its owner and can still use this helper.
revoke execute on function public.rating_weight(uuid, uuid)
  from PUBLIC, anon, authenticated;
