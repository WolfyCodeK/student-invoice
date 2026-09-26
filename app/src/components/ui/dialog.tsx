// Dialogs: Radix Dialog (focus trap, Escape, screen-reader labelling) styled
// by styles/base.css (.dlg-*).
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { wide?: boolean }
>(({ className, wide, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dlg-overlay" />
    <DialogPrimitive.Content ref={ref} className={["dlg", wide ? "dlg--wide" : "", className ?? ""].join(" ").trim()} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={`dlg-title ${className ?? ""}`.trim()} {...props} />);
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={`dlg-desc ${className ?? ""}`.trim()} {...props} />);
DialogDescription.displayName = "DialogDescription";

export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="dlg-actions">{children}</div>;
}
