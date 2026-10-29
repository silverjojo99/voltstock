alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in ('Computers', 'Phones', 'Audio', 'Accessories', 'Gaming', 'LCD', 'Flex', 'Batterie'));
