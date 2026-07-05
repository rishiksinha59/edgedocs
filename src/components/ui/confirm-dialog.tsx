"use client";

import { useEffect, useRef } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isLoading]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target as Node) && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        {/* Close Button */}
        {!isLoading && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 h-7 w-7 rounded-md cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            {variant === "destructive" && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
            <div className="space-y-1">
              <h3 id="confirm-dialog-title" className="text-base font-semibold leading-none">
                {title}
              </h3>
              <p id="confirm-dialog-description" className="text-sm text-muted-foreground pt-1.5 leading-normal">
                {description}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="cursor-pointer"
            >
              {cancelText}
            </Button>
            <Button
              variant={variant}
              size="sm"
              onClick={onConfirm}
              disabled={isLoading}
              className="cursor-pointer min-w-[70px]"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
