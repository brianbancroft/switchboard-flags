import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { settingsConfig } from "@/lib/data";
import {
  Bell,
  CheckCircle2,
  Globe,
  Key,
  Link2,
  Lock,
  Settings,
  Shield,
  XCircle,
} from "lucide-react";

function SettingRow({
  label,
  value,
  type = "text",
}: {
  label: string;
  value: string | boolean | number;
  type?: "text" | "boolean" | "code";
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {type === "boolean" ? (
        value ? (
          <Badge variant="success">Enabled</Badge>
        ) : (
          <Badge variant="secondary">Disabled</Badge>
        )
      ) : type === "code" ? (
        <code className="rounded bg-muted px-2 py-1 text-xs">
          {String(value)}
        </code>
      ) : (
        <span className="text-sm font-medium">{String(value)}</span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">System Config</h2>
        <p className="text-muted-foreground">
          Manage dashboard settings, notifications, and integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>General</CardTitle>
                <CardDescription>
                  Basic dashboard configuration
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Site Name"
              value={settingsConfig.general.siteName}
            />
            <SettingRow
              label="Timezone"
              value={settingsConfig.general.timezone}
              type="code"
            />
            <SettingRow
              label="Language"
              value={settingsConfig.general.language}
              type="code"
            />
            <SettingRow
              label="Theme"
              value={settingsConfig.general.theme}
              type="code"
            />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Alert and notification settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Email Alerts"
              value={settingsConfig.notifications.emailAlerts}
              type="boolean"
            />
            <SettingRow
              label="Slack Integration"
              value={settingsConfig.notifications.slackIntegration}
              type="boolean"
            />
            <SettingRow
              label="Slack Channel"
              value={settingsConfig.notifications.slackChannel}
              type="code"
            />
            <SettingRow
              label="PagerDuty"
              value={settingsConfig.notifications.pagerDuty}
              type="boolean"
            />
            <SettingRow
              label="Webhook URL"
              value={settingsConfig.notifications.webhookUrl}
              type="code"
            />
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Authentication and access control
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Two-Factor Auth"
              value={settingsConfig.security.twoFactorEnabled}
              type="boolean"
            />
            <SettingRow
              label="Session Timeout"
              value={`${settingsConfig.security.sessionTimeout} minutes`}
            />
            <div className="py-3 border-b">
              <span className="text-sm text-muted-foreground">
                IP Allowlist
              </span>
              <div className="mt-2 flex flex-wrap gap-1">
                {settingsConfig.security.ipAllowlist.map((ip) => (
                  <Badge key={ip} variant="outline" className="font-mono text-xs">
                    <Lock className="mr-1 h-3 w-3" />
                    {ip}
                  </Badge>
                ))}
              </div>
            </div>
            <SettingRow
              label="Audit Log Retention"
              value={`${settingsConfig.security.auditLogRetention} days`}
            />
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>
                  Connected services and third-party tools
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settingsConfig.integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{integration.name}</p>
                      {integration.lastSync && (
                        <p className="text-[11px] text-muted-foreground">
                          Last sync:{" "}
                          {new Date(integration.lastSync).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {integration.connected ? (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs text-emerald-500">
                        Connected
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Not connected
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage programmatic access to the dashboard
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                name: "Production Read-Only",
                prefix: "mc_prod_ro_",
                lastUsed: "2 minutes ago",
                scopes: ["read"],
              },
              {
                name: "CI/CD Pipeline",
                prefix: "mc_ci_",
                lastUsed: "18 minutes ago",
                scopes: ["read", "deploy"],
              },
              {
                name: "Monitoring Webhook",
                prefix: "mc_mon_",
                lastUsed: "5 seconds ago",
                scopes: ["read", "alerts"],
              },
            ].map((key) => (
              <div
                key={key.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <code className="text-xs text-muted-foreground">
                    {key.prefix}****************************
                  </code>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {key.scopes.map((scope) => (
                      <Badge key={scope} variant="outline" className="text-[10px]">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {key.lastUsed}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
