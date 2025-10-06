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
import { useAppStore } from "./stores/app-store";
import { useToast } from "./hooks/use-toast";
import { InvoiceTemplate } from "./types";
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
    showGmailAuthDialog,
    connectGmail,
    disconnectGmail,
    hideGmailAuthDialog,
    createCurrentInvoiceDraft,
    createAllInvoiceDrafts,
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
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{available: boolean, version?: string, body?: string} | null>(null);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);

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

  const handleCreateAllDrafts = async () => {
    try {
      const result = await createAllInvoiceDrafts();
      if (result.failed === 0) {
        toast({
          title: "Success",
          description: `Created ${result.success} email drafts successfully!`,
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Created ${result.success} drafts, ${result.failed} failed. Check console for details.`,
          variant: "destructive",
        });
        console.error("Draft creation errors:", result.errors);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create drafts. Please check your Gmail connection and ensure you have templates.",
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
      setHasUpdateAvailable(result.available);
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
                          disabled={!currentTemplate || !gmailConnected}
                          onClick={handleCreateDraft}
                          className="h-9"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Draft Email
                        </Button>
                        <Button 
                          variant="secondary" 
                          disabled={!gmailConnected || templates.length === 0} 
                          onClick={handleCreateAllDrafts}
                          className="h-9"
                        >
                          <Users className="h-4 w-4 mr-1" />
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
                        <Button onClick={connectGmail} className="w-full h-9">
                          Connect Gmail
                        </Button>
                      ) : (
                        <Button onClick={disconnectGmail} variant="outline" className="w-full h-9">
                          Disconnect Gmail
                        </Button>
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
                        <p className="text-sm">Select a template to preview the invoice</p>
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

      console.log('EmailJS Debug:', {
        SERVICE_ID,
        TEMPLATE_ID,
        PUBLIC_KEY,
        templateParams
      });

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

      toast({
        title: "Feedback Sent Successfully!",
        description: "Thank you for your feedback!",
        variant: "default",
      });

      onClose();
    } catch (error) {
      console.error('EmailJS error:', error);
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
