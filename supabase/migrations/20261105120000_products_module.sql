-- Módulo de produtos (Só Serviços, Luanda): catálogo + pedidos de entrega ao domicílio.
-- Somente cria objetos novos (não altera nem remove nada existente).
-- Preços em Kwanzas (AOA). Os preços do seed são EXEMPLOS e devem ser ajustados pelo admin.

-- ---------------------------------------------------------------------------
-- Enum de estado do pedido
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.product_order_status AS ENUM (
    'pending',           -- pedido recebido, aguarda confirmação do admin
    'confirmed',         -- confirmado pelo admin
    'out_for_delivery',  -- a caminho
    'delivered',         -- entregue
    'cancelled'          -- cancelado (cliente ou admin)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  unit_label  text NOT NULL DEFAULT 'unidade',
  price       numeric(12,2) NOT NULL CHECK (price >= 0),
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL REFERENCES public.users(id),
  status             public.product_order_status NOT NULL DEFAULT 'pending',
  delivery_address   text NOT NULL,
  delivery_reference text,
  delivery_lat       double precision,
  delivery_lng       double precision,
  contact_phone      text,
  notes              text,
  payment_method     public.payment_method NOT NULL DEFAULT 'cash',
  subtotal           numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee       numeric(12,2) NOT NULL DEFAULT 0,
  total              numeric(12,2) NOT NULL DEFAULT 0,
  cancel_reason      text,
  confirmed_at       timestamptz,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_orders_client ON public.product_orders (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_orders_status ON public.product_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES public.product_orders(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  unit_price   numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity     integer NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  line_total   numeric(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED
);

CREATE INDEX IF NOT EXISTS idx_product_order_items_order ON public.product_order_items (order_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_orders_updated_at ON public.product_orders;
CREATE TRIGGER trg_product_orders_updated_at BEFORE UPDATE ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Mudança de estado: carimba datas e avisa o cliente (notificação in-app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_orders_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
    v_title := 'Pedido confirmado';
    v_body  := 'O seu pedido foi confirmado e está a ser preparado.';
  ELSIF NEW.status = 'out_for_delivery' THEN
    v_title := 'Pedido a caminho';
    v_body  := 'O seu pedido saiu para entrega.';
  ELSIF NEW.status = 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
    v_title := 'Pedido entregue';
    v_body  := 'O seu pedido foi entregue. Obrigado por escolher a Só Serviços!';
  ELSIF NEW.status = 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    v_title := 'Pedido cancelado';
    v_body  := COALESCE('O seu pedido foi cancelado. Motivo: ' || NULLIF(NEW.cancel_reason, ''), 'O seu pedido foi cancelado.');
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id)
    VALUES (NEW.client_id, v_title, v_body, 'product_order', 'product_order', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_orders_status_change ON public.product_orders;
CREATE TRIGGER trg_product_orders_status_change BEFORE UPDATE ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.product_orders_on_status_change();

-- ---------------------------------------------------------------------------
-- RPC: criar pedido (preços SEMPRE lidos do catálogo, nunca do cliente)
--   p_items: [{"product_id": "<uuid>", "quantity": 2}, ...]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_product_order(
  p_items              jsonb,
  p_delivery_address   text,
  p_delivery_reference text DEFAULT NULL,
  p_delivery_lat       double precision DEFAULT NULL,
  p_delivery_lng       double precision DEFAULT NULL,
  p_contact_phone      text DEFAULT NULL,
  p_notes              text DEFAULT NULL,
  p_payment_method     public.payment_method DEFAULT 'cash'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_fee      numeric(12,2) := 0;
  v_item     jsonb;
  v_prod     public.products%ROWTYPE;
  v_qty      integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF get_user_role() <> 'client' THEN
    RAISE EXCEPTION 'Apenas clientes podem fazer pedidos' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido não tem itens' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_address IS NULL OR btrim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'Indique o endereço de entrega' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT COALESCE((value #>> '{}')::numeric, 0) INTO v_fee
    FROM public.system_settings WHERE key = 'product_delivery_fee';
  EXCEPTION WHEN others THEN
    v_fee := 0;
  END;
  v_fee := COALESCE(v_fee, 0);

  INSERT INTO public.product_orders (client_id, delivery_address, delivery_reference, delivery_lat, delivery_lng,
                                     contact_phone, notes, payment_method, delivery_fee)
  VALUES (v_uid, btrim(p_delivery_address), NULLIF(btrim(p_delivery_reference), ''), p_delivery_lat, p_delivery_lng,
          NULLIF(btrim(p_contact_phone), ''), NULLIF(btrim(p_notes), ''), p_payment_method, v_fee)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    SELECT * INTO v_prod FROM public.products
    WHERE id = (v_item ->> 'product_id')::uuid AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_order_items (order_id, product_id, product_name, unit_price, quantity)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_prod.price, v_qty);
    v_subtotal := v_subtotal + (v_prod.price * v_qty);
  END LOOP;

  UPDATE public.product_orders
  SET subtotal = v_subtotal, total = v_subtotal + v_fee
  WHERE id = v_order_id;

  -- avisa todos os administradores
  INSERT INTO public.notifications (user_id, title, body, type, reference_type, reference_id, link)
  SELECT u.id, 'Novo pedido de produtos', 'Chegou um novo pedido para entrega.', 'product_order',
         'product_order', v_order_id, '/pedidos-produtos'
  FROM public.users u
  WHERE u.role = 'admin' AND COALESCE(u.is_active, true);

  RETURN v_order_id;
END;
$$;

-- RPC: cliente cancela o próprio pedido enquanto ainda está pendente
CREATE OR REPLACE FUNCTION public.cancel_product_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_orders
  SET status = 'cancelled', cancel_reason = NULLIF(btrim(p_reason), '')
  WHERE id = p_order_id AND client_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só é possível cancelar pedidos pendentes' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_order(jsonb, text, text, double precision, double precision, text, text, public.payment_method) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_order(jsonb, text, text, double precision, double precision, text, text, public.payment_method) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_product_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_product_order(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (is_active OR get_user_role() = 'admin');

DROP POLICY IF EXISTS products_admin_write ON public.products;
CREATE POLICY products_admin_write ON public.products FOR ALL TO authenticated
  USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS product_orders_select ON public.product_orders;
CREATE POLICY product_orders_select ON public.product_orders FOR SELECT TO authenticated
  USING (client_id = auth.uid() OR get_user_role() = 'admin');

-- clientes NÃO inserem direto: usam create_product_order / cancel_product_order
DROP POLICY IF EXISTS product_orders_admin_write ON public.product_orders;
CREATE POLICY product_orders_admin_write ON public.product_orders FOR ALL TO authenticated
  USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS product_order_items_select ON public.product_order_items;
CREATE POLICY product_order_items_select ON public.product_order_items FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.product_orders o WHERE o.id = order_id AND o.client_id = auth.uid())
  );

DROP POLICY IF EXISTS product_order_items_admin_write ON public.product_order_items;
CREATE POLICY product_order_items_admin_write ON public.product_order_items FOR ALL TO authenticated
  USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Seed: taxa de entrega + catálogo inicial (preços de EXEMPLO em Kz)
-- ---------------------------------------------------------------------------
INSERT INTO public.system_settings (key, value)
VALUES ('product_delivery_fee', '1000'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.products (slug, name, description, unit_label, price, sort_order) VALUES
  ('agua-cisterna', 'Água de cisterna',  'Camião-cisterna com entrega ao domicílio.', 'viagem',   35000, 10),
  ('gelo-escama',   'Gelo em escama',    'Gelo em escama, entrega ao domicílio.',      'saco',      2500, 20),
  ('gelo-cubos',    'Gelo em cubos',     'Gelo em cubos, entrega ao domicílio.',       'saco',      1500, 30),
  ('agua-20l',      'Água 20 L',         'Garrafão de água potável de 20 litros.',     'garrafão',  1200, 40),
  ('agua-10l',      'Água 10 L',         'Garrafão de água potável de 10 litros.',     'garrafão',   700, 50),
  ('botija-6kg',    'Botija de gás 6 kg','Botija de gás de 6 kg.',                     'botija',    4500, 60),
  ('botija-12kg',   'Botija de gás 12 kg','Botija de gás de 12 kg.',                   'botija',    8500, 70),
  ('botija-25kg',   'Botija de gás 25 kg','Botija de gás de 25 kg.',                   'botija',   17500, 80)
ON CONFLICT (slug) DO NOTHING;
