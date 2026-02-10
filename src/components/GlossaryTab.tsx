import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Pencil, Trash2, Loader2, BookOpen, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GlossaryTerm {
  id: string;
  term_es: string;
  term_en: string;
  definition: string | null;
  category: string | null;
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const GlossaryTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GlossaryTerm | null>(null);
  const [formEs, setFormEs] = useState("");
  const [formEn, setFormEn] = useState("");
  const [formDef, setFormDef] = useState("");
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

  const filtered = useMemo(() => {
    let result = terms;
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
  }, [search, activeLetter, terms]);

  const openNew = () => {
    setEditing(null);
    setFormEs("");
    setFormEn("");
    setFormDef("");
    setDialogOpen(true);
  };

  const openEdit = (term: GlossaryTerm) => {
    setEditing(term);
    setFormEs(term.term_es);
    setFormEn(term.term_en);
    setFormDef(term.definition || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("glossary_terms" as any)
        .update({ term_es: formEs, term_en: formEn, definition: formDef } as any)
        .eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase
        .from("glossary_terms" as any)
        .insert({ term_es: formEs, term_en: formEn, definition: formDef } as any);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchTerms();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("glossary_terms" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    fetchTerms();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Glosario Financiero</h2>
          <p className="text-xs text-muted-foreground">Financial Glossary · Español ↔ English</p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
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
        {user && (
          <Button onClick={openNew} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        )}
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((term) => (
            <div
              key={term.id}
              className="group relative rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all hover:border-primary/30"
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
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 border-primary/30 text-primary">ES</Badge>
                  <span className="font-semibold text-foreground text-sm">{term.term_es}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 border-secondary/50 text-secondary">EN</Badge>
                  <span className="font-medium text-foreground/80 text-sm">{term.term_en}</span>
                </div>
                {term.definition && (
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
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
