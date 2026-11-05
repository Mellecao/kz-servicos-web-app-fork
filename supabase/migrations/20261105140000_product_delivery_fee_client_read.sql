-- Permite que utilizadores autenticados leiam SÓ a taxa de entrega de produtos
-- (system_settings é admin-only; o checkout do app Cliente precisa de mostrar
-- subtotal + taxa + total antes de criar o pedido). Aditivo: não altera nem
-- remove nenhuma policy existente.
DO $$ BEGIN
  CREATE POLICY authenticated_read_product_delivery_fee
    ON public.system_settings FOR SELECT
    TO authenticated
    USING (key = 'product_delivery_fee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
