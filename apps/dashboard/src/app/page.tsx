import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { services, systemMetrics, trafficData } from "@/lib/data";
import { getFlags } from "@/lib/flags";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  EyeOff,
  Gauge,
  Rocket,
  Users,
  Zap,
} from "lucide-react";
import { CommandCenterCharts } from "./command-center-charts";

export const dynamic = "force-dynamic";

const kpis = [
  {
    label: "Uptime",
    value: `${systemMetrics.uptime}%`,
    icon: Activity,
    trend: "+0.02%",
  },
  {
    label: "Active Users",
    value: systemMetrics.activeUsers.toLocaleString(),
    icon: Users,
    trend: "+12.3%",
  },
  {
    label: "Requests/sec",
    value: systemMetrics.requestsPerSecond.toLocaleString(),
    icon: Zap,
    trend: "+8.1%",
  },
  {
    label: "Avg Response",
    value: `${systemMetrics.avgResponseMs}ms`,
    icon: Clock,
    trend: "-3.2ms",
  },
  {
    label: "Error Rate",
    value: `${systemMetrics.errorRate}%`,
    icon: AlertTriangle,
    trend: "-0.01%",
  },
  {
    label: "Deployments",
    value: systemMetrics.deployments.toString(),
    icon: Rocket,
    trend: "+23 this week",
  },
];

export default async function CommandCenter() {
  const flags = await getFlags();
  const showStatusBanner = flags.check("show_status_banner", true);
  const maxChartPoints = flags.check("max_chart_points", 12);
  const chartData = trafficData.slice(0, Math.max(1, Number(maxChartPoints)));

  return (
    <div className="space-y-8">
      {/* Hidden flag probes — rendered so Playwright can read the raw resolved values */}
      <div hidden data-testid="flag-show_status_banner">
        {String(showStatusBanner)}
      </div>
      <div hidden data-testid="flag-max_chart_points">
        {String(maxChartPoints)}
      </div>

      {/* Banner — gated by show_status_banner */}
      {showStatusBanner ? (
        <div
          data-testid="status-banner-on"
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
              <Gauge className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400">
                All Systems Nominal
              </p>
              <p className="text-xs text-muted-foreground">
                Last checked 12 seconds ago — next check in 48s
              </p>
            </div>
            <Badge variant="success" className="ml-auto">
              OPERATIONAL
            </Badge>
          </div>
        </div>
      ) : (
        <div
          data-testid="status-banner-off"
          aria-disabled="true"
          className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-4 opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-foreground/10">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status Banner Disabled
              </p>
              <p className="text-xs text-muted-foreground">
                Feature flag{" "}
                <code className="font-mono">show_status_banner</code> is off.
              </p>
            </div>
            <Badge variant="outline" className="ml-auto">
              DISABLED
            </Badge>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription className="text-sm font-medium">
                {kpi.label}
              </CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                {kpi.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Traffic Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Traffic Overview (24h)</CardTitle>
          <CardDescription>
            Requests and errors across all services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommandCenterCharts data={chartData} />
        </CardContent>
      </Card>

      {/* Service Health */}
      <Card>
        <CardHeader>
          <CardTitle>Service Health</CardTitle>
          <CardDescription>Real-time status of all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center gap-4 rounded-lg border p-3"
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    service.status === "healthy"
                      ? "bg-emerald-500"
                      : service.status === "degraded"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{service.name}</span>
                    <Badge
                      variant={
                        service.status === "healthy" ? "success" : "warning"
                      }
                    >
                      {service.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                    <div>
                      <span>Uptime: {service.uptime}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>CPU: {service.cpu}%</span>
                      <Progress
                        value={service.cpu}
                        className="h-1 w-16"
                        indicatorClassName={
                          service.cpu > 80
                            ? "bg-red-500"
                            : service.cpu > 60
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Mem: {service.memory}%</span>
                      <Progress
                        value={service.memory}
                        className="h-1 w-16"
                        indicatorClassName={
                          service.memory > 80
                            ? "bg-red-500"
                            : service.memory > 60
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
