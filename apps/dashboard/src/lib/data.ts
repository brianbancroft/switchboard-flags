// Static mock data for the Mission Control dashboard

export const systemMetrics = {
  uptime: 99.97,
  activeUsers: 14_283,
  requestsPerSecond: 8_472,
  avgResponseMs: 42,
  errorRate: 0.03,
  deployments: 347,
};

export const trafficData = [
  { time: "00:00", requests: 4200, errors: 12, latency: 38 },
  { time: "02:00", requests: 2800, errors: 8, latency: 35 },
  { time: "04:00", requests: 1900, errors: 5, latency: 32 },
  { time: "06:00", requests: 3100, errors: 9, latency: 36 },
  { time: "08:00", requests: 7200, errors: 21, latency: 45 },
  { time: "10:00", requests: 9800, errors: 28, latency: 52 },
  { time: "12:00", requests: 11200, errors: 35, latency: 58 },
  { time: "14:00", requests: 10500, errors: 30, latency: 55 },
  { time: "16:00", requests: 8900, errors: 25, latency: 48 },
  { time: "18:00", requests: 7600, errors: 22, latency: 44 },
  { time: "20:00", requests: 6100, errors: 18, latency: 41 },
  { time: "22:00", requests: 5300, errors: 15, latency: 39 },
];

export const regionTraffic = [
  { region: "North America", percentage: 38, requests: 32_000 },
  { region: "Europe", percentage: 28, requests: 23_500 },
  { region: "Asia Pacific", percentage: 22, requests: 18_400 },
  { region: "South America", percentage: 7, requests: 5_900 },
  { region: "Africa", percentage: 3, requests: 2_500 },
  { region: "Oceania", percentage: 2, requests: 1_700 },
];

export const incidents = [
  {
    id: "INC-2847",
    title: "Elevated error rates on /api/checkout",
    severity: "critical" as const,
    status: "investigating" as const,
    startedAt: "2026-04-17T08:23:00Z",
    assignee: "Alice Chen",
    affectedServices: ["checkout-api", "payment-gateway"],
  },
  {
    id: "INC-2846",
    title: "Slow queries on user-profiles database",
    severity: "warning" as const,
    status: "monitoring" as const,
    startedAt: "2026-04-17T06:45:00Z",
    assignee: "Bob Martinez",
    affectedServices: ["user-profiles-db"],
  },
  {
    id: "INC-2845",
    title: "CDN cache invalidation delayed",
    severity: "info" as const,
    status: "resolved" as const,
    startedAt: "2026-04-16T22:10:00Z",
    assignee: "Carol Okafor",
    affectedServices: ["cdn-edge", "asset-pipeline"],
  },
  {
    id: "INC-2844",
    title: "Memory leak in notification-worker",
    severity: "warning" as const,
    status: "resolved" as const,
    startedAt: "2026-04-16T14:30:00Z",
    assignee: "Dave Kim",
    affectedServices: ["notification-worker"],
  },
  {
    id: "INC-2843",
    title: "SSL certificate expiry warning for *.acme.test",
    severity: "info" as const,
    status: "resolved" as const,
    startedAt: "2026-04-15T09:00:00Z",
    assignee: "Alice Chen",
    affectedServices: ["tls-gateway"],
  },
];

export const deployments = [
  {
    id: "DEP-1092",
    service: "checkout-api",
    version: "v3.14.2",
    status: "live" as const,
    deployedAt: "2026-04-17T07:30:00Z",
    deployedBy: "Alice Chen",
    commitHash: "a3f8c1d",
    duration: 142,
  },
  {
    id: "DEP-1091",
    service: "user-profiles",
    version: "v2.8.0",
    status: "live" as const,
    deployedAt: "2026-04-17T06:15:00Z",
    deployedBy: "Bob Martinez",
    commitHash: "e7b2f9a",
    duration: 98,
  },
  {
    id: "DEP-1090",
    service: "notification-worker",
    version: "v1.22.1",
    status: "rolling-back" as const,
    deployedAt: "2026-04-17T05:00:00Z",
    deployedBy: "Dave Kim",
    commitHash: "c4d6e8f",
    duration: 215,
  },
  {
    id: "DEP-1089",
    service: "search-indexer",
    version: "v4.1.0",
    status: "live" as const,
    deployedAt: "2026-04-16T22:00:00Z",
    deployedBy: "Carol Okafor",
    commitHash: "f1a2b3c",
    duration: 167,
  },
  {
    id: "DEP-1088",
    service: "cdn-edge",
    version: "v2.3.5",
    status: "live" as const,
    deployedAt: "2026-04-16T18:30:00Z",
    deployedBy: "Alice Chen",
    commitHash: "d5e6f7a",
    duration: 54,
  },
  {
    id: "DEP-1087",
    service: "payment-gateway",
    version: "v5.0.0-rc.1",
    status: "canary" as const,
    deployedAt: "2026-04-16T16:00:00Z",
    deployedBy: "Bob Martinez",
    commitHash: "b8c9d0e",
    duration: 320,
  },
];

export const services = [
  { name: "checkout-api", status: "healthy" as const, uptime: 99.99, cpu: 34, memory: 62 },
  { name: "user-profiles", status: "healthy" as const, uptime: 99.98, cpu: 28, memory: 55 },
  { name: "payment-gateway", status: "healthy" as const, uptime: 99.95, cpu: 41, memory: 71 },
  { name: "notification-worker", status: "degraded" as const, uptime: 98.2, cpu: 87, memory: 92 },
  { name: "search-indexer", status: "healthy" as const, uptime: 99.97, cpu: 52, memory: 68 },
  { name: "cdn-edge", status: "healthy" as const, uptime: 100, cpu: 12, memory: 30 },
  { name: "analytics-pipeline", status: "healthy" as const, uptime: 99.96, cpu: 45, memory: 58 },
  { name: "auth-service", status: "healthy" as const, uptime: 99.99, cpu: 19, memory: 44 },
];

export const settingsConfig = {
  general: {
    siteName: "ACME Mission Control",
    timezone: "UTC",
    language: "en-US",
    theme: "dark",
  },
  notifications: {
    emailAlerts: true,
    slackIntegration: true,
    slackChannel: "#ops-alerts",
    pagerDuty: true,
    webhookUrl: "https://hooks.acme.test/alerts",
  },
  security: {
    twoFactorEnabled: true,
    sessionTimeout: 30,
    ipAllowlist: ["10.0.0.0/8", "172.16.0.0/12"],
    auditLogRetention: 90,
  },
  integrations: [
    { name: "GitHub", connected: true, lastSync: "2026-04-17T07:00:00Z" },
    { name: "Slack", connected: true, lastSync: "2026-04-17T08:30:00Z" },
    { name: "PagerDuty", connected: true, lastSync: "2026-04-17T08:00:00Z" },
    { name: "Datadog", connected: false, lastSync: null },
    { name: "Sentry", connected: true, lastSync: "2026-04-17T06:00:00Z" },
  ],
};
