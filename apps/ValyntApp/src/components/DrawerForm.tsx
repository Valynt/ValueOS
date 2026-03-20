// /workspaces/ValueOS/apps/ValyntApp/src/components/DrawerForm.tsx
import { X } from "lucide-react";
import React, { useEffect, useRef } from "react";

interface DrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const DrawerForm: React.FC<DrawerFormProps> = ({ isOpen, onClose, title, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const focusFirstFocusable = (element: HTMLElement) => {
    const focusableSelectors = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';
    const firstFocusable = element.querySelector(focusableSelectors);
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      setTimeout(() => focusFirstFocusable(containerRef.current!), 100);
    }
  }, [isOpen]);

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "block" : "hidden"}`}>
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div
        className={`absolute right-0 top-0 h-full w-96 bg-card shadow-lg transform transition-transform ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div ref={containerRef} className="p-4 overflow-auto h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DrawerForm;
