import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, Users, FileText, BookOpen, Loader2, ShieldAlert } from "lucide-react";

interface AuditEntry {
  id: string;
  user_email: string | null;
  action: string;
  details: any;
  created_at: string;
}

interface Stats {
  totalComparisons: number;
  totalLogins: number;
  totalGlossaryChanges: number;
  recentActivity: AuditEntry[];
}

const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Inicio de sesión", color: "default" },
  logout: { label: "Cierre de sesión", color: "secondary" },
  comparison_started: { label: "Comparación iniciada", color: "default" },
  comparison_completed: { label: "Comparación completada", color: "default" },
  glossary_term_created: { label: "Término creado", color: "default" },
  glossary_term_updated: { label: "Término editado", color: "secondary" },
  glossary_term_deleted: { label: "Término eliminado", color: "destructive" },
};

const DashboardTab = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);

      // Fetch recent activity
      const { data: activity } = await supabase
        .from("audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      const entries = ((activity as any[]) || []) as AuditEntry[];

      const totalComparisons = entries.filter(
        (e) => e.action === "comparison_completed"
      ).length;
      const totalLogins = entries.filter((e) => e.action === "login").length;
      const totalGlossaryChanges = entries.filter((e) =>
        e.action.startsWith("glossary_term_")
      ).length;

      setStats({
        totalComparisons,
        totalLogins,
        totalGlossaryChanges,
        recentActivity: entries.slice(0, 30),
      });
      setLoading(false);
    };

    fetchStats();
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">
          Inicia sesión como admin para ver el dashboard.
        </p>
        <p className="text-muted-foreground/60 text-xs">
          Sign in as admin to view the dashboard.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comparaciones / Comparisons
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalComparisons}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inicios de Sesión / Logins
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalLogins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cambios al Glosario / Glossary Changes
            </CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalGlossaryChanges}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Actividad Reciente / Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay actividad registrada aún. / No activity recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha / Date</TableHead>
                  <TableHead>Usuario / User</TableHead>
                  <TableHead>Acción / Action</TableHead>
                  <TableHead>Detalles / Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentActivity.map((entry) => {
                  const info = actionLabels[entry.action] || { label: entry.action, color: "outline" };
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{entry.user_email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={info.color as any} className="text-xs">
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {entry.details ? JSON.stringify(entry.details) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardTab;
