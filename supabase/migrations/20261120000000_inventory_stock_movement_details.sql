create or replace view public.inventory_stock_movements
with (security_invoker = true)
as
with stock_changes as (
  select
    id,
    product_id,
    product_name,
    actor_id,
    occurred_at,
    coalesce(before_data ->> 'sku', after_data ->> 'sku') as sku,
    coalesce(nullif(before_data ->> 'stock', '')::bigint, 0) as stock_before,
    coalesce(nullif(after_data ->> 'stock', '')::bigint, 0) as stock_after
  from public.inventory_activity
)
select
  id,
  product_id,
  product_name,
  sku,
  case when stock_after > stock_before then 'in' else 'out' end as direction,
  abs(stock_after - stock_before) as quantity,
  stock_before,
  stock_after,
  actor_id,
  occurred_at
from stock_changes
where stock_after <> stock_before;

grant select on public.inventory_stock_movements to authenticated;
