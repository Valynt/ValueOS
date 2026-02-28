/**
 * NotificationsPage - Toggle row pattern for notification preferences
 */

import { useState } from "react";
import {
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings";

interface NotificationPrefs {
  emailCaseUpdates: boolean;
  emailTeamActivity: boolean;
  emailWeeklyDigest: boolean;
  emailMarketing: boolean;
  pushCaseUpdates: boolean;
  pushMentions: boolean;
  pushReminders: boolean;
  slackIntegration: boolean;
  slackCaseUpdates: boolean;
}

export function NotificationsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailCaseUpdates: true,
    emailTeamActivity: true,
    emailWeeklyDigest: false,
    emailMarketing: false,
    pushCaseUpdates: true,
    pushMentions: true,
    pushReminders: false,
    slackIntegration: false,
    slackCaseUpdates: false,
  });

  const handleToggle = (key: keyof NotificationPrefs) => (checked: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <div>
      {/* Email Notifications */}
      <SettingsSection
        title="Email notifications"
        description="Choose what updates you receive via email"
      >
        <div className="px-4">
          <SettingsToggleRow
            label="Case updates"
            description="Get notified when cases you own or follow are updated"
            checked={prefs.emailCaseUpdates}
            onChange={handleToggle("emailCaseUpdates")}
          />
          <SettingsToggleRow
            label="Team activity"
            description="Updates when team members join, leave, or change roles"
            checked={prefs.emailTeamActivity}
            onChange={handleToggle("emailTeamActivity")}
          />
          <SettingsToggleRow
            label="Weekly digest"
            description="A summary of your team's activity each week"
            checked={prefs.emailWeeklyDigest}
            onChange={handleToggle("emailWeeklyDigest")}
          />
          <SettingsToggleRow
            label="Product updates"
            description="News about new features and improvements"
            checked={prefs.emailMarketing}
            onChange={handleToggle("emailMarketing")}
          />
        </div>
      </SettingsSection>

      {/* Push Notifications */}
      <SettingsSection
        title="Push notifications"
        description="Real-time alerts in your browser"
      >
        <div className="px-4">
          <SettingsToggleRow
            label="Case updates"
            description="Instant notifications for case changes"
            checked={prefs.pushCaseUpdates}
            onChange={handleToggle("pushCaseUpdates")}
          />
          <SettingsToggleRow
            label="Mentions"
            description="When someone mentions you in a comment"
            checked={prefs.pushMentions}
            onChange={handleToggle("pushMentions")}
          />
          <SettingsToggleRow
            label="Reminders"
            description="Task and deadline reminders"
            checked={prefs.pushReminders}
            onChange={handleToggle("pushReminders")}
          />
        </div>
      </SettingsSection>

      {/* Slack Integration */}
      <SettingsSection
        title="Slack"
        description="Connect Slack to receive notifications in your workspace"
      >
        <div className="px-4">
          <SettingsToggleRow
            label="Enable Slack integration"
            description="Connect your Slack workspace to ValueOS"
            checked={prefs.slackIntegration}
            onChange={handleToggle("slackIntegration")}
          />
          {prefs.slackIntegration && (
            <SettingsToggleRow
              label="Case updates in Slack"
              description="Post case updates to a Slack channel"
              checked={prefs.slackCaseUpdates}
              onChange={handleToggle("slackCaseUpdates")}
            />
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

export default NotificationsPage;
