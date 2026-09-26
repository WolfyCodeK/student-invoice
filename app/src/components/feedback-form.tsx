import { useState } from "react";
import emailjs from "@emailjs/browser";
import { Loader2, Send } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { DialogActions } from "./ui/dialog";

// EmailJS IDs are public by design; v1.0.1 uses the same service and template.
const SERVICE_ID = "service_t490keb";
const TEMPLATE_ID = "template_nt9cu4m";
const PUBLIC_KEY = "ePN0HZnXELUkautE6";
const MAX = 5000;

// The in-app feedback form, inside the feedback dialog. Sends through EmailJS.
// Loaded on demand so EmailJS isn't in the start-up bundle.
export function FeedbackForm({ onClose }: { onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const send = async () => {
    if (!feedback.trim()) {
      setError("Write a few words first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      // The recipient is fixed in the EmailJS template, not sent from here
      // (docs/security.md).
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        { from_name: "Student Invoice App User", message: feedback, app_info: "Sent from Student Invoice App" },
        PUBLIC_KEY,
      );
      toast({ title: "Feedback sent", description: "Thank you." });
      onClose();
    } catch {
      setError("It couldn't be sent. Check the internet connection and try again, or email isaack2wolf@gmail.com.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <label htmlFor="feedback" className="visually-hidden">
        Your feedback
      </label>
      <textarea
        id="feedback"
        className="field"
        rows={7}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        maxLength={MAX}
        placeholder="Something that didn't work, something you'd like, or anything else."
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "feedback-error" : undefined}
      />
      {error && (
        <p className="field-error" id="feedback-error" role="alert">
          {error}
        </p>
      )}
      <DialogActions>
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" onClick={() => void send()} disabled={sending}>
          {sending ? <Loader2 className="spin" /> : <Send />} {sending ? "Sending…" : "Send feedback"}
        </button>
      </DialogActions>
    </>
  );
}
