import React, { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertTriangle, Info, Settings, Mail, Palette, Calendar } from "lucide-react";
import { useAppStore, getTermsForAcademicYear } from "../stores/app-store";
import { AppSettings, InvoiceTemplate, TermData } from "../types";
import { getDefaultTemplateString } from "../utils/invoice-generator";
import { errorMessage } from "../lib/backend";
import { format } from "date-fns";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings, templates, currentTemplateId, currentTerm } = useAppStore();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [emailBodyDialogOpen, setEmailBodyDialogOpen] = useState(false);

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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <DialogHeader className="pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Application Settings</DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400 mt-1">
                Configure your application preferences and integrations.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Application */}
          <div className="space-y-4 bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Palette className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Application</h3>
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

            <div className="space-y-2">
              <Label>Email Body Template</Label>
              <p className="text-sm text-muted-foreground">
                Customize the email body template used for invoices
              </p>
              <Button
                variant="outline"
                onClick={() => setEmailBodyDialogOpen(true)}
                className="w-full border-purple-200 hover:border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:border-purple-600 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300"
              >
                Edit Body Template
              </Button>
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
          </div>

          <GmailSettingsSection />

          {/* Term Dates */}
          <TermDatesSection />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="px-6 py-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Email Body Template Editor Dialog */}
    <EmailBodyEditorDialog
      open={emailBodyDialogOpen}
      onOpenChange={setEmailBodyDialogOpen}
      template={localSettings.customEmailBodyTemplate}
      currentTemplate={currentTemplateId ? templates.find(t => t.id === currentTemplateId) : undefined}
      currentTerm={currentTerm}
      onSave={(template) => updateSetting('customEmailBodyTemplate', template)}
    />
    </>
  );
}

// Email Body Template Editor Dialog
interface EmailBodyEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: string;
  currentTemplate?: InvoiceTemplate;
  currentTerm?: TermData | null;
  onSave: (template: string | undefined) => void;
}

// Gmail connection status plus an optional, advanced "use my own Google
// OAuth client" override (stored in Windows Credential Manager by Rust,
// never in app settings). See docs/gmail.md.
function GmailSettingsSection() {
  const { gmail, setCustomGmailClient, clearCustomGmailClient } = useAppStore();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setClientId("");
      setClientSecret("");
      setMessage({ ok: true, text: success });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const statusText = !gmail
    ? "Checking…"
    : gmail.connected
      ? `Connected${gmail.email ? ` as ${gmail.email}` : ""}.`
      : gmail.configured
        ? "Not connected. Use Connect Gmail on the main screen."
        : "Gmail isn't set up in this copy of the app. You can add your own Google OAuth client below.";

  return (
    <div className="space-y-4 bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Gmail</h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{statusText}</p>

      <details className="text-sm">
        <summary className="cursor-pointer select-none text-slate-700 dark:text-slate-300">
          Advanced: use your own Google OAuth client
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">
            {gmail?.clientSource === "custom"
              ? "This app is using your own OAuth client."
              : "Only needed if you run your own Google Cloud project. Changing it disconnects Gmail."}
          </p>
          <div className="space-y-2">
            <Label htmlFor="gmail-client-id">Client ID</Label>
            <input
              id="gmail-client-id"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="….apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmail-client-secret">Client secret</Label>
            <input
              id="gmail-client-secret"
              type="password"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || !clientId.trim() || !clientSecret.trim()}
              onClick={() => run(() => setCustomGmailClient(clientId, clientSecret), "Saved. Connect Gmail again to use it.")}
            >
              Use this client
            </Button>
            {gmail?.clientSource === "custom" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => clearCustomGmailClient(), "Switched back to the built-in client. Connect Gmail again.")}
              >
                Use the built-in client
              </Button>
            )}
          </div>
          {message && (
            <p className={message.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"} role="status">
              {message.text}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

function TermDatesSection() {
  const { currentTerm } = useAppStore();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Determine which academic year we're in
  // If we're in Jan-Aug, the academic year started last year; if Sep-Dec, it started this year
  const academicYearStart = now.getMonth() >= 8 ? currentYear : currentYear - 1;
  const terms = getTermsForAcademicYear(academicYearStart);

  const seasonLabels: Record<string, string> = {
    'autumn': 'Autumn',
    'spring': 'Spring',
    'summer': 'Summer',
  };

  const seasonColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    'autumn': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700', dot: 'bg-amber-500' },
    'spring': { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700', dot: 'bg-green-500' },
    'summer': { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-700', dot: 'bg-sky-500' },
  };

  const isCurrentTerm = (term: { half: string; season: string }) => {
    return currentTerm?.term.half === term.half && currentTerm?.term.season === term.season;
  };

  return (
    <div className="space-y-4 bg-white dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-indigo-800 dark:text-indigo-200">Term Dates</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Academic Year {academicYearStart}/{academicYearStart + 1}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {terms.map((term, index) => {
          const colors = seasonColors[term.season];
          const isCurrent = isCurrentTerm(term);
          return (
            <div
              key={index}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
                isCurrent
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-800'
                  : `${colors.bg} ${colors.border}`
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-indigo-500 animate-pulse' : colors.dot}`} />
                <span className={`text-sm font-medium ${isCurrent ? 'text-indigo-700 dark:text-indigo-300' : colors.text}`}>
                  {term.half} Half {seasonLabels[term.season]}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
              </div>
              <span className={`text-sm ${isCurrent ? 'text-indigo-600 dark:text-indigo-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                {format(term.startDate, 'MMM d')} – {format(term.endDate, 'MMM d, yyyy')}
              </span>
            </div>
          );
        })}
      </div>

      {!currentTerm && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Currently outside of term time
        </p>
      )}
    </div>
  );
}

function EmailBodyEditorDialog({ open, onOpenChange, template, onSave }: EmailBodyEditorDialogProps) {
  // Get default template with variables if no custom template exists
  const getDefaultTemplatePreview = () => {
    return getDefaultTemplateString();
  };

  const defaultTemplate = getDefaultTemplatePreview();
  const [localTemplate, setLocalTemplate] = useState<string>(template || defaultTemplate || "");

  React.useEffect(() => {
    if (open) {
      const initialTemplate = template || defaultTemplate || "";
      setLocalTemplate(initialTemplate);
    }
  }, [open, template, defaultTemplate]);

  const handleSave = () => {
    const trimmed = localTemplate.trim();
    onSave(trimmed || undefined);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalTemplate(template || "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <DialogHeader className="pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit Email Body Template</DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400 mt-1">
                {template ? "Edit your custom email template." : "Create a custom email template. Currently showing the default template."} Use template variables to dynamically insert information.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertDescription>
              <strong className="text-orange-900 dark:text-orange-100">Warning:</strong> Customizing the email template affects all generated invoices.
              Only proceed if you understand the template variables and their usage.
              Incorrect templates may result in unprofessional or incorrect invoices.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="email-body-template">Email Body Template</Label>
            <Textarea
              id="email-body-template"
              className="h-[400px] font-mono text-sm resize-none overflow-visible"
              value={localTemplate}
              onChange={(e) => setLocalTemplate(e.target.value)}
              placeholder={template ? "Your custom template..." : "Edit the default template above, or leave empty to reset to default"}
            />
          </div>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription>
              <strong className="text-blue-900 dark:text-blue-100">Template Variables:</strong>
              <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{recipient}}"}</code> - Parent/guardian name</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{students}}"}</code> - Student name(s)</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{instrument}}"}</code> - Instrument being taught</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{termInfo}}"}</code> - Term information (e.g., "1st half autumn term 2024")</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{weeksCount}}"}</code> - Number of weeks</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{lessonCountText}}"}</code> - "session" or "sessions" based on count</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{dateRange}}"}</code> - Full date range of lessons</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{cost}}"}</code> - Cost per lesson (formatted)</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{totalCost}}"}</code> - Total cost (formatted)</li>
                <li><code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">{"{{isAre}}"}</code> - "is" or "are" based on lesson count</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="px-6 py-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
            >
              Save Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
