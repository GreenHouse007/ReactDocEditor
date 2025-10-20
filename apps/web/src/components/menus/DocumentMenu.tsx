import { useEffect, useRef, useState, type RefObject } from "react";

interface DocumentMenuProps {
  isOpen: boolean;
  anchorRef: RefObject<HTMLButtonElement>;
  onRequestClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
}

export function DocumentMenu({
  isOpen,
  anchorRef,
  onRequestClose,
  onRename,
  onDelete,
  onMove,
}: DocumentMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onRequestClose();
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, onRequestClose, anchorRef]);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen, anchorRef]);

  if (!isOpen || !position) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-40 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <button
        onClick={onRename}
        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
      >
        Rename
      </button>
      <button
        onClick={onMove}
        className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
      >
        Move
      </button>
      <div className="my-1 border-t border-gray-700" />
      <button
        onClick={onDelete}
        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-800"
      >
        Delete
      </button>
    </div>
  );
}
