import { AlertTriangle, CheckCircle } from "lucide-react";

interface ConfirmationDialogProps {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  message,
  title = "Confirm Action",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <div className="bg-neutral-900/80 backdrop-blur-xl rounded-xl border border-white/10 p-6 max-w-md">
      <div className="flex items-start gap-4">
        {variant === "danger" ? (
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCancel} className="btn btn-outline h-9 px-4 text-sm">
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`btn h-9 px-4 text-sm ${variant === "danger" ? "btn-danger" : "btn-primary"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

export default ConfirmationDialog;
