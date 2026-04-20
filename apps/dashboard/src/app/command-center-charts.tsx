"use client";

import { TrafficAreaChart } from "@/components/charts";

interface Props {
  data: { time: string; requests: number; errors: number }[];
}

export function CommandCenterCharts({ data }: Props) {
  return <TrafficAreaChart data={data} />;
}
