"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  description: string;
  defaultValue?: string;
  placeholder?: string;
  submitText?: string;
  isLoading?: boolean;
}

export function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  defaultValue = "",
  placeholder = "",
  submitText = "Save",
  isLoading = false,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
      // Autofocus input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, defaultValue]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Value cannot be empty");
      return;
    }
    setError(null);
    onSubmit(trimmed);
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="input-dialog-title"
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1">
            <h3 id="input-dialog-title" className="text-base font-semibold leading-none">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground pt-1.5 leading-normal">
              {description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (e.target.value.trim()) setError(null);
              }}
              disabled={isLoading}
              className="w-full"
            />
            {error && <p className="text-xs text-destructive font-medium">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="cursor-pointer min-w-[70px]"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
