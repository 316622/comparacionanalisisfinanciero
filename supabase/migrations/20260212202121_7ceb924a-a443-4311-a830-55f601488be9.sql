
-- =============================================
-- 1. AUDIT LOG TABLE
-- =============================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can read audit logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own logs
CREATE POLICY "Users can insert own audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow edge functions (service role) to insert logs
CREATE POLICY "Service role can insert audit logs"
ON public.audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- =============================================
-- 2. GLOSSARY CATEGORIES TABLE (hierarchical)
-- =============================================
CREATE TABLE public.glossary_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_es text NOT NULL,
  name_en text NOT NULL,
  parent_id uuid REFERENCES public.glossary_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.glossary_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read categories
CREATE POLICY "Anyone can read categories"
ON public.glossary_categories
FOR SELECT
USING (true);

-- Admins can manage categories
CREATE POLICY "Admins can insert categories"
ON public.glossary_categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
ON public.glossary_categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
ON public.glossary_categories
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add category_id to glossary_terms (links to hierarchical categories)
ALTER TABLE public.glossary_terms
ADD COLUMN category_id uuid REFERENCES public.glossary_categories(id) ON DELETE SET NULL;

-- Trigger for updated_at on glossary_categories
CREATE TRIGGER update_glossary_categories_updated_at
BEFORE UPDATE ON public.glossary_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. SEED INITIAL CATEGORIES (NIIF/IFRS structure)
-- =============================================
INSERT INTO public.glossary_categories (name_es, name_en, sort_order) VALUES
  ('Activos', 'Assets', 1),
  ('Pasivos', 'Liabilities', 2),
  ('Patrimonio', 'Equity', 3),
  ('Ingresos', 'Revenue', 4),
  ('Gastos', 'Expenses', 5),
  ('Auditoría', 'Audit', 6),
  ('NIIF / IFRS', 'IFRS Standards', 7),
  ('Impuestos', 'Taxes', 8),
  ('General', 'General', 9);

-- Add subcategories
INSERT INTO public.glossary_categories (name_es, name_en, parent_id, sort_order)
SELECT 'Activos Corrientes', 'Current Assets', id, 1 FROM public.glossary_categories WHERE name_en = 'Assets'
UNION ALL
SELECT 'Activos No Corrientes', 'Non-Current Assets', id, 2 FROM public.glossary_categories WHERE name_en = 'Assets'
UNION ALL
SELECT 'Pasivos Corrientes', 'Current Liabilities', id, 1 FROM public.glossary_categories WHERE name_en = 'Liabilities'
UNION ALL
SELECT 'Pasivos No Corrientes', 'Non-Current Liabilities', id, 2 FROM public.glossary_categories WHERE name_en = 'Liabilities'
UNION ALL
SELECT 'Normas Generales', 'General Standards', id, 1 FROM public.glossary_categories WHERE name_en = 'IFRS Standards'
UNION ALL
SELECT 'Instrumentos Financieros', 'Financial Instruments', id, 2 FROM public.glossary_categories WHERE name_en = 'IFRS Standards';
