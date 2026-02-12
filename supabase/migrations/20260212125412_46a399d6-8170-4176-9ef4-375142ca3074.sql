
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can read user_roles
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Drop old permissive glossary_terms write policies
DROP POLICY "Authenticated users can insert glossary" ON public.glossary_terms;
DROP POLICY "Authenticated users can update glossary" ON public.glossary_terms;
DROP POLICY "Authenticated users can delete glossary" ON public.glossary_terms;

-- New admin-only glossary_terms write policies
CREATE POLICY "Admins can insert glossary" ON public.glossary_terms
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update glossary" ON public.glossary_terms
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete glossary" ON public.glossary_terms
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop old permissive presentation_slides write policies
DROP POLICY "Authenticated users can insert slides" ON public.presentation_slides;
DROP POLICY "Authenticated users can update slides" ON public.presentation_slides;
DROP POLICY "Authenticated users can delete slides" ON public.presentation_slides;

-- New admin-only presentation_slides write policies
CREATE POLICY "Admins can insert slides" ON public.presentation_slides
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update slides" ON public.presentation_slides
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete slides" ON public.presentation_slides
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
