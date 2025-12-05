import React, { useState } from 'react';
import { SettingsSection } from '../../components/Settings/SettingsSection';
import {
  Bell, Mail, MessageSquare, Download, Upload, Check, AlertCircle,
  Clock, Workflow, Archive, FileText, Loader2
} from 'lucide-react';

interface NotificationSettings {
  mentions: boolean;
  taskAssignments: boolean;
  weeklyDigest: boolean;
  projectUpdates: boolean;
  emailNotifications: boolean;
  slackNotifications: boolean;
}

interface WorkflowSettings {
  defaultTaskStatus: string;
  requireApproval: boolean;
  autoArchive: boolean;
  archiveDays: number;
  defaultAssignee: string;
}

export const TeamSettings: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationSettings>({
    mentions: true,
    taskAssignments: true,
    weeklyDigest: true,
    projectUpdates: false,
    emailNotifications: true,
    slackNotifications: false,
  });

  const [workflow, setWorkflow] = useState<WorkflowSettings>({
    defaultTaskStatus: 'todo',
    requireApproval: false,
    autoArchive: true,
    archiveDays: 90,
    defaultAssignee: 'unassigned',
  });

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleWorkflowChange = (key: keyof WorkflowSettings, value: any) => {
    setWorkflow(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveSettings = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportSettings = async () => {
    setExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const settings = {
      notifications,
      workflow,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (imported.notifications) setNotifications(imported.notifications);
      if (imported.workflow) setWorkflow(imported.workflow);

      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      logger.error('Import failed:', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Notification Preferences"
        description="Configure how workspace members receive notifications"
        actions={
          saveSuccess && (
            <div className="flex items-center space-x-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              <span>Settings saved</span>
            </div>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">@Mentions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify members when they are mentioned
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications.mentions}
                  onChange={() => handleNotificationToggle('mentions')}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Task Assignments</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify when tasks are assigned
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications.taskAssignments}
                  onChange={() => handleNotificationToggle('taskAssignments')}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Weekly Digest</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send weekly activity summary
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications.weeklyDigest}
                  onChange={() => handleNotificationToggle('weeklyDigest')}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-start justify-between p-4 border border-border rounded-lg">
              <div className="flex items-start space-x-3">
                <Workflow className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Project Updates</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Notify on project status changes
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={notifications.projectUpdates}
                  onChange={() => handleNotificationToggle('projectUpdates')}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Delivery Channels</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Email Notifications</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications.emailNotifications}
                    onChange={() => handleNotificationToggle('emailNotifications')}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Slack Notifications</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications.slackNotifications}
                    onChange={() => handleNotificationToggle('slackNotifications')}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Workflow Settings"
        description="Configure default workflows and automation rules"
      >
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Default Task Status
            </label>
            <select
              value={workflow.defaultTaskStatus}
              onChange={(e) => handleWorkflowChange('defaultTaskStatus', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              New tasks will be created with this status by default
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Default Assignee
            </label>
            <select
              value={workflow.defaultAssignee}
              onChange={(e) => handleWorkflowChange('defaultAssignee', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="unassigned">Unassigned</option>
              <option value="creator">Task Creator</option>
              <option value="project_owner">Project Owner</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Require Approval</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tasks must be approved before marking as complete
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={workflow.requireApproval}
                onChange={(e) => handleWorkflowChange('requireApproval', e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-start space-x-3">
                <Archive className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Auto-Archive Projects</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically archive inactive projects
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={workflow.autoArchive}
                  onChange={(e) => handleWorkflowChange('autoArchive', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {workflow.autoArchive && (
              <div className="ml-8 pt-3 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Archive after (days)
                </label>
                <input
                  type="number"
                  value={workflow.archiveDays}
                  onChange={(e) => handleWorkflowChange('archiveDays', parseInt(e.target.value))}
                  min="30"
                  max="365"
                  className="w-32 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Settings Management"
        description="Import or export workspace settings as templates"
      >
        <div className="space-y-4">
          <div className="p-4 bg-muted border border-border rounded-lg">
            <div className="flex items-start space-x-3 mb-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Settings Templates</p>
                <p>
                  Export your current workspace settings to share with other workspaces or use as a template.
                  Settings include notification preferences, workflow configurations, and default values.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleExportSettings}
                disabled={exporting}
                className="flex items-center px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                {exporting ? 'Exporting...' : 'Export Settings'}
              </button>

              <label className="flex items-center px-4 py-2 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? 'Importing...' : 'Import Settings'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  disabled={importing}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg shadow-light-blue-sm hover:bg-primary/90 transition-colors"
        >
          Save All Settings
        </button>
      </div>
    </div>
  );
};
