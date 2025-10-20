import { useEffect, useRef } from "react";

interface DocumentActionMenuProps {
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
  triggerRef: HTMLButtonElement | null;
}

export function DocumentActionMenu({
  onRename,
  onMove,
  onDelete,
  onClose,
  triggerRef,
}: DocumentActionMenuProps) {
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
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[160px] rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-lg"
      >
        <button
          onClick={() => {
            onRename();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
        >
          <span className="text-base">✏️</span>
          Rename
        </button>
        <button
          onClick={() => {
            onMove();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-200 transition hover:bg-white/10"
        >
          <span className="text-base">🗂️</span>
          Move
        </button>
        <div className="my-1 h-px bg-white/5" />
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition hover:bg-red-500/10"
        >
          <span className="text-base">🗑️</span>
          Delete
        </button>
      </div>
    </>
  );
}
