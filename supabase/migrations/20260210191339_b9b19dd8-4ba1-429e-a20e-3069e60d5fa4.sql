
-- Glossary terms table
CREATE TABLE public.glossary_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term_es TEXT NOT NULL,
  term_en TEXT NOT NULL,
  definition TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.glossary_terms ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read glossary" ON public.glossary_terms
  FOR SELECT USING (true);

-- Authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert glossary" ON public.glossary_terms
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update glossary" ON public.glossary_terms
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete glossary" ON public.glossary_terms
  FOR DELETE TO authenticated USING (true);

-- Presentation slides table
CREATE TABLE public.presentation_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  year TEXT NOT NULL,
  slide_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  content TEXT,
  chart_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.presentation_slides ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read slides" ON public.presentation_slides
  FOR SELECT USING (true);

-- Authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert slides" ON public.presentation_slides
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update slides" ON public.presentation_slides
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete slides" ON public.presentation_slides
  FOR DELETE TO authenticated USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_glossary_updated_at
  BEFORE UPDATE ON public.glossary_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_slides_updated_at
  BEFORE UPDATE ON public.presentation_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
