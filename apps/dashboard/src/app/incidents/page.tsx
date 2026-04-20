import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { incidents } from "@/lib/data";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Search,
  ShieldAlert,
} from "lucide-react";

const severityConfig = {
  critical: { variant: "destructive" as const, icon: ShieldAlert },
  warning: { variant: "warning" as const, icon: AlertTriangle },
  info: { variant: "secondary" as const, icon: Eye },
};

const statusConfig = {
  investigating: {
    label: "Investigating",
    color: "text-red-400",
    icon: Search,
  },
  monitoring: { label: "Monitoring", color: "text-amber-400", icon: Clock },
  resolved: {
    label: "Resolved",
    color: "text-emerald-400",
    icon: CheckCircle2,
  },
};

export default function IncidentsPage() {
  const activeCount = incidents.filter(
    (i) => i.status !== "resolved",
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Incident Log</h2>
        <p className="text-muted-foreground">
          Track and manage operational incidents across all services.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Incidents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {activeCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mean Time to Resolve</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4h 23m</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incidents This Week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>SLA Compliance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">99.2%</div>
          </CardContent>
        </Card>
      </div>

      {/* Incident List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>
            Showing {incidents.length} most recent incidents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {incidents.map((incident) => {
              const severity = severityConfig[incident.severity];
              const status = statusConfig[incident.status];
              const SeverityIcon = severity.icon;
              const StatusIcon = status.icon;

              return (
                <div
                  key={incident.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <div className="mt-0.5">
                    <SeverityIcon
                      className={`h-5 w-5 ${
                        incident.severity === "critical"
                          ? "text-red-400"
                          : incident.severity === "warning"
                            ? "text-amber-400"
                            : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {incident.id}
                          </span>
                          <Badge variant={severity.variant}>
                            {incident.severity}
                          </Badge>
                        </div>
                        <h4 className="mt-1 font-medium">{incident.title}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusIcon className={`h-4 w-4 ${status.color}`} />
                        <span className={`text-sm font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Assignee: {incident.assignee}</span>
                      <span>
                        Started:{" "}
                        {new Date(incident.startedAt).toLocaleString()}
                      </span>
                      <div className="flex gap-1">
                        {incident.affectedServices.map((svc) => (
                          <Badge key={svc} variant="outline" className="text-[10px]">
                            {svc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
