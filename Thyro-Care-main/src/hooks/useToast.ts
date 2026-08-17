import { toast } from "sonner";

export type ToastTone = "success" | "error" | "warning" | "info";

export function useToast() {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    warning: (message: string) => toast.warning(message),
    info: (message: string) => toast.message(message),
    dismiss: toast.dismiss,
  };
}

export { toast };
