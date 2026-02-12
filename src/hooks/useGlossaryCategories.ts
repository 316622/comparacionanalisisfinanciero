import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GlossaryCategory {
  id: string;
  name_es: string;
  name_en: string;
  parent_id: string | null;
  sort_order: number;
}

export interface CategoryTree extends GlossaryCategory {
  children: CategoryTree[];
}

export const useGlossaryCategories = () => {
  const [categories, setCategories] = useState<GlossaryCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("glossary_categories" as any)
      .select("*")
      .order("sort_order");
    setCategories((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const tree = useMemo(() => {
    const map = new Map<string, CategoryTree>();
    const roots: CategoryTree[] = [];

    categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
    categories.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [categories]);

  return { categories, tree, loading, refetch: fetchCategories };
};
