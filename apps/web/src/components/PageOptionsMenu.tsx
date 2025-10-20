import { useEffect, useRef } from "react";

interface PageOptionsMenuProps {
  onAddChild: () => void;
  onDelete: () => void;
  onClose: () => void;
  triggerRef: HTMLButtonElement | null;
}

export function PageOptionsMenu({
  onAddChild,
  onDelete,
  onClose,
  triggerRef,
}: PageOptionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (triggerRef && menuRef.current) {
      const rect = triggerRef.getBoundingClientRect();
      menuRef.current.style.top = `${rect.top}px`;
      menuRef.current.style.left = `${rect.right + 8}px`;
    }
  }, [triggerRef]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Menu - Fixed position, not relative */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-48"
      >
        <button
          onClick={() => {
            onAddChild();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
        >
          <span>➕</span> Add Child Page
        </button>
        <div className="border-t border-gray-700 my-1" />
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
        >
          <span>🗑️</span> Delete
        </button>
      </div>
    </>
  );
}
