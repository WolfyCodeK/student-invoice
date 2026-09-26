import { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider } from "./components/theme-provider";
import { ThemeToggle } from "./components/theme-toggle";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { Textarea } from "./components/ui/textarea";
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from "./components/ui/toast";
import { TemplateForm } from "./components/template-form";
import { SettingsDialog } from "./components/settings-dialog";
import { Mail, Edit, Plus, Send, Copy, Users, CheckCircle, XCircle, Trash2, Settings, Loader2, Download, MessageSquare } from "lucide-react";
import { useAppStore, type DraftFailure } from "./stores/app-store";
import { useToast } from "./hooks/use-toast";
import { InvoiceTemplate } from "./types";
import { errorMessage, isBackendError, type UpdateInfo } from "./lib/backend";
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import emailjs from '@emailjs/browser';

function App() {
  const { toast, toasts } = useToast();
  const {
    templates,
    currentTemplateId,
    currentTerm,
    currentInvoice,
    settings,
    gmailConnected,
    gmail,
    gmailConnecting,
    drafting,
    connectGmail,
    cancelGmailConnect,
    disconnectGmail,
    createCurrentInvoiceDraft,
    createAllInvoiceDrafts,
    setCurrentTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    checkForUpdates,
    installUpdate
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number | null } | null>(null);
  const [draftResult, setDraftResult] = useState<{ success: number; failures: DraftFailure[]; skipped: number } | null>(null);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);

  // Loading screen effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Show loading for 800ms

    return () => clearTimeout(timer);
  }, []);

  // Download progress while an update installs.
  useEffect(() => {
    const unlisten = listen<{ downloaded: number; total: number | null }>("update://progress", (e) => {
      setUpdateProgress(e.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Get app version
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (error) {
        console.error('Failed to get app version:', error);
        // Keep default version if getVersion fails
      }
    };

    fetchVersion();
  }, []);



  const currentTemplate = templates.find(t => t.id === currentTemplateId);

  const getTermDisplay = () => {
    if (!currentTerm) return "Outside term time";
    return `${currentTerm.term.half} half ${currentTerm.term.season} term (${currentTerm.weeksCount} weeks)`;
  };

  const handleCreateDraft = async () => {
    try {
      await createCurrentInvoiceDraft();
      toast({
        title: "Draft saved",
        description: "The invoice is in your Gmail drafts, ready to review and send.",
      });
    } catch (error) {
      toast({
        title: "Couldn't create the draft",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleCreateAllDrafts = async () => {
    try {
      const result = await createAllInvoiceDrafts();
      if (result.failures.length === 0) {
        toast({
          title: "Drafts saved",
          description: `Created ${result.success} Gmail draft${result.success === 1 ? "" : "s"}.`,
        });
      } else {
        setDraftResult(result);
      }
    } catch (error) {
      toast({
        title: "Couldn't create drafts",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleConnectGmail = async () => {
    try {
      const status = await connectGmail();
      toast({
        title: "Gmail connected",
        description: status.email ? `Drafts will be saved to ${status.email}.` : "Drafts will be saved to your Gmail account.",
      });
    } catch (error) {
      if (isBackendError(error) && error.kind === "Cancelled") return;
      toast({
        title: "Gmail wasn't connected",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await disconnectGmail();
      toast({ title: "Gmail disconnected", description: "Access has been removed from this PC." });
    } catch (error) {
      toast({ title: "Couldn't disconnect Gmail", description: errorMessage(error), variant: "destructive" });
    }
  };

  const handleCopyToClipboard = async (text: string, type: 'subject' | 'body') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${type === 'subject' ? 'Subject' : 'Email body'} copied to clipboard!`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true);
    try {
      const result = await checkForUpdates();
      setUpdateInfo(result);
      setHasUpdateAvailable(result.available);
      if (result.available) {
        setUpdateDialogOpen(true);
      } else {
        toast({
          title: result.disabledInDev ? "Updates are off in development builds" : "Up to date",
          description: `You're running version ${result.currentVersion}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Couldn't check for updates",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setCheckingForUpdates(false);
    }
  };

  // Auto-check for updates on app start
  useEffect(() => {
    const checkUpdatesOnStart = async () => {
      try {
        const result = await checkForUpdates();
        setHasUpdateAvailable(result.available);
        // Don't show dialog automatically, just update the button state
      } catch (error) {
        console.error('Failed to check for updates on start:', error);
        // Don't show error toast on startup, just log it
      }
    };

    checkUpdatesOnStart();
  }, [checkForUpdates]);

  const handleInstallUpdate = async () => {
    setInstallingUpdate(true);
    setUpdateProgress(null);
    try {
      // On success the installer takes over and the app closes, so this only
      // returns if something went wrong.
      await installUpdate();
    } catch (error) {
      toast({
        title: "Update failed",
        description: errorMessage(error),
        variant: "destructive",
      });
      setInstallingUpdate(false);
      setUpdateDialogOpen(false);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateFormOpen(true);
  };



  const handleEditTemplate = () => {
    if (currentTemplate) {
      setEditingTemplate(currentTemplate);
      setTemplateFormOpen(true);
    }
  };

  const handleDeleteTemplate = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTemplate = () => {
    if (currentTemplate) {
      deleteTemplate(currentTemplate.id);
      setDeleteDialogOpen(false);
    }
  };

  const handleTemplateSubmit = (templateData: Omit<InvoiceTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, templateData);
    } else {
      addTemplate(templateData);
    }
  };

  // Show loading screen initially
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-col items-center space-y-6">
          <div className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          </div>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Student Invoice</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400">Loading application...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme={settings.theme} storageKey="student-invoice-theme">
      <ToastProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
          {/* Header */}
          <header className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 shadow-sm">
            <div className="flex h-14 items-center px-6 max-w-screen-2xl mx-auto w-full">
              <div className="flex items-center space-x-4">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Student Invoice</span>
              </div>
              <div className="ml-auto flex items-center space-x-4">
                <span className="text-sm text-slate-600 dark:text-slate-400">v{appVersion}</span>
                <ThemeToggle />
              </div>
            </div>
          </header>
  
          {/* Main Content */}
          <main className="p-4 h-[calc(100vh-4rem)]">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 h-full">
              
              {/* Left Panel - Controls & Status */}
              <div className="space-y-4 flex flex-col">
                {/* Template Selection & Actions Card */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-emerald-800 dark:text-emerald-200">Invoice Generator</span>
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-400">Generate professional invoices for music lessons</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Template</label>
                      <Select
                        value={currentTemplateId || ""}
                        onValueChange={(value) => setCurrentTemplate(value || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a student template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.recipient} - {template.instrument} Lessons
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={!currentTemplate} onClick={handleEditTemplate} className="flex-1">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNewTemplate} className="flex-1">
                        <Plus className="h-4 w-4 mr-1" />
                        New
                      </Button>
                      <Button variant="destructive" size="sm" disabled={!currentTemplate} onClick={handleDeleteTemplate} className="flex-1">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                    {currentTemplate && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2 border border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Student:</span>
                            <p className="font-medium">{currentTemplate.students}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Instrument:</span>
                            <p className="font-medium capitalize">{currentTemplate.instrument}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost:</span>
                            <p className="font-medium">£{currentTemplate.cost.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Day:</span>
                            <p className="font-medium">{currentTemplate.day}</p>
                          </div>
                        </div>
                        {currentInvoice && (
                          <div className="border-t pt-2 mt-2">
                            <div className="text-sm flex justify-between items-center">
                              <span className="text-muted-foreground">Total:</span>
                              <div>
                                <span className="font-semibold">£{currentInvoice.totalCost.toFixed(2)}</span>
                                <span className="text-muted-foreground ml-1">({currentInvoice.lessonCount} lessons)</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
  
                {/* Status & Actions Card */}
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Send className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-blue-800 dark:text-blue-200">Actions & Status</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold">{templates.length}</div>
                        <div className="text-xs text-muted-foreground">Templates</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-center">
                          {gmailConnected ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Gmail</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{currentTerm ? `${currentTerm.weeksCount}w` : "0w"}</div>
                        <div className="text-xs text-muted-foreground">Term</div>
                      </div>
                    </div>
                    <div className="text-center text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                      {getTermDisplay()}
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          disabled={!currentInvoice || !gmailConnected || drafting}
                          onClick={handleCreateDraft}
                          className="h-9"
                          title={!currentTerm ? "It's outside term time" : !gmailConnected ? "Connect Gmail first" : undefined}
                        >
                          {drafting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                          Draft Email
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={!gmailConnected || templates.length === 0 || !currentTerm || drafting}
                          onClick={handleCreateAllDrafts}
                          className="h-9"
                          title={!currentTerm ? "It's outside term time" : !gmailConnected ? "Connect Gmail first" : undefined}
                        >
                          {drafting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
                          Draft All
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!currentTemplate || !currentInvoice}
                          onClick={() => handleCopyToClipboard(currentInvoice?.subject || '', 'subject')}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Subject
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!currentTemplate || !currentInvoice}
                          onClick={() => handleCopyToClipboard(currentInvoice?.body || '', 'body')}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Body
                        </Button>
                      </div>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      {!gmailConnected ? (
                        <Button onClick={handleConnectGmail} disabled={gmailConnecting || gmail?.configured === false} className="w-full h-9">
                          {gmail?.configured === false ? "Gmail isn't set up in this copy" : "Connect Gmail"}
                        </Button>
                      ) : (
                        <>
                          {gmail?.email && (
                            <p className="text-center text-xs text-muted-foreground truncate" title={gmail.email}>
                              Connected as {gmail.email}
                            </p>
                          )}
                          <Button onClick={handleDisconnectGmail} variant="outline" className="w-full h-9">
                            Disconnect Gmail
                          </Button>
                        </>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsDialogOpen(true)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Settings
                        </Button>
                        <Button
                          variant={hasUpdateAvailable ? "default" : "outline"}
                          size="sm"
                          onClick={handleCheckForUpdates}
                          disabled={checkingForUpdates}
                          className={
                            hasUpdateAvailable 
                              ? "bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700" 
                              : "opacity-60 hover:opacity-80"
                          }
                        >
                          {checkingForUpdates ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          Updates
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
  
              {/* Right Panel - Email Preview */}
              <div className="flex flex-col h-full">
                <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col">
                <CardHeader className="flex-shrink-0 pb-3">
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-purple-800 dark:text-purple-200">Email Preview</span>
                  </CardTitle>
                  {currentInvoice && (
                    <CardDescription className="truncate">
                      {currentInvoice.subject}
                    </CardDescription>
                  )}
                </CardHeader>
                {/* <-- CHANGED: CardContent takes up the remaining space and contains its children */}
                <CardContent className="flex-1 p-3 overflow-y-auto"> 
                  {currentInvoice ? (
                    // The extra div wrapper is removed for simplicity.
                    // The <pre> tag will now scroll within the CardContent.
                    <pre className="h-full font-mono text-sm leading-relaxed bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700 whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                      {currentInvoice.body}
                    </pre>
                  ) : (
                    // <-- CHANGED: Removed fixed height, uses flexbox to center content.
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium mb-2">No Preview Available</p>
                        <p className="text-sm">
                          {!currentTemplate
                            ? "Select a template to preview the invoice"
                            : "It's outside term time, so there's no invoice to show"}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
                </Card>

                {/* Feedback Section - Fixed at bottom */}
                <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-center space-y-2 mb-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Found a bug? Want a new feature? Have quality of life suggestions?
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      Your feedback helps improve the Student Invoice app!
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setFeedbackDialogOpen(true)}
                    className="w-full border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Feedback
                  </Button>
                </div>
              </div>
            </div>
          </main>
  
          {/* Dialogs and Toasts (No changes here) */}
          <TemplateForm
            open={templateFormOpen}
            onOpenChange={setTemplateFormOpen}
            template={editingTemplate}
            onSubmit={handleTemplateSubmit}
          />
          <Dialog open={gmailConnecting} onOpenChange={(open) => {
            if (!open) void cancelGmailConnect();
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Gmail</DialogTitle>
                <DialogDescription>
                  Finish signing in in the browser window that just opened.
                </DialogDescription>
              </DialogHeader>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                <li>Choose the Google account to save drafts to.</li>
                <li>If Google says the app isn't verified, choose Advanced, then continue.</li>
                <li>Allow Student Invoice to manage drafts.</li>
              </ol>
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for you to finish in the browser…
                </p>
                <Button variant="outline" onClick={() => void cancelGmailConnect()}>
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={draftResult !== null} onOpenChange={(open) => { if (!open) setDraftResult(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{draftResult && draftResult.success > 0 ? "Some drafts weren't created" : "No drafts were created"}</DialogTitle>
                <DialogDescription>
                  {draftResult && `Created ${draftResult.success}, failed ${draftResult.failures.length}${draftResult.skipped ? `, not attempted ${draftResult.skipped}` : ""}.`}
                </DialogDescription>
              </DialogHeader>
              <ul className="max-h-64 overflow-y-auto space-y-2 text-sm">
                {draftResult?.failures.map((f, i) => (
                  <li key={i} className="rounded-md border p-2">
                    <p className="font-medium break-words">{f.label}</p>
                    <p className="text-muted-foreground break-words">{f.message}</p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button onClick={() => setDraftResult(null)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
          <SettingsDialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
          />
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Template</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the template for{" "}
                  <strong>{currentTemplate?.recipient}</strong>? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDeleteTemplate}>
                  Delete Template
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={updateDialogOpen} onOpenChange={(open) => { if (!installingUpdate) setUpdateDialogOpen(open); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Software Update</DialogTitle>
                <DialogDescription>
                  {updateInfo?.available ? (
                    `A new version (${updateInfo.version}) is available!`
                  ) : (
                    "You are running the latest version."
                  )}
                </DialogDescription>
                {updateInfo?.available && updateInfo.notes && (
                  <div className="mt-2 p-3 bg-muted rounded-md">
                    <p className="text-sm">{updateInfo.notes}</p>
                  </div>
                )}
                {installingUpdate && (
                  <p className="text-sm text-muted-foreground">
                    {updateProgress?.total
                      ? `Downloading… ${Math.round((updateProgress.downloaded / updateProgress.total) * 100)}%`
                      : "Downloading…"}{" "}
                    The app will close and the installer will finish the update.
                  </p>
                )}
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={installingUpdate} onClick={() => setUpdateDialogOpen(false)}>
                  {updateInfo?.available ? "Not now" : "Close"}
                </Button>
                {updateInfo?.available && (
                  <Button
                    onClick={handleInstallUpdate}
                    disabled={installingUpdate}
                  >
                    {installingUpdate ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      "Install Update"
                    )}
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Feedback Dialog */}
          <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Send Feedback
                </DialogTitle>
                <DialogDescription>
                  Help improve the Student Invoice app! Your feedback is valuable.
                </DialogDescription>
              </DialogHeader>

              <FeedbackForm onClose={() => setFeedbackDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
        <ToastViewport>
          {toasts.map(({ id, title, description, action, ...props }) => (
            <Toast key={id} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
              {action}
              <ToastClose />
            </Toast>
          ))}
        </ToastViewport>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Feedback Form Component
function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // EmailJS configuration - Replace these with your actual values from emailjs.com
  const SERVICE_ID = 'service_t490keb'; // Your Gmail service ID
  const TEMPLATE_ID = 'template_nt9cu4m'; // Create a template in EmailJS
  const PUBLIC_KEY = 'ePN0HZnXELUkautE6'; // Get from EmailJS dashboard

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please enter your feedback before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Send feedback directly to isaack2wolf@gmail.com
      const templateParams = {
        to_email: 'isaack2wolf@gmail.com',
        from_name: 'Student Invoice App User',
        message: feedback,
        app_info: 'Sent from Student Invoice App'
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

      toast({
        title: "Feedback Sent Successfully!",
        description: "Thank you for your feedback!",
        variant: "default",
      });

      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to send feedback. Please email isaack2wolf@gmail.com directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Feedback *</label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={5000}
          className="min-h-[150px] resize-none"
          placeholder="Tell us what you think about the app, any issues you've encountered, or suggestions for improvement..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Feedback
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default App;
