export type ToastArgs = { title?: string; description?: string; variant?: string };
export function useToast() { return { toast: (_args: ToastArgs) => {}, dismiss: (_id?: string) => {}, toasts: [] as ToastArgs[] }; }
