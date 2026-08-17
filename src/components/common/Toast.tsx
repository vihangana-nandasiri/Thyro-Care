import { Toaster } from "sonner";

/**
 * Toast foundation using existing `sonner` dependency.
 * Accessible live region is provided by Sonner.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "rounded-xl border border-border shadow-md",
        },
      }}
    />
  );
}
