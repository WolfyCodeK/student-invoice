// The toast store: one toast at a time, a newer one replacing it. Anything can
// call `toast()`; components/toaster.tsx shows it, and Radix closes it after
// 5 seconds (or the toast's own duration) or when it is dismissed
// (docs/ui.md "Toasts").
import { useSyncExternalStore, type ReactNode } from "react";
import type { ToastProps } from "../components/ui/toast";

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastProps["variant"];
  /** How long it shows, in milliseconds (5 seconds if not given; Infinity until closed). */
  duration?: number;
}

export interface ShownToast extends ToastOptions {
  id: number;
  open: boolean;
}

let current: ShownToast | null = null;
let lastId = 0;
const listeners = new Set<() => void>();

function show(next: ShownToast) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function toast(options: ToastOptions): void {
  show({ ...options, id: ++lastId, open: true });
}

/** Marks the toast closed (it stays until the next one, so Radix can animate it out). */
export function closeToast(id: number): void {
  if (current?.id === id) show({ ...current, open: false });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCurrentToast(): ShownToast | null {
  return useSyncExternalStore(subscribe, () => current);
}
