"use client";

import { LatencyBarChart, TrafficAreaChart } from "@/components/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  trafficData: {
    time: string;
    requests: number;
    errors: number;
    latency: number;
  }[];
}

export function TrafficCharts({ trafficData }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Request Volume</CardTitle>
          <CardDescription>Requests & errors over 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <TrafficAreaChart data={trafficData} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Response Latency</CardTitle>
          <CardDescription>P50 latency in milliseconds</CardDescription>
        </CardHeader>
        <CardContent>
          <LatencyBarChart data={trafficData} />
        </CardContent>
      </Card>
    </div>
  );
}
