"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Server,
  Users,
  UserCheck,
  UserX,
  User,
  BarChart3,
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
  departments: Array<{ name: string; count: number }>;
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
  const [activeDeptChart, setActiveDeptChart] = useState<"horizontal" | "vertical" | "pie">("horizontal");
  const [deptTooltipData, setDeptTooltipData] = useState<{
    label: string;
    value: number;
    color: string;
    percentage: number;
  } | null>(null);
  const [deptTooltipCoords, setDeptTooltipCoords] = useState({ x: 0, y: 0 });

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
      console.error("Failed to fetch dashboard stats:", error);
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

  // Horizontal Bar Chart max calculation
  const barChartMax = useMemo(() => {
    if (!stats || stats.departments.length === 0) return 0;
    return Math.max(...stats.departments.map(d => d.count));
  }, [stats]);



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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Donut Chart (Overview) */}
          <Card className="lg:col-span-2 shadow-lg border-muted/60">
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

          {/* Horizontal Bar Chart (Departments) */}
          <Card className="lg:col-span-3 shadow-lg border-muted/60 relative">
            <CardHeader className="border-b bg-muted/20 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {t("dashboardCharts.deptBreakdown")}
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border text-[10px] sm:text-xs font-semibold self-start sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveDeptChart("horizontal")}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeDeptChart === "horizontal" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("dashboardCharts.horizontalBar")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeptChart("vertical")}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeDeptChart === "vertical" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("dashboardCharts.verticalBar")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeptChart("pie")}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${activeDeptChart === "pie" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("dashboardCharts.pieChart")}
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner />
                </div>
              ) : stats?.departments.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground font-medium">
                  {t("dashboardCharts.noData")}
                </div>
              ) : activeDeptChart === "horizontal" ? (
                <div className="space-y-4 h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                  {(() => {
                    const deptColors = [
                      "from-blue-500 to-cyan-400",
                      "from-emerald-500 to-teal-400",
                      "from-amber-500 to-orange-400",
                      "from-violet-500 to-fuchsia-400",
                      "from-rose-500 to-pink-400",
                      "from-indigo-500 to-purple-400",
                      "from-sky-500 to-blue-400",
                      "from-lime-500 to-emerald-400"
                    ];
                    return stats?.departments.map((dept, idx) => {
                      const pct = barChartMax > 0 ? (dept.count / barChartMax) * 100 : 0;
                      const colorClass = deptColors[idx % deptColors.length];
                      return (
                        <div key={dept.name} className="space-y-1 group">
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold text-muted-foreground truncate max-w-[80%]">{dept.name}</span>
                            <span className="font-bold text-foreground">{dept.count}</span>
                          </div>
                          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500 ease-out group-hover:scale-y-110 cursor-pointer`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : activeDeptChart === "vertical" ? (
                <div className="h-64 w-full overflow-x-auto overflow-y-hidden pr-2 flex items-center scrollbar-thin scrollbar-thumb-muted">
                  {(() => {
                    const visibleDepts = stats?.departments || [];
                    const svgWidth = Math.max(400, visibleDepts.length * 55);
                    const colWidth = visibleDepts.length > 0 ? (svgWidth - 50) / visibleDepts.length : 0;

                    return (
                      <div style={{ minWidth: `${svgWidth}px` }} className="h-full w-full">
                        <svg viewBox={`0 0 ${svgWidth} 210`} className="w-full h-full overflow-visible">
                          {/* Grid lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                            const yVal = 160 - ratio * 140;
                            const gridLabel = Math.round(ratio * barChartMax);
                            return (
                              <g key={idx} className="opacity-15 dark:opacity-10">
                                <line x1="30" y1={yVal} x2={svgWidth - 15} y2={yVal} stroke="currentColor" strokeDasharray="3 3" />
                                <text x="22" y={yVal + 3} className="text-[9px] font-bold fill-current" textAnchor="end">{gridLabel}</text>
                              </g>
                            );
                          })}

                          {/* Bars */}
                          {(() => {
                            const deptColors = [
                              "url(#v-grad-blue)",
                              "url(#v-grad-emerald)",
                              "url(#v-grad-amber)",
                              "url(#v-grad-violet)",
                              "url(#v-grad-rose)",
                              "url(#v-grad-indigo)",
                              "url(#v-grad-sky)",
                              "url(#v-grad-lime)"
                            ];

                            return (
                              <>
                                <defs>
                                  <linearGradient id="v-grad-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient>
                                  <linearGradient id="v-grad-emerald" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#2dd4bf" /></linearGradient>
                                  <linearGradient id="v-grad-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fb923c" /></linearGradient>
                                  <linearGradient id="v-grad-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#d946ef" /></linearGradient>
                                  <linearGradient id="v-grad-rose" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#f472b6" /></linearGradient>
                                  <linearGradient id="v-grad-indigo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" /></linearGradient>
                                  <linearGradient id="v-grad-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
                                  <linearGradient id="v-grad-lime" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#84cc16" /><stop offset="100%" stopColor="#10b981" /></linearGradient>
                                </defs>
                                {visibleDepts.map((dept, idx) => {
                                  const pct = barChartMax > 0 ? dept.count / barChartMax : 0;
                                  const barHeight = pct * 140;
                                  const maxBarWidth = 40;
                                  const w = Math.min(maxBarWidth, colWidth * 0.7);
                                  const x = 35 + idx * colWidth + (colWidth - w) / 2;
                                  const y = 160 - barHeight;
                                  const fillGradient = deptColors[idx % deptColors.length];

                                  return (
                                    <g key={dept.name} className="group/v-bar cursor-pointer">
                                      <rect
                                        x={x}
                                        y={y}
                                        width={w}
                                        height={barHeight}
                                        fill={fillGradient}
                                        rx="4"
                                        className="transition-all duration-300 hover:opacity-90 group-hover/v-bar:-translate-y-1"
                                        onMouseEnter={() => {
                                          const solidColors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#6366f1", "#0ea5e9", "#84cc16"];
                                          const pct = Math.round((dept.count / (stats?.syncOverview.total || 1)) * 100);
                                          setDeptTooltipData({
                                            label: dept.name,
                                            value: dept.count,
                                            color: solidColors[idx % solidColors.length],
                                            percentage: pct
                                          });
                                        }}
                                        onMouseMove={(e) => {
                                          const rect = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                                          if (rect) {
                                            setDeptTooltipCoords({
                                              x: e.clientX - rect.left + 12,
                                              y: e.clientY - rect.top - 28
                                            });
                                          }
                                        }}
                                        onMouseLeave={() => {
                                          setDeptTooltipData(null);
                                        }}
                                      />
                                      <text
                                        x={x + w / 2}
                                        y={y - 6}
                                        className="text-[9px] font-extrabold fill-foreground text-center opacity-0 group-hover/v-bar:opacity-100 transition-opacity duration-200 pointer-events-none"
                                        textAnchor="middle"
                                      >
                                        {dept.count}
                                      </text>
                                      {/* Xoay nhãn chéo 35 độ và thiết lập text-anchor=end để nhãn rõ ràng */}
                                      <text
                                        x={x + w / 2}
                                        y="172"
                                        className="text-[9px] fill-muted-foreground font-bold"
                                        textAnchor="end"
                                        transform={`rotate(-35 ${x + w / 2} 172)`}
                                      >
                                        {dept.name.length > 15 ? `${dept.name.slice(0, 13)}...` : dept.name}
                                      </text>
                                    </g>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="h-auto py-6 sm:py-0 sm:h-64 w-full flex items-center justify-center">
                  {(() => {
                    const visibleDepts = stats?.departments || [];
                    if (visibleDepts.length === 0) {
                      return (
                        <div className="text-xs text-muted-foreground italic text-center">
                          {t("dashboardCharts.noDeptData")}
                        </div>
                      );
                    }

                    const cx = 80;
                    const cy = 80;
                    const R = 70;
                    const deptColors = [
                      "#3b82f6", // blue
                      "#10b981", // emerald
                      "#f59e0b", // amber
                      "#8b5cf6", // violet
                      "#f43f5e", // rose
                      "#0ea5e9", // sky
                      "#14b8a6", // teal
                      "#eab308", // yellow
                      "#a855f7", // purple
                      "#ec4899", // pink
                      "#6366f1", // indigo
                      "#84cc16", // lime
                      "#f97316", // orange
                      "#06b6d4", // cyan
                    ];

                    const totalCountForPie = visibleDepts.reduce((acc, d) => acc + d.count, 0);
                    let accumulatedAngle = -Math.PI / 2;

                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full h-full">
                        <svg viewBox="0 0 160 160" className="w-56 h-56 overflow-visible shrink-0">
                          {visibleDepts.map((dept, idx) => {
                            const pct = totalCountForPie > 0 ? dept.count / totalCountForPie : 0;
                            const angleDelta = pct * 2 * Math.PI;
                            const startAngle = accumulatedAngle;
                            const endAngle = startAngle + angleDelta;
                            accumulatedAngle = endAngle;

                            const x1 = cx + R * Math.cos(startAngle);
                            const y1 = cy + R * Math.sin(startAngle);
                            const x2 = cx + R * Math.cos(endAngle);
                            const y2 = cy + R * Math.sin(endAngle);

                            const largeArcFlag = pct > 0.5 ? 1 : 0;
                            const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
                            const fillColor = deptColors[idx % deptColors.length];

                            return (
                              <g key={dept.name} className="group/pie-slice cursor-pointer">
                                <path
                                  d={pathData}
                                  fill={fillColor}
                                  stroke="var(--background)"
                                  strokeWidth="1.5"
                                  className="transition-all duration-300 hover:opacity-95 hover:scale-105 origin-[80px_80px]"
                                  onMouseEnter={() => {
                                    const pct = Math.round((dept.count / (totalCountForPie || 1)) * 100);
                                    setDeptTooltipData({
                                      label: dept.name,
                                      value: dept.count,
                                      color: fillColor,
                                      percentage: pct
                                    });
                                  }}
                                  onMouseMove={(e) => {
                                    const rect = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                                    if (rect) {
                                      setDeptTooltipCoords({
                                        x: e.clientX - rect.left + 12,
                                        y: e.clientY - rect.top - 28
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    setDeptTooltipData(null);
                                  }}
                                />
                              </g>
                            );
                          })}
                        </svg>

                        <div className="flex-1 space-y-3.5 text-sm w-full sm:w-auto font-semibold pr-2 max-h-[190px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
                          {visibleDepts.map((dept, idx) => {
                            const strokeColor = deptColors[idx % deptColors.length];
                            const pct = Math.round((dept.count / (totalCountForPie || 1)) * 100);
                            return (
                              <div key={dept.name} className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: strokeColor }} />
                                  <span className="text-muted-foreground truncate" title={dept.name}>{dept.name}</span>
                                </div>
                                <div className="shrink-0 text-right">
                                  <span className="text-foreground font-bold">{dept.count}</span>
                                  <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
            {deptTooltipData && (
              <div
                className="absolute z-50 pointer-events-none bg-popover text-popover-foreground border shadow-lg rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all duration-75 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  left: `${deptTooltipCoords.x}px`,
                  top: `${deptTooltipCoords.y}px`,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deptTooltipData.color }} />
                <span>{deptTooltipData.label}:</span>
                <span className="font-bold">{deptTooltipData.value}</span>
                <span className="text-muted-foreground/80 font-normal">({deptTooltipData.percentage}%)</span>
              </div>
            )}
          </Card>
        </div>
    </div>
  );
}
