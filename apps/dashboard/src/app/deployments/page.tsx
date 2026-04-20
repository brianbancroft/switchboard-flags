import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deployments } from "@/lib/data";
import {
  CheckCircle2,
  Clock,
  FlaskConical,
  GitCommit,
  Rocket,
  RotateCcw,
  Timer,
} from "lucide-react";

const statusConfig = {
  live: {
    label: "Live",
    variant: "success" as const,
    icon: CheckCircle2,
  },
  "rolling-back": {
    label: "Rolling Back",
    variant: "destructive" as const,
    icon: RotateCcw,
  },
  canary: {
    label: "Canary",
    variant: "warning" as const,
    icon: FlaskConical,
  },
  deploying: {
    label: "Deploying",
    variant: "secondary" as const,
    icon: Rocket,
  },
};

export default function DeploymentsPage() {
  const liveCount = deployments.filter((d) => d.status === "live").length;
  const avgDuration =
    Math.round(
      deployments.reduce((sum, d) => sum + d.duration, 0) /
        deployments.length,
    );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Deployments</h2>
        <p className="text-muted-foreground">
          Track deployment pipelines and release history across all services.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Deployments Today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-chart-1" />
              <span className="text-2xl font-bold">{deployments.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {liveCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Deploy Time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{avgDuration}s</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rollback Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">2.1%</div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>
            Deployment pipeline activity for the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {deployments.map((dep, index) => {
              const status = statusConfig[dep.status];
              const StatusIcon = status.icon;

              return (
                <div key={dep.id} className="relative flex gap-4">
                  {/* Timeline line */}
                  {index < deployments.length - 1 && (
                    <div className="absolute left-[15px] top-[32px] h-[calc(100%+8px)] w-px bg-border" />
                  )}

                  {/* Timeline dot */}
                  <div
                    className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                      dep.status === "live"
                        ? "border-emerald-500 bg-emerald-500/10"
                        : dep.status === "rolling-back"
                          ? "border-red-500 bg-red-500/10"
                          : dep.status === "canary"
                            ? "border-amber-500 bg-amber-500/10"
                            : "border-border bg-muted"
                    }`}
                  >
                    <StatusIcon
                      className={`h-4 w-4 ${
                        dep.status === "live"
                          ? "text-emerald-500"
                          : dep.status === "rolling-back"
                            ? "text-red-500"
                            : dep.status === "canary"
                              ? "text-amber-500"
                              : "text-muted-foreground"
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{dep.service}</span>
                          <Badge variant="outline">{dep.version}</Badge>
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deployed by {dep.deployedBy}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {dep.id}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3" />
                        <code>{dep.commitHash}</code>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(dep.deployedAt).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {dep.duration}s
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
