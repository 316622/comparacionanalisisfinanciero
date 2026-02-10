import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { glossaryTerms } from "@/data/glossary";
import { Search } from "lucide-react";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const GlossaryTab = () => {
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let terms = glossaryTerms;
    if (activeLetter) {
      terms = terms.filter(
        (t) =>
          t.spanish.toUpperCase().startsWith(activeLetter) ||
          t.english.toUpperCase().startsWith(activeLetter)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      terms = terms.filter(
        (t) =>
          t.spanish.toLowerCase().includes(q) ||
          t.english.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q)
      );
    }
    return terms;
  }, [search, activeLetter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar / Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveLetter(null)}
          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
            activeLetter === null
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          Todos / All
        </button>
        {alphabet.map((letter) => (
          <button
            key={letter}
            onClick={() => setActiveLetter(letter === activeLetter ? null : letter)}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              activeLetter === letter
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No se encontraron resultados / No results found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.spanish}</TableCell>
                  <TableCell className="font-medium">{term.english}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{term.definition}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} término(s) encontrado(s) / term(s) found
      </p>
    </div>
  );
};

export default GlossaryTab;
