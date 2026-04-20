"use client";

import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  LayoutDashboard,
  Rocket,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/traffic", label: "Signal Traffic", icon: BarChart3 },
  { href: "/incidents", label: "Incident Log", icon: AlertTriangle },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/settings", label: "System Config", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">
            MISSION CONTROL
          </h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Switchboard Demo
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-emerald-500" />
          <span className="text-xs text-muted-foreground">
            All systems operational
          </span>
        </div>
      </div>
    </aside>
  );
}
