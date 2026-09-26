// "What's new", shown once after an update (docs/ui.md). A short letter from
// the app: its name and version, then one line per change.
import { useId } from "react";
import { CalendarX, HardDriveDownload, LayoutList, MailCheck, Palette, type LucideIcon } from "lucide-react";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "../../components/ui/dialog";
import appIcon from "../../assets/app-icon.svg";
import type { NewsIcon, WhatsNewEntry } from "./whats-new";
import { YourNameField } from "../your-name/your-name-field";
import { useNeedsYourName } from "../your-name/use-your-name";

const ICONS: Record<NewsIcon, LucideIcon> = {
  "layout-list": LayoutList,
  "calendar-x": CalendarX,
  palette: Palette,
  "hard-drive-download": HardDriveDownload,
  "mail-check": MailCheck,
};

export interface WhatsNewDialogProps {
  open: boolean;
  /** Oldest first, as decideOnboarding returns them. */
  entries: WhatsNewEntry[];
  /** The guided tour starts when this closes. */
  hasTourNext: boolean;
  onClose: () => void;
}

export function WhatsNewDialog({ open, entries, hasTourNext, onClose }: WhatsNewDialogProps) {
  const listId = useId();
  // Emails are now signed with Your name: ask for it here, once, if it's missing.
  const needName = useNeedsYourName();
  const newest = entries.length > 0 ? entries[entries.length - 1].version : null;
  // Newest changes first; one plain list, no per-version headings.
  const items = [...entries].reverse().flatMap((entry) => entry.items.map((item, i) => ({ ...item, key: `${entry.version}-${i}` })));

  return (
    <Dialog
      open={open && newest !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="letter"
        aria-describedby={listId}
        // Shown only once, so a stray click outside must not dismiss it unread.
        onInteractOutside={(event) => event.preventDefault()}
        // The tour takes focus next; don't hand it back to the page first.
        onCloseAutoFocus={(event) => {
          if (hasTourNext) event.preventDefault();
        }}
      >
        <div className="letter-head">
          <img src={appIcon} alt="" width={36} height={36} />
          <div>
            <strong>Student Invoice</strong>
            <span>Version {newest}</span>
          </div>
        </div>
        <DialogTitle>What's new</DialogTitle>
        <ul className="news" id={listId}>
          {items.map(({ icon, text, key }) => {
            const Icon = ICONS[icon];
            return (
              <li key={key}>
                <Icon aria-hidden="true" />
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
        {needName && (
          <div className="name-needed">
            <p>
              <strong>Your emails now end with your name.</strong> Type it once and every email uses it.
            </p>
            <YourNameField />
          </div>
        )}
        <DialogActions>
          <button type="button" className="btn btn--primary btn--lg" onClick={onClose}>
            {hasTourNext ? "Show me around" : "Got it"}
          </button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
