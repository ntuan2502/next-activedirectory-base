"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Server,
  Users,
  UserCheck,
  UserX,
  User,
  PieChart
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { LoadingSpinner } from "@/components/loading-overlay";

type DashboardStats = {
  syncOverview: {
    total: number;
    active: number;
    disabled: number;
    local: number;
  };
  activity: Array<{ date: string; label: string; count: number }>;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Stats State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [tooltipData, setTooltipData] = useState<{
    label: string;
    value: number;
    colorClass: string;
    percentage: number;
  } | null>(null);
  const [tooltipCoords, setTooltipCoords] = useState({ x: 0, y: 0 });


  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setStats(result.data);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchStats());
  }, []);



  // Donut Chart logic calculations
  const donutSegments = useMemo(() => {
    if (!stats) return [];
    const { active, disabled, local } = stats.syncOverview;
    const total = active + disabled + local;
    if (total === 0) return [];

    const segments = [
      { key: "active", value: active, strokeClass: "stroke-emerald-500", fillClass: "bg-emerald-500", label: t("dashboardCharts.syncedUsers") },
      { key: "local", value: local, strokeClass: "stroke-amber-500", fillClass: "bg-amber-500", label: t("dashboardCharts.pendingUsers") },
      { key: "disabled", value: disabled, strokeClass: "stroke-rose-500", fillClass: "bg-rose-500", label: t("dashboardCharts.disabledUsers") },
    ].filter(s => s.value > 0);

    let accumulatedPercent = 0;
    return segments.map((seg) => {
      const percent = seg.value / total;
      const strokeDasharray = `${percent * 226.2} 226.2`;
      const strokeDashoffset = -accumulatedPercent * 226.2;
      accumulatedPercent += percent;
      return {
        ...seg,
        strokeDasharray,
        strokeDashoffset,
        percentage: Math.round(percent * 100)
      };
    });
  }, [stats, t]);





  return (
    <div className="space-y-6">
      {/* Header and Control Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Server className="w-8 h-8 text-primary" />
            {t("common.dashboard")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("dashboard.signedInAs")} <span className="font-semibold text-foreground">{user?.username}</span>
          </p>
        </div>
        <div className="flex gap-3">
        </div>
      </div>

        {/* 1. Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-md border-muted/50 hover:border-primary/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("common.users")}</span>
              <Users className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight">{stats?.syncOverview.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t("dashboard.totalUsersDesc")}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-muted/50 hover:border-emerald-500/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboardCharts.syncedUsers")}</span>
              <UserCheck className="w-5 h-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-emerald-500">{stats?.syncOverview.active}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t("dashboard.activeAdUsersDesc")}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-muted/50 hover:border-rose-500/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboardCharts.disabledUsers")}</span>
              <UserX className="w-5 h-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-rose-500">{stats?.syncOverview.disabled}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t("dashboard.disabledAdUsersDesc")}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-muted/50 hover:border-amber-500/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboardCharts.pendingUsers")}</span>
              <User className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-amber-500">{stats?.syncOverview.local}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t("dashboard.localUsersDesc")}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 2. Charts Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Donut Chart (Overview) */}
          <Card className="shadow-lg border-muted/60">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                {t("dashboardCharts.syncOverview")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner />
                </div>
              ) : donutSegments.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground font-medium">
                  {t("dashboardCharts.noData")}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-auto py-6 sm:py-0 sm:h-64">
                  <div className="relative w-56 h-56">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.key}
                          cx="50"
                          cy="50"
                          r="36"
                          fill="transparent"
                          className={`${seg.strokeClass} transition-all duration-300 hover:stroke-[12px] cursor-pointer`}
                          strokeWidth="9"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          transform="rotate(-90 50 50)"
                          onMouseEnter={() => {
                            setTooltipData({ label: seg.label, value: seg.value, colorClass: seg.fillClass, percentage: seg.percentage });
                          }}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                            if (rect) {
                              setTooltipCoords({
                                x: e.clientX - rect.left + 12,
                                y: e.clientY - rect.top - 28
                              });
                            }
                          }}
                          onMouseLeave={() => {
                            setTooltipData(null);
                          }}
                        />
                      ))}
                      <circle cx="50" cy="50" r="30" className="fill-background" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none select-none">
                      <span className="text-4xl font-extrabold">{stats?.syncOverview.total}</span>
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{t("dashboardCharts.totalUsers")}</span>
                    </div>
                    {tooltipData && (
                      <div
                        className="absolute z-50 pointer-events-none bg-popover text-popover-foreground border shadow-lg rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all duration-75 animate-in fade-in zoom-in-95 duration-100"
                        style={{
                          left: `${tooltipCoords.x}px`,
                          top: `${tooltipCoords.y}px`,
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full ${tooltipData.colorClass}`} />
                        <span>{tooltipData.label}:</span>
                        <span className="font-bold">{tooltipData.value}</span>
                        <span className="text-muted-foreground/80 font-normal">({tooltipData.percentage}%)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-3.5 w-full sm:w-auto">
                    {donutSegments.map((seg) => (
                      <div key={seg.key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-sm ${seg.fillClass}`} />
                          <span className="font-semibold text-muted-foreground">{seg.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{seg.value}</span>
                          <span className="text-xs text-muted-foreground ml-1">({seg.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
