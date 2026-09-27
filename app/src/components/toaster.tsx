// Shows the current toast (hooks/use-toast.ts). Rendered once, last in App,
// so only this re-renders when a toast appears.
import { closeToast, useCurrentToast } from "../hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./ui/toast";

export function Toaster() {
  const toast = useCurrentToast();
  return (
    <ToastProvider>
      {toast && (
        <Toast
          key={toast.id}
          open={toast.open}
          onOpenChange={(open) => {
            if (!open) closeToast(toast.id);
          }}
          variant={toast.variant}
          duration={toast.duration}
        >
          {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
          {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          <ToastClose />
        </Toast>
      )}
      <ToastViewport />
    </ToastProvider>
  );
}
