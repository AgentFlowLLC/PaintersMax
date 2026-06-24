import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDateTime, type Stage } from "@/lib/stages";
import { useIndustry } from "@/contexts/IndustryContext";
import { StageBadge } from "@/components/StageBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  CalendarDays,
  DollarSign,
  Mail,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowRight,
  Clock,
  Target,
} from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useBranding } from "@/contexts/BrandingContext";
import { ProfileCompletion } from "@/components/ProfileCompletion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DateRange = "this_month" | "last_30" | "all_time";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_30", label: "Last 30 Days" },
  { value: "all_time", label: "All Time" },
];

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  color = "blue",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: "blue" | "green" | "amber" | "violet" | "rose";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                {trendUp !== false ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-rose-500" />
                )}
                <span className={`text-xs font-medium ${trendUp !== false ? "text-emerald-600" : "text-rose-600"}`}>
                  {trend}
                </span>
              </div>
            )}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>("all_time");
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery({ dateRange });
  const { data: trendData, isLoading: trendLoading } = trpc.dashboard.revenueTrend.useQuery();
  const { data: marketPosition } = trpc.dashboard.marketPosition.useQuery(undefined, { retry: false });
  const [bannerDismissed, setBannerDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("demo_banner_dismissed") === "true"
  );
  const [, setLocation] = useLocation();
  const { branding } = useBranding();
  const lineColor = branding.primaryColor || "#3b82f6";
  const { dashboardKPILabels, jobTerminologyPlural, revenueLabel } = useIndustry();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const stageCounts = stats?.stageCounts || {};
  const totalLeads = stats?.totalLeads ?? 0;
  const pipelineValue = stats?.pipelineValue ?? 0;
  const revenueCollected = stats?.revenueCollected ?? 0;
  const upcomingJobsCount = stats?.upcomingJobsCount ?? 0;
  const conversionRate = stats?.conversionRate ?? 0;
  const paidLeads = stats?.paidLeads ?? 0;
  const upcomingJobs = stats?.upcomingJobs || [];
  const recentActivity = stats?.recentActivity || [];

  const stages: Stage[] = ["lead", "quoted", "scheduled", "in_progress", "completed", "paid"];

  const rangeLabel = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? "All Time";

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Completion Widget */}
      <ProfileCompletion />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Overview of your business pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date-range filter toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  dateRange === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setLocation("/leads")} size="sm">
            <Users className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Demo awareness banner — shows only when demo leads exist, dismissible */}
      {stats?.hasDemoLeads && !bannerDismissed && (
        <div className="relative flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <span className="mt-0.5">🎯</span>
          <p className="flex-1">
            Your dashboard includes <strong>3 sample leads</strong> to help you get familiar — they'll disappear after 30 days.
            Add your first real lead anytime using the button above.
          </p>
          <button
            onClick={() => {
              localStorage.setItem("demo_banner_dismissed", "true");
              setBannerDismissed(true);
            }}
            className="shrink-0 text-yellow-600 hover:text-yellow-900 transition-colors font-bold text-base leading-none mt-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Stats Row — 5 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title={dashboardKPILabels.totalLeads}
          value={totalLeads}
          subtitle={rangeLabel}
          icon={Users}
          color="blue"
        />
        <StatCard
          title={dashboardKPILabels.pipelineValue}
          value={formatCurrency(pipelineValue)}
          subtitle={rangeLabel}
          icon={BarChart3}
          color="violet"
        />
        <StatCard
          title={dashboardKPILabels.revenueCollected}
          value={formatCurrency(revenueCollected)}
          subtitle="Paid invoices"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title={dashboardKPILabels.upcomingJobs}
          value={upcomingJobsCount}
          subtitle="Next 7 days"
          icon={CalendarDays}
          color="amber"
        />
        <StatCard
          title={dashboardKPILabels.conversionRate}
          value={`${conversionRate}%`}
          subtitle={`${paidLeads} of ${totalLeads} leads paid`}
          icon={Target}
          color="rose"
          trend={conversionRate > 0 ? `${conversionRate}% close rate` : undefined}
          trendUp={conversionRate >= 20}
        />
      </div>

      {/* Market position nudge — fail silently if API unavailable */}
      {marketPosition && (
        marketPosition.isAlone ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <span className="text-xl mt-0.5">🏆</span>
            <p className="text-sm text-emerald-900">
              <strong>You're the only painting company in {marketPosition.primaryCity} on PaintersMax</strong> — your
              competitors haven't found us yet. Every lead in your area goes to you.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-xl mt-0.5">⚡</span>
            <p className="text-sm text-amber-900">
              <strong>{marketPosition.competitorCount} other painting {marketPosition.competitorCount === 1 ? "company" : "companies"} in your area</strong> joined
              PaintersMax this month. Stay ahead — upgrade to Pro to unlock city landing pages and capture leads first.
            </p>
          </div>
        )
      )}

      {/* Revenue Trend Chart */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">{`${revenueLabel} Trend`}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{`Weekly ${revenueLabel.toLowerCase()} over the last 12 weeks`}</p>
          </div>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          {trendLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={trendData ?? []}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  formatter={(value: number) => [formatCurrency(value), revenueLabel]}
                  labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={lineColor}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: lineColor, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Overview + Upcoming Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">Pipeline Overview</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setLocation("/pipeline")}
            >
              View Board <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((stage) => {
              const count = stageCounts[stage] || 0;
              const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <StageBadge stage={stage} size="sm" />
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stage === "lead" ? "bg-slate-400" :
                        stage === "quoted" ? "bg-blue-500" :
                        stage === "scheduled" ? "bg-violet-500" :
                        stage === "in_progress" ? "bg-amber-500" :
                        stage === "completed" ? "bg-emerald-500" :
                        "bg-green-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-6 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Upcoming Jobs */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">{`Upcoming ${jobTerminologyPlural}`}</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{`No ${jobTerminologyPlural.toLowerCase()} scheduled this week`}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingJobs.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/leads/${job.leadId}`)}
                  >
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {job.firstName} {job.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.projectType || "Project"}
                      </p>
                      <p className="text-xs text-blue-600 font-medium mt-0.5">
                        {job.scheduledDate
                          ? new Date(job.scheduledDate).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setLocation("/communications")}
          >
            View All <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    item.type === "email" ? "bg-blue-50" :
                    item.type === "call" ? "bg-green-50" :
                    item.type === "note" ? "bg-amber-50" :
                    "bg-slate-100"
                  }`}>
                    {item.type === "email" ? <Mail className="h-3.5 w-3.5 text-blue-600" /> :
                     item.type === "call" ? <MessageSquare className="h-3.5 w-3.5 text-green-600" /> :
                     <Clock className="h-3.5 w-3.5 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.subject || item.type}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.content}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDateTime(item.sentAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
