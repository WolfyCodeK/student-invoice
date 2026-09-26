// Toasts: Radix Toast styled by styles/base.css (.toast-*). Shown through
// hooks/use-toast.ts; one at a time, closing after Radix's 5 seconds.
import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { X } from "lucide-react";

export const ToastProvider = ToastPrimitives.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>((props, ref) => <ToastPrimitives.Viewport ref={ref} className="toast-viewport" {...props} />);
ToastViewport.displayName = "ToastViewport";

type ToastRootProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
  variant?: "default" | "destructive";
};

export const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastRootProps>(
  ({ variant, className, ...props }, ref) => (
    <ToastPrimitives.Root
      ref={ref}
      className={["toast", variant === "destructive" ? "toast--error" : "", className ?? ""].join(" ").trim()}
      {...props}
    />
  ),
);
Toast.displayName = "Toast";

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>((props, ref) => <ToastPrimitives.Title ref={ref} className="toast-title" {...props} />);
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>((props, ref) => <ToastPrimitives.Description ref={ref} className="toast-desc" {...props} />);
ToastDescription.displayName = "ToastDescription";

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>((props, ref) => (
  <ToastPrimitives.Close ref={ref} className="toast-close" aria-label="Close" {...props}>
    <X />
  </ToastPrimitives.Close>
));
ToastClose.displayName = "ToastClose";

export type ToastProps = ToastRootProps;
