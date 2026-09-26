import { useState } from "react";
import emailjs from "@emailjs/browser";
import { Loader2, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useToast } from "../hooks/use-toast";

// The in-app feedback form. Sends through EmailJS (the public IDs below are
// meant to be public). Loaded on demand so EmailJS isn't in the start-up bundle.
export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // EmailJS IDs are public by design; v1.0.1 uses the same service and template.
  const SERVICE_ID = 'service_t490keb';
  const TEMPLATE_ID = 'template_nt9cu4m';
  const PUBLIC_KEY = 'ePN0HZnXELUkautE6';

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
      // The recipient is fixed in the EmailJS template, not sent from here
      // (docs/security.md).
      const templateParams = {
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
