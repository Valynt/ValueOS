import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Bell,
  Building2,
  Calendar,
  Check,
  Clock,
  Globe,
  Loader2,
  Mail,
  Pencil,
  Shield,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
];

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(date);
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      profileQuery.refetch();
      toast.success("Profile updated successfully");
      setEditing(false);
    },
    onError: (err) => {
      toast.error(`Failed to update profile: ${err.message}`);
    },
  });
  const prefsMutation = trpc.profile.updatePreferences.useMutation({
    onSuccess: () => {
      profileQuery.refetch();
      toast.success("Preferences saved");
    },
    onError: (err) => {
      toast.error(`Failed to save preferences: ${err.message}`);
    },
  });

  const profile = profileQuery.data;

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    company: "",
    jobTitle: "",
    timezone: "UTC",
  });

  // Sync form when profile loads or editing starts
  useEffect(() => {
    if (profile && editing) {
      setForm({
        displayName: profile.displayName ?? profile.name ?? "",
        bio: profile.bio ?? "",
        company: profile.company ?? "",
        jobTitle: profile.jobTitle ?? "",
        timezone: profile.timezone ?? "UTC",
      });
    }
  }, [profile, editing]);

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      displayName: form.displayName || null,
      bio: form.bio || null,
      company: form.company || null,
      jobTitle: form.jobTitle || null,
      timezone: form.timezone,
    });
  }, [form, updateMutation]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handlePrefChange = useCallback(
    (key: string, value: boolean | string) => {
      prefsMutation.mutate({ [key]: value });
    },
    [prefsMutation]
  );

  if (authLoading || profileQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  const displayName = profile.displayName ?? profile.name ?? "User";
  const prefs = (profile.preferences as Record<string, unknown>) ?? {};

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-8">
        <PageHeader
          title="Profile"
          description="Manage your account details and preferences"
        />

        {/* ── Profile Header Card ── */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={profile.avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold truncate">{displayName}</h2>
                  <Badge
                    variant={profile.role === "admin" ? "default" : "secondary"}
                    className="shrink-0"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {profile.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                </div>

                {(profile.jobTitle || profile.company) && (
                  <p className="text-muted-foreground mt-1">
                    {profile.jobTitle}
                    {profile.jobTitle && profile.company && " at "}
                    {profile.company}
                  </p>
                )}

                {profile.bio && (
                  <p className="text-sm text-muted-foreground mt-2 max-w-lg">{profile.bio}</p>
                )}

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {profile.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {profile.email}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {profile.timezone ?? "UTC"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {formatDate(profile.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last active {formatRelativeTime(profile.lastSignedIn)}
                  </span>
                </div>
              </div>

              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Edit Form ── */}
        {editing && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">
                    <User className="h-3.5 w-3.5 inline mr-1.5" />
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Your display name"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">
                    <Shield className="h-3.5 w-3.5 inline mr-1.5" />
                    Job Title
                  </Label>
                  <Input
                    id="jobTitle"
                    value={form.jobTitle}
                    onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    placeholder="e.g. VP of Strategy"
                    maxLength={255}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">
                  <Building2 className="h-3.5 w-3.5 inline mr-1.5" />
                  Company / Organization
                </Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Valynt Engineering"
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="A brief description about yourself..."
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {form.bio.length}/500
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">
                  <Globe className="h-3.5 w-3.5 inline mr-1.5" />
                  Timezone
                </Label>
                <Select
                  value={form.timezone}
                  onValueChange={(val) => setForm((f) => ({ ...f, timezone: val }))}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateMutation.isPending}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Account Details ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Details</CardTitle>
            <CardDescription>Information from your authentication provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-1">Email</p>
                <p className="font-medium">{profile.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Login Method</p>
                <p className="font-medium capitalize">{user.loginMethod ?? "OAuth"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Role</p>
                <p className="font-medium capitalize">{profile.role}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">User ID</p>
                <p className="font-mono text-xs">{profile.openId}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Account Created</p>
                <p className="font-medium">{formatDate(profile.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Last Sign In</p>
                <p className="font-medium">{formatRelativeTime(profile.lastSignedIn)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Notification Preferences ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              <Bell className="h-4 w-4 inline mr-2" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Control how you receive updates and alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive email alerts for case updates and agent completions
                </p>
              </div>
              <Switch
                checked={!!prefs.emailNotifications}
                onCheckedChange={(val) => handlePrefChange("emailNotifications", val)}
                disabled={prefsMutation.isPending}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Agent Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when agents complete analysis or flag integrity issues
                </p>
              </div>
              <Switch
                checked={!!prefs.agentNotifications}
                onCheckedChange={(val) => handlePrefChange("agentNotifications", val)}
                disabled={prefsMutation.isPending}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a weekly summary of pipeline activity and agent performance
                </p>
              </div>
              <Switch
                checked={!!prefs.weeklyDigest}
                onCheckedChange={(val) => handlePrefChange("weeklyDigest", val)}
                disabled={prefsMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Danger Zone ── */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible account actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete Account</p>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => toast.info("Account deletion coming soon")}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
