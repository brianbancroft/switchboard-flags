import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { regionTraffic, trafficData } from "@/lib/data";
import { Globe, TrendingUp } from "lucide-react";
import { TrafficCharts } from "./traffic-charts";

export default function TrafficPage() {
  const totalRequests = regionTraffic.reduce((sum, r) => sum + r.requests, 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Signal Traffic</h2>
        <p className="text-muted-foreground">
          Monitor request volume, latency, and geographic distribution.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Peak Requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">11,200/s</div>
            <p className="text-xs text-muted-foreground">at 12:00 UTC</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Latency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">43.6ms</div>
            <p className="flex items-center gap-1 text-xs text-emerald-500">
              <TrendingUp className="h-3 w-3" />
              5.2% faster than yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Errors (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">228</div>
            <p className="text-xs text-muted-foreground">
              0.03% error rate overall
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <TrafficCharts trafficData={trafficData} />

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Geographic Distribution</CardTitle>
              <CardDescription>
                Traffic by region —{" "}
                {totalRequests.toLocaleString()} total requests
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {regionTraffic.map((region) => (
              <div key={region.region} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{region.region}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {region.requests.toLocaleString()} req/s
                    </span>
                    <Badge variant="secondary">{region.percentage}%</Badge>
                  </div>
                </div>
                <Progress
                  value={region.percentage}
                  className="h-2"
                  indicatorClassName="bg-chart-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
