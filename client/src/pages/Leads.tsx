import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, type Stage, useIndustryStages } from "@/lib/stages";
import { useIndustry } from "@/contexts/IndustryContext";
import { StageBadge } from "@/components/StageBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  DollarSign,
  Mail,
  Phone,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

type CreateLeadForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  projectType: string;
  projectAddress: string;
  projectDescription: string;
  estimatedValue: string;
  source: string;
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { stages: STAGES, projectTypes: PROJECT_TYPES, leadSources: LEAD_SOURCES, projectTypeLabel } = useIndustryStages();
  const { customerTerminology, leadFormFields } = useIndustry();

  const { data: leads, isLoading } = trpc.leads.list.useQuery(
    { search: search || undefined, stage: stageFilter !== "all" ? (stageFilter as Stage) : undefined },
    {}
  );

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.dashboard.stats.invalidate();
      setCreateOpen(false);
      reset();
      toast.success("Lead created successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm<CreateLeadForm>();

  function onSubmit(data: CreateLeadForm) {
    createLead.mutate(data);
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {leads?.length ?? 0} total leads in your pipeline
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Lead</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" {...register("firstName", { required: true })} placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" {...register("lastName", { required: true })} placeholder="Smith" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} placeholder="john@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register("phone")} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{projectTypeLabel}</Label>
                  <Select onValueChange={(v) => setValue("projectType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
                  <Input id="estimatedValue" type="number" {...register("estimatedValue")} placeholder="2500" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="projectAddress">Project Address</Label>
                <Input id="projectAddress" {...register("projectAddress")} placeholder="123 Main St, City, State" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="projectDescription">Project Description</Label>
                <Textarea id="projectDescription" {...register("projectDescription")} placeholder="Describe the project..." rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Lead Source</Label>
                <Select onValueChange={(v) => setValue("source", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="How did they find you?" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createLead.isPending}>
                  {createLead.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={stageFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStageFilter("all")}
          >
            All
          </Button>
          {STAGES.map(({ key, label }) => (
            <Button
              key={key}
              variant={stageFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setStageFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : leads?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No leads found</p>
          <p className="text-sm mt-1">Create your first lead to get started</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{customerTerminology}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Project</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Value</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stage</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Last Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads?.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/leads/${lead.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {lead.firstName[0]}{lead.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                          {lead.isDemo && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Demo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                          {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="font-medium">{lead.projectType || "—"}</p>
                    {lead.projectAddress && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{lead.projectAddress}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-semibold text-emerald-600">
                      {lead.estimatedValue ? formatCurrency(lead.estimatedValue) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={lead.stage as Stage} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                    {formatDate(lead.lastContactedAt)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {lead.scheduledDate ? (
                      <div className="flex items-center gap-1 text-blue-600 text-xs">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(lead.scheduledDate)}
                      </div>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
