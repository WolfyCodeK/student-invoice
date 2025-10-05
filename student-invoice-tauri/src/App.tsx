import { useEffect, useState } from "react";
import "./App.css";
import { ThemeProvider } from "./components/theme-provider";
import { ThemeToggle } from "./components/theme-toggle";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from "./components/ui/toast";
import { TemplateForm } from "./components/template-form";
import { SettingsDialog } from "./components/settings-dialog";
import { Mail, Edit, Plus, Send, Copy, Users, CheckCircle, XCircle, Trash2, Settings, Loader2, Download } from "lucide-react";
import { useAppStore } from "./stores/app-store";
import { useToast } from "./hooks/use-toast";
import { InvoiceTemplate } from "./types";
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';

function App() {
  const { toast, toasts } = useToast();
  const {
    templates,
    currentTemplateId,
    currentTerm,
    currentInvoice,
    settings,
    gmailConnected,
    showGmailAuthDialog,
    connectGmail,
    disconnectGmail,
    hideGmailAuthDialog,
    createCurrentInvoiceDraft,
    setCurrentTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    updateGmailStatus,
    generateCurrentInvoice,
    checkForUpdates,
    installUpdate
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{available: boolean, version?: string, body?: string} | null>(null);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');

  // Loading screen effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Show loading for 800ms

    return () => clearTimeout(timer);
  }, []);

  // Listen for OAuth success events
  useEffect(() => {
    const unlisten = listen('oauth_success', () => {
      console.log('OAuth authentication successful!');
      // Update Gmail status and close dialog
      updateGmailStatus();
      hideGmailAuthDialog();
      toast({
        title: "Success",
        description: "Gmail connected successfully!",
      });
    });

    return () => {
      unlisten.then(f => f());
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


  // Add some sample templates on first load
  useEffect(() => {
    if (templates.length === 0) {
      addTemplate({
        recipient: "John Doe",
        cost: 25,
        instrument: "piano",
        day: "Monday",
        students: "Emma Doe"
      });
      addTemplate({
        recipient: "Jane Smith",
        cost: 30,
        instrument: "guitar",
        day: "Wednesday",
        students: "Michael Smith"
      });
      addTemplate({
        recipient: "Bob Johnson",
        cost: 28,
        instrument: "vocal",
        day: "Tuesday",
        students: "Sarah Johnson"
      });
    }
  }, [templates.length, addTemplate]);

  // Generate invoice when template or term changes
  useEffect(() => {
    if (currentTemplateId && currentTerm) {
      generateCurrentInvoice();
    }
  }, [currentTemplateId, currentTerm, generateCurrentInvoice]);

  const currentTemplate = templates.find(t => t.id === currentTemplateId);

  const getTermDisplay = () => {
    if (!currentTerm) return "Outside term time";
    return `${currentTerm.term.half} half ${currentTerm.term.season} term (${currentTerm.weeksCount} weeks)`;
  };

  const handleCreateDraft = async () => {
    try {
      await createCurrentInvoiceDraft();
      toast({
        title: "Success",
        description: "Email draft created successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create draft. Please check your Gmail connection.",
        variant: "destructive",
      });
    }
  };

  const handleCopyToClipboard = async (text: string, type: 'subject' | 'body') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${type === 'subject' ? 'Subject' : 'Email body'} copied to clipboard!`,
      });
    } catch (error) {
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
      setUpdateDialogOpen(true);

      if (!result.available) {
        toast({
          title: "Up to date",
          description: "You're running the latest version!",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check for updates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckingForUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    setInstallingUpdate(true);
    try {
      await installUpdate();
      toast({
        title: "Update installed",
        description: "The app will restart to apply the update.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Update installation error:', errorMessage);
      
      toast({
        title: "Update failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
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
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#3b82f6' }} />
          <div className="text-center">
            <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>Student Invoice</h2>
            <p className="text-sm" style={{ color: '#64748b' }}>Loading application...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultTheme={settings.theme} storageKey="student-invoice-theme">
      <ToastProvider>
        <div className="h-screen flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-6">
            <div className="flex items-center space-x-4">
              <Mail className="h-6 w-6" />
              <span className="font-bold text-lg">Student Invoice</span>
            </div>
            <div className="ml-auto flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">v{appVersion}</span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full grid grid-cols-3 gap-6 p-6">
            {/* Main Invoice Card - Takes up 2 columns */}
            <div className="col-span-2 flex flex-col">
              <Card className="flex-1 flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Invoice Generator
                  </CardTitle>
                  <CardDescription>
                    Generate professional invoices for music lessons with automatic term calculations
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-6">
                  {/* Template Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Select Template
                    </label>
                    <Select
                      value={currentTemplateId || ""}
                      onValueChange={(value) => setCurrentTemplate(value || null)}
                    >
                      <SelectTrigger className="w-full">
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

                  {/* Template Actions */}
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" className="flex items-center gap-2" disabled={!currentTemplate} onClick={handleEditTemplate}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2" onClick={handleNewTemplate}>
                      <Plus className="h-4 w-4" />
                      New
                    </Button>
                    <Button variant="destructive" className="flex items-center gap-2" disabled={!currentTemplate} onClick={handleDeleteTemplate}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  {/* Current Template Info */}
                  {currentTemplate && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Current Template</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Student:</span>
                          <span className="ml-2">{currentTemplate.students}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Instrument:</span>
                          <span className="ml-2 capitalize">{currentTemplate.instrument}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="ml-2">£{currentTemplate.cost}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Day:</span>
                          <span className="ml-2">{currentTemplate.day}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generated Invoice Preview */}
                  {currentInvoice && (
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="text-sm font-medium mb-3">Invoice Preview</h4>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-muted-foreground">Subject:</span>
                          <p className="text-sm mt-1 font-medium">{currentInvoice.subject}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Total: £{currentInvoice.totalCost.toFixed(2)} ({currentInvoice.lessonCount} lessons)</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Body Preview:</span>
                          <pre className="text-xs mt-1 bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {currentInvoice.body}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Actions */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Email Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        className="flex items-center gap-2"
                        disabled={!currentTemplate || !gmailConnected}
                        onClick={handleCreateDraft}
                      >
                        <Send className="h-4 w-4" />
                        Draft Email
                      </Button>
                      <Button variant="secondary" className="flex items-center gap-2" disabled={!gmailConnected}>
                        <Users className="h-4 w-4" />
                        Draft All
                      </Button>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        disabled={!currentTemplate || !currentInvoice}
                         onClick={() => handleCopyToClipboard(currentInvoice?.subject || '', 'subject')}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Subject
                      </Button>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                        disabled={!currentTemplate || !currentInvoice}
                         onClick={() => handleCopyToClipboard(currentInvoice?.body || '', 'body')}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Body
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Panel - Takes up 1 column */}
            <div className="flex flex-col space-y-6">
              {/* Status Card */}
              <Card className="flex-shrink-0">
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Current application status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Templates</span>
                      <span className="text-sm text-muted-foreground">{templates.length} loaded</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Gmail Status</span>
                      <div className="flex items-center gap-1">
                        {gmailConnected ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600">Connected</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-muted-foreground">Not connected</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Current Term</span>
                      <span className="text-sm text-muted-foreground">{getTermDisplay()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gmail & Settings Card */}
              <Card className="flex-shrink-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Gmail & Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    {gmailConnected ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Gmail Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span>Gmail Not Connected</span>
                      </>
                    )}
                  </div>
                  {!gmailConnected ? (
                    <Button onClick={connectGmail} className="w-full">
                      Connect Gmail
                    </Button>
                  ) : (
                    <Button onClick={disconnectGmail} variant="outline" className="w-full">
                      Disconnect Gmail
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setSettingsDialogOpen(true)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCheckForUpdates}
                    disabled={checkingForUpdates}
                  >
                    {checkingForUpdates ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {checkingForUpdates ? "Checking..." : "Check for Updates"}
                  </Button>
                </CardContent>
              </Card>

              {/* Spacer to push content to top */}
              <div className="flex-1"></div>
            </div>
      </div>
        </main>

        {/* Template Form Dialog */}
        <TemplateForm
          open={templateFormOpen}
          onOpenChange={setTemplateFormOpen}
          template={editingTemplate}
          onSubmit={handleTemplateSubmit}
        />

      {/* Gmail Auth Code Dialog */}
      <Dialog open={showGmailAuthDialog} onOpenChange={(open) => {
        if (!open) hideGmailAuthDialog();
      }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Gmail Account</DialogTitle>
              <DialogDescription>
                Complete Gmail authentication in your browser. The app will automatically handle the rest.

                1. Sign in to your Google account if prompted
                2. Grant the requested Gmail permissions
                3. The authentication will complete automatically

                You can close this dialog - authentication happens in the background.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Waiting for authentication to complete...
              </p>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => hideGmailAuthDialog()}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog */}
        <SettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
        />

        {/* Delete Confirmation Dialog */}
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

        {/* Update Dialog */}
        <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
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
              {updateInfo?.available && updateInfo.body && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="text-sm">{updateInfo.body}</p>
                </div>
              )}
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
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

export default App;
