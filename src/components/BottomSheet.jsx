import React from "react";
import { X } from "lucide-react";

export default function BottomSheet({
  open,
  title,
  onClose,
  children,
  maxH = "max-h-[90vh]",
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end z-50"
      onClick={onClose}
    >
      <div
        className={`bg-surface border-t border-hairline rounded-t-3xl w-full ${maxH} overflow-y-auto pb-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface rounded-t-3xl z-10">
          <div className="sheet-handle" />
          <div className="flex justify-between items-center px-6 pt-2 pb-3">
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-canvas transition"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-soft" />
            </button>
          </div>
        </div>
        <div className="px-6">{children}</div>
      </div>
    </div>
  );
}
