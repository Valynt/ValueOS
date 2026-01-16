/**
 * ValueDriverLibrary - Admin command center for value drivers
 * 
 * Create, edit, publish, and manage strategic value drivers.
 */

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  TrendingUp,
  Users,
  Target,
  Sparkles,
  ArrowUpDown,
  BarChart3,
  Edit,
  Archive,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ValueDriver,
  ValueDriverType,
  DriverStatus,
  MOCK_VALUE_DRIVERS,
  VALUE_DRIVER_TYPE_LABELS,
  PERSONA_TAG_LABELS,
  SALES_MOTION_LABELS,
} from "@/types/valueDriver";
import { ValueDriverEditor } from "@/components/valueDrivers/ValueDriverEditor";

const TYPE_COLORS: Record<ValueDriverType, string> = {
  "cost-savings": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "revenue-lift": "bg-blue-100 text-blue-700 border-blue-200",
  "productivity-gain": "bg-purple-100 text-purple-700 border-purple-200",
  "risk-mitigation": "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_COLORS: Record<DriverStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-emerald-100 text-emerald-700",
  archived: "bg-red-100 text-red-600",
};

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "cost-savings", label: "Cost Savings" },
  { value: "revenue-lift", label: "Revenue Lift" },
  { value: "productivity-gain", label: "Productivity Gain" },
  { value: "risk-mitigation", label: "Risk Mitigation" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

export function ValueDriverLibrary() {
  const [drivers, setDrivers] = useState<ValueDriver[]>(MOCK_VALUE_DRIVERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState<ValueDriver | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || d.type === typeFilter;
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: drivers.length,
    published: drivers.filter((d) => d.status === "published").length,
    totalUsage: drivers.reduce((sum, d) => sum + d.usageCount, 0),
    avgWinRate: drivers
      .filter((d) => d.winRateCorrelation)
      .reduce((sum, d, _, arr) => sum + (d.winRateCorrelation || 0) / arr.length, 0),
  };

  const handleCreateNew = () => {
    setSelectedDriver(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (driver: ValueDriver) => {
    setSelectedDriver(driver);
    setIsEditorOpen(true);
  };

  const handleToggleStatus = (driver: ValueDriver) => {
    const newStatus: DriverStatus = driver.status === "published" ? "archived" : "published";
    setDrivers((prev) =>
      prev.map((d) => (d.id === driver.id ? { ...d, status: newStatus } : d))
    );
  };

  const handleSave = (driver: ValueDriver) => {
    if (selectedDriver) {
      setDrivers((prev) =>
        prev.map((d) => (d.id === driver.id ? driver : d))
      );
    } else {
      setDrivers((prev) => [...prev, { ...driver, id: `vd-${Date.now()}` }]);
    }
    setIsEditorOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Value Drivers</h1>
            <p className="text-slate-500 mt-1">
              Strategic value propositions for consistent, high-impact messaging
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Suggest
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              New Driver
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 bg-slate-50">

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Drivers</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Published</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.published}</p>
              </div>
              <Eye className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Usage</p>
                <p className="text-2xl font-bold">{stats.totalUsage}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Win Rate</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(stats.avgWinRate * 100).toFixed(0)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                placeholder="Search drivers..."
              />
            </div>
            <SimpleSelect
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={TYPE_OPTIONS}
            />
            <SimpleSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card>
        <div className="overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4">Driver</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Personas</div>
            <div className="col-span-1">Usage</div>
            <div className="col-span-1">Win Rate</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1"></div>
          </div>

          {/* Table Body */}
          <div className="divide-y">
            {filteredDrivers.map((driver) => (
              <div
                key={driver.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors"
              >
                {/* Name & Description */}
                <div className="col-span-4">
                  <p className="font-medium text-slate-900">{driver.name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {driver.description}
                  </p>
                </div>

                {/* Type */}
                <div className="col-span-2">
                  <Badge className={cn("text-xs", TYPE_COLORS[driver.type])}>
                    {VALUE_DRIVER_TYPE_LABELS[driver.type]}
                  </Badge>
                </div>

                {/* Personas */}
                <div className="col-span-2 flex flex-wrap gap-1">
                  {driver.personaTags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {PERSONA_TAG_LABELS[tag]}
                    </Badge>
                  ))}
                  {driver.personaTags.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{driver.personaTags.length - 2}
                    </Badge>
                  )}
                </div>

                {/* Usage */}
                <div className="col-span-1">
                  <span className="text-sm font-medium">{driver.usageCount}</span>
                </div>

                {/* Win Rate */}
                <div className="col-span-1">
                  {driver.winRateCorrelation ? (
                    <span className="text-sm font-medium text-emerald-600">
                      {(driver.winRateCorrelation * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-1">
                  <Badge className={cn("text-xs capitalize", STATUS_COLORS[driver.status])}>
                    {driver.status}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleEdit(driver)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleToggleStatus(driver)}
                  >
                    {driver.status === "published" ? (
                      <Archive className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Empty State */}
      {filteredDrivers.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No value drivers found</p>
          <Button variant="outline" className="mt-4" onClick={handleCreateNew}>
            Create your first driver
          </Button>
        </div>
      )}

      {/* Editor Modal */}
      {isEditorOpen && (
        <ValueDriverEditor
          driver={selectedDriver}
          onSave={handleSave}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
      </div>
    </div>
  );
}

export default ValueDriverLibrary;
