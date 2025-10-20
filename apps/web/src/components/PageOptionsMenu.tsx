import { useEffect, useRef } from "react";

interface PageOptionsMenuProps {
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
  triggerRef: HTMLButtonElement | null;
}

export function PageOptionsMenu({
  onRename,
  onMove,
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
        className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-44"
      >
        <button
          onClick={() => {
            onRename();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
        >
          Rename
        </button>
        <button
          onClick={() => {
            onMove();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700"
        >
          Move
        </button>
        <div className="border-t border-gray-700 my-1" />
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
        >
          Delete
        </button>
      </div>
    </>
  );
}
