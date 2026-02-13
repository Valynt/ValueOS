/**
 * SecurityPage - Edit-in-place security settings
 * 
 * Row-based list pattern for password, 2FA, and sessions.
 */

import { useState } from "react";
import { Shield, Monitor, Smartphone, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
import { logger } from "../../lib/logger";
  SettingsRow,
  SettingsSection,
  SettingsAlert,
} from "@/components/settings";

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  type: "desktop" | "mobile";
}

export function SecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [passwordLastChanged] = useState("3 months ago");

  const sessions: Session[] = [
    {
      id: "1",
      device: "Chrome on macOS",
      location: "San Francisco, CA",
      lastActive: "Just now",
      isCurrent: true,
      type: "desktop",
    },
    {
      id: "2",
      device: "Safari on iOS",
      location: "San Francisco, CA",
      lastActive: "2 hours ago",
      isCurrent: false,
      type: "mobile",
    },
  ];

  const handleChangePassword = () => {
    logger.info("Opening password change modal...");
  };

  const handleToggle2FA = () => {
    setMfaEnabled(!mfaEnabled);
  };

  const handleLogoutSession = (sessionId: string) => {
    logger.info("Logging out session:", sessionId);
  };

  const handleLogoutAll = () => {
    logger.info("Logging out all other sessions...");
  };

  return (
    <div>
      {/* 2FA Alert */}
      {!mfaEnabled && (
        <SettingsAlert
          type="info"
          title="Enhance your security"
          description="Enable two-factor authentication to add an extra layer of protection."
          action={{
            label: "Enable 2FA",
            onClick: handleToggle2FA,
          }}
        />
      )}

      {/* Password */}
      <SettingsSection title="Password">
        <div className="px-4">
          <SettingsRow
            label="Password"
            value={`Last changed ${passwordLastChanged}`}
            type="password"
            editable={false}
          >
            <Button variant="outline" size="sm" onClick={handleChangePassword}>
              Change password
            </Button>
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Two-Factor Authentication */}
      <SettingsSection title="Two-factor authentication">
        <div className="px-4">
          <div className="py-4 border-b border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${mfaEnabled ? "bg-emerald-100" : "bg-muted"}`}>
                  <Shield className={`h-5 w-5 ${mfaEnabled ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Authenticator app
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {mfaEnabled
                      ? "Your account is protected with an authenticator app"
                      : "Use an authenticator app to generate one-time codes"}
                  </p>
                </div>
              </div>
              <Button
                variant={mfaEnabled ? "outline" : "default"}
                size="sm"
                onClick={handleToggle2FA}
              >
                {mfaEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>

          <div className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Key className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Recovery codes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {mfaEnabled
                      ? "8 recovery codes remaining"
                      : "Enable 2FA first to generate recovery codes"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={!mfaEnabled}>
                View codes
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Active Sessions */}
      <SettingsSection
        title="Active sessions"
        description="Manage devices where you're currently logged in"
      >
        <div className="divide-y divide-border">
          {sessions.map((session) => (
            <div key={session.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {session.type === "mobile" ? (
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {session.device}
                      </p>
                      {session.isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {session.location} · {session.lastActive}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleLogoutSession(session.id)}
                  >
                    Log out
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {sessions.length > 1 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleLogoutAll}
            >
              Log out of all other sessions
            </Button>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

export default SecurityPage;
