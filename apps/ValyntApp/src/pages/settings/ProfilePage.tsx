/**
 * ProfilePage - Edit-in-place profile settings
 *
 * Row-based list pattern with read-only display and Edit actions.
 * Data sourced from the authenticated user's Supabase session.
 */

import { Camera } from "lucide-react";
import { useState, useEffect } from "react";

import { logger } from "../../lib/logger";

import {
  SettingsAlert,
  SettingsRow,
  SettingsSection,
} from "@/components/settings";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileData {
  fullName: string;
  email: string;
  emailVerified: boolean;
  username: string;
  jobTitle: string;
  timezone: string;
  language: string;
}

export function ProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileData>({
    fullName: user?.user_metadata?.full_name ?? "",
    email: user?.email ?? "",
    emailVerified: user?.email_confirmed_at != null,
    username: user?.user_metadata?.username ?? "",
    jobTitle: user?.user_metadata?.job_title ?? "",
    timezone: user?.user_metadata?.timezone ?? "UTC",
    language: user?.user_metadata?.language ?? "English",
  });

  // Keep profile in sync if auth state changes
  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        emailVerified: user.email_confirmed_at != null,
        username: user.user_metadata?.username ?? "",
        jobTitle: user.user_metadata?.job_title ?? "",
        timezone: user.user_metadata?.timezone ?? "UTC",
        language: user.user_metadata?.language ?? "English",
      });
    }
  }, [user]);

  const handleSave = (field: keyof ProfileData) => (value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    // TODO: persist via PATCH /api/users/me
    logger.info("Profile field updated", { field, value });
  };

  const handleVerifyEmail = () => {
    logger.info("Sending verification email...");
    // TODO: call supabase.auth.resend({ type: 'signup', email: profile.email })
  };

  return (
    <div>
      {/* Email Verification Alert */}
      {!profile.emailVerified && (
        <SettingsAlert
          type="warning"
          title="Verify your email"
          description="Please verify your email address to access all features."
          action={{
            label: "Verify email",
            onClick: handleVerifyEmail,
          }}
        />
      )}

      {/* Profile Photo Section */}
      <SettingsSection>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar name={profile.fullName || profile.email} size="lg" />
              <button
                className="absolute -bottom-1 -right-1 p-1.5 bg-white border border-border rounded-full shadow-sm hover:bg-muted transition-colors"
                aria-label="Upload profile photo"
              >
                <Camera className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              </button>
            </div>
            <div>
              <p className="font-medium">{profile.fullName || profile.email}</p>
              {profile.username && (
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Update
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Delete
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Personal Information */}
      <SettingsSection title="Personal information">
        <div className="px-4">
          <SettingsRow
            label="Full name"
            value={profile.fullName}
            onSave={handleSave("fullName")}
          />
          <SettingsRow
            label="Email address"
            value={profile.email}
            type="email"
            onSave={handleSave("email")}
            description={profile.emailVerified ? "Verified" : "Not verified"}
          />
          <SettingsRow
            label="Username"
            value={profile.username}
            onSave={handleSave("username")}
          />
          <SettingsRow
            label="Job title"
            value={profile.jobTitle}
            onSave={handleSave("jobTitle")}
          />
        </div>
      </SettingsSection>

      {/* Preferences */}
      <SettingsSection title="Preferences">
        <div className="px-4">
          <SettingsRow
            label="Timezone"
            value={profile.timezone}
            onSave={handleSave("timezone")}
          />
          <SettingsRow
            label="Language"
            value={profile.language}
            onSave={handleSave("language")}
          />
        </div>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection title="Danger zone" description="Irreversible actions">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              aria-label="Delete your account permanently"
            >
              Delete account
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

export default ProfilePage;
