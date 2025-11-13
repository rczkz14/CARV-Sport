"use client";

import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const getMaxWidthClass = (maxWidth?: string) => {
  switch (maxWidth) {
    case "sm": return "max-w-sm";
    case "md": return "max-w-md";
    case "lg": return "max-w-lg";
    case "xl": return "max-w-xl";
    case "2xl": return "max-w-2xl";
    default: return "max-w-md";
  }
};

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, maxWidth = "md" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white text-black dark:bg-gray-800 dark:text-white rounded-lg p-6 mx-4 ${getMaxWidthClass(maxWidth)} w-full`}>
        {children}
      </div>
    </div>
  );
};