import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlossaryCategories, type CategoryTree } from "@/hooks/useGlossaryCategories";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { Search, Plus, Pencil, Trash2, Loader2, BookOpen, X, FolderTree, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { exportGlossaryToPDF } from "@/lib/exportPDF";

const glossaryTermSchema = z.object({
  term_es: z.string().trim().min(1, "El término en español es requerido").max(200, "Máximo 200 caracteres"),
  term_en: z.string().trim().min(1, "El término en inglés es requerido").max(200, "Máximo 200 caracteres"),
  definition: z.string().trim().max(2000, "Máximo 2000 caracteres").optional().nullable(),
});

interface GlossaryTerm {
  id: string;
  term_es: string;
  term_en: string;
  definition: string | null;
  category: string | null;
  category_id: string | null;
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const CategorySelect = ({
  tree,
  value,
  onChange,
  placeholder = "Todas las categorías",
  allowAll = true,
}: {
  tree: CategoryTree[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  allowAll?: boolean;
}) => {
  const renderOptions = (nodes: CategoryTree[], depth = 0): React.ReactNode[] =>
    nodes.flatMap((n) => [
      <SelectItem key={n.id} value={n.id}>
        <span style={{ paddingLeft: depth * 16 }}>
          {depth > 0 ? "└ " : ""}{n.name_es} / {n.name_en}
        </span>
      </SelectItem>,
      ...renderOptions(n.children, depth + 1),
    ]);

  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className="w-full sm:w-[260px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value="all">{placeholder}</SelectItem>}
        {renderOptions(tree)}
      </SelectContent>
    </Select>
  );
};

const GlossaryTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tree, categories } = useGlossaryCategories();
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlossaryTerm | null>(null);
  const [formEs, setFormEs] = useState("");
  const [formEn, setFormEn] = useState("");
  const [formDef, setFormDef] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTerms = async () => {
    const { data, error } = await supabase
      .from("glossary_terms" as any)
      .select("*")
      .order("term_es");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTerms((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTerms(); }, []);

  // Get all descendant category IDs for a given category
  const getCategoryAndDescendants = (categoryId: string): string[] => {
    const ids = [categoryId];
    const findChildren = (parentId: string) => {
      categories.filter(c => c.parent_id === parentId).forEach(c => {
        ids.push(c.id);
        findChildren(c.id);
      });
    };
    findChildren(categoryId);
    return ids;
  };

  const filtered = useMemo(() => {
    let result = terms;
    if (activeCategory) {
      const validIds = getCategoryAndDescendants(activeCategory);
      result = result.filter((t) => t.category_id && validIds.includes(t.category_id));
    }
    if (activeLetter) {
      result = result.filter(
        (t) => t.term_es.toUpperCase().startsWith(activeLetter) || t.term_en.toUpperCase().startsWith(activeLetter)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.term_es.toLowerCase().includes(q) ||
          t.term_en.toLowerCase().includes(q) ||
          (t.definition || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, activeLetter, activeCategory, terms, categories]);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name_es : null;
  };

  const openNew = () => {
    setEditing(null);
    setFormEs("");
    setFormEn("");
    setFormDef("");
    setFormCategoryId(null);
    setDialogOpen(true);
  };

  const openEdit = (term: GlossaryTerm) => {
    setEditing(term);
    setFormEs(term.term_es);
    setFormEn(term.term_en);
    setFormDef(term.definition || "");
    setFormCategoryId(term.category_id);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parseResult = glossaryTermSchema.safeParse({
      term_es: formEs,
      term_en: formEn,
      definition: formDef || null,
    });

    if (!parseResult.success) {
      toast({ title: "Error de validación", description: parseResult.error.errors[0].message, variant: "destructive" });
      return;
    }

    const validated = { ...parseResult.data, category_id: formCategoryId };
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("glossary_terms" as any)
        .update(validated as any)
        .eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: "No se pudo guardar. / Could not save.", variant: "destructive" });
      } else {
        logAuditEvent("glossary_term_updated", { term_id: editing.id, term_es: formEs });
      }
    } else {
      const { error } = await supabase
        .from("glossary_terms" as any)
        .insert(validated as any);
      if (error) {
        toast({ title: "Error", description: "No se pudo guardar. / Could not save.", variant: "destructive" });
      } else {
        logAuditEvent("glossary_term_created", { term_es: formEs, term_en: formEn });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchTerms();
  };

  const handleDelete = async (id: string) => {
    const term = terms.find(t => t.id === id);
    const { error } = await supabase.from("glossary_terms" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      logAuditEvent("glossary_term_deleted", { term_id: id, term_es: term?.term_es });
    }
    fetchTerms();
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Glosario Financiero</h2>
          <p className="text-sm text-muted-foreground">Financial Glossary · Español ↔ English</p>
        </div>
      </div>

      {/* Search + Category Filter + Add */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar término / Search term..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
          <CategorySelect tree={tree} value={activeCategory} onChange={setActiveCategory} />
        </div>
        {user && (
          <Button onClick={openNew} size="sm" className="gap-1 shrink-0">
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => exportGlossaryToPDF(filtered)} className="gap-1 shrink-0">
          <Download className="h-4 w-4" /> PDF
        </Button>
      </div>


      {/* Alphabet filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveLetter(null)}
          className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-all ${
            activeLetter === null
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Todos
        </button>
        {alphabet.map((letter) => (
          <button
            key={letter}
            onClick={() => setActiveLetter(letter === activeLetter ? null : letter)}
            className={`px-2 py-1 text-xs rounded-md font-semibold transition-all ${
              activeLetter === letter
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Terms grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No se encontraron resultados</p>
          <p className="text-muted-foreground/60 text-xs">No results found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((term) => (
            <div
              key={term.id}
              className="group relative rounded-2xl border border-border/60 bg-card p-5 transition-all hover:border-primary/30"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              {user && (
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(term)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(term.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 border-primary/30 text-primary font-semibold">ES</Badge>
                  <span className="font-semibold text-foreground text-sm">{term.term_es}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 border-secondary/50 text-secondary font-semibold">EN</Badge>
                  <span className="font-medium text-foreground/75 text-sm">{term.term_en}</span>
                </div>
                {getCategoryName(term.category_id) && (
                  <Badge variant="secondary" className="text-[10px]">
                    <FolderTree className="h-3 w-3 mr-1" />
                    {getCategoryName(term.category_id)}
                  </Badge>
                )}
                {term.definition && (
                  <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
                    {term.definition}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        {filtered.length} de {terms.length} término(s) · {filtered.length} of {terms.length} term(s)
      </p>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Término / Edit Term" : "Nuevo Término / New Term"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Español</Label>
              <Input required value={formEs} onChange={(e) => setFormEs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>English</Label>
              <Input required value={formEn} onChange={(e) => setFormEn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoría / Category</Label>
              <CategorySelect tree={tree} value={formCategoryId} onChange={setFormCategoryId} placeholder="Sin categoría / No category" />
            </div>
            <div className="space-y-2">
              <Label>Definición / Definition</Label>
              <Textarea value={formDef} onChange={(e) => setFormDef(e.target.value)} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar / Save" : "Agregar / Add"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GlossaryTab;
