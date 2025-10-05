import React, { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { useAppStore } from "../stores/app-store";
import { AppSettings } from "../types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings, templates } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  // Update local settings when dialog opens
  React.useEffect(() => {
    if (open) {
      setLocalSettings(settings);
    }
  }, [open, settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onOpenChange(false);
  };

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
          <DialogDescription>
            Configure your application preferences and integrations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Appearance */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Appearance</h3>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={localSettings.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') =>
                  updateSetting('theme', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Display notifications for actions and errors
                </p>
              </div>
              <Switch
                checked={localSettings.showNotifications}
                onCheckedChange={(checked) => updateSetting('showNotifications', checked)}
              />
            </div>
          </div>

          {/* Email & Templates */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Email & Templates</h3>

            <div className="space-y-2">
              <Label htmlFor="email-mode">Email Mode</Label>
              <Select
                value={localSettings.emailMode}
                onValueChange={(value: 'clipboard' | 'gmail-draft') =>
                  updateSetting('emailMode', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select email mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clipboard">Copy to Clipboard</SelectItem>
                  <SelectItem value="gmail-draft">Create Gmail Draft</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose how invoices are shared: copied to clipboard or created as Gmail drafts
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-template">Default Template</Label>
              <Select
                value={localSettings.defaultTemplateId || "none"}
                onValueChange={(value) =>
                  updateSetting('defaultTemplateId', value === "none" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.recipient} - {template.instrument}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Automatically select this template when the app starts
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-save Templates</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically save template changes
                </p>
              </div>
              <Switch
                checked={localSettings.autoSave}
                onCheckedChange={(checked) => updateSetting('autoSave', checked)}
              />
            </div>
          </div>

          {/* Gmail Integration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Gmail Integration</h3>
            <p className="text-sm text-muted-foreground">
              Configure your Google API credentials. These can also be set as environment variables:
              GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
            </p>

            <div className="space-y-2">
              <Label htmlFor="gmail-client-id">Client ID</Label>
              <input
                id="gmail-client-id"
                type="password"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={localSettings.gmailClientId || ""}
                onChange={(e) => updateSetting('gmailClientId', e.target.value)}
                placeholder="Enter your Google Client ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gmail-client-secret">Client Secret</Label>
              <input
                id="gmail-client-secret"
                type="password"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={localSettings.gmailClientSecret || ""}
                onChange={(e) => updateSetting('gmailClientSecret', e.target.value)}
                placeholder="Enter your Google Client Secret"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
