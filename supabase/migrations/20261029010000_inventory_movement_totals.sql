create or replace view public.inventory_movement_totals
with (security_invoker = true)
as
select
  coalesce(sum(
    case
      when operation = 'INSERT' then coalesce(nullif(after_data ->> 'stock', '')::bigint, 0)
      when operation = 'UPDATE' then greatest(
        coalesce(nullif(after_data ->> 'stock', '')::bigint, 0)
          - coalesce(nullif(before_data ->> 'stock', '')::bigint, 0),
        0
      )
      else 0
    end
  ), 0)::bigint as items_in,
  coalesce(sum(
    case
      when operation = 'DELETE' then coalesce(nullif(before_data ->> 'stock', '')::bigint, 0)
      when operation = 'UPDATE' then greatest(
        coalesce(nullif(before_data ->> 'stock', '')::bigint, 0)
          - coalesce(nullif(after_data ->> 'stock', '')::bigint, 0),
        0
      )
      else 0
    end
  ), 0)::bigint as items_out
from public.inventory_activity;

grant select on public.inventory_movement_totals to authenticated;
