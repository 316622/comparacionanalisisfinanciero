import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar / Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {user && (
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <button onClick={() => setActiveLetter(null)} className={`px-2 py-1 text-xs rounded font-medium transition-colors ${activeLetter === null ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
          Todos / All
        </button>
        {alphabet.map((letter) => (
          <button key={letter} onClick={() => setActiveLetter(letter === activeLetter ? null : letter)} className={`px-2 py-1 text-xs rounded font-medium transition-colors ${activeLetter === letter ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
            {letter}
          </button>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Español</TableHead>
              <TableHead className="font-semibold">English</TableHead>
              <TableHead className="font-semibold">Definición / Definition</TableHead>
              {user && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={user ? 4 : 3} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={user ? 4 : 3} className="text-center text-muted-foreground py-8">
                  No se encontraron resultados / No results found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.term_es}</TableCell>
                  <TableCell className="font-medium">{term.term_en}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{term.definition}</TableCell>
                  {user && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(term)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(term.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} término(s) encontrado(s) / term(s) found
      </p>

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
              <Textarea value={formDef} onChange={(e) => setFormDef(e.target.value)} />
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
