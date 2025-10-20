import { useEffect, useMemo, useState } from "react";
import type { Document } from "@enfield/types";
import {
  buildDocumentTree,
  collectDescendantIds,
  DocumentTreeNode,
} from "../../utils/documentTree";

interface MoveDocumentModalProps {
  isOpen: boolean;
  isProcessing: boolean;
  documents: Document[];
  document: Document;
  initialParentId: string | null;
  onClose: () => void;
  onConfirm: (parentId: string | null) => void;
}

export function MoveDocumentModal({
  isOpen,
  isProcessing,
  documents,
  document,
  initialParentId,
  onClose,
  onConfirm,
}: MoveDocumentModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    initialParentId ?? null
  );

  useEffect(() => {
    setSelectedParentId(initialParentId ?? null);
  }, [initialParentId, isOpen]);

  const disabledIds = useMemo(() => {
    if (!document._id) return new Set<string>();
    const descendants = collectDescendantIds(documents, document._id);
    if (document._id) {
      descendants.add(document._id);
    }
    return descendants;
  }, [documents, document._id]);

  const tree = useMemo(
    () => buildDocumentTree(documents),
    [documents]
  );

  if (!isOpen) {
    return null;
  }

  const renderNode = (node: DocumentTreeNode, depth = 0) => {
    const id = node.document._id ?? "";
    const isDisabled = disabledIds.has(id);
    const isSelected = selectedParentId === id;

    return (
      <div key={id} className="space-y-1">
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => setSelectedParentId(id)}
          className={`flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors ${
            isSelected
              ? "bg-blue-600/20 text-blue-200"
              : "text-gray-200 hover:bg-gray-800"
          } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border ${
              isSelected ? "border-blue-400 bg-blue-500/60" : "border-gray-600"
            }`}
          >
            {isSelected && <span className="h-2 w-2 rounded-full bg-blue-200" />}
          </span>
          <span className="truncate">
            {node.document.title || "Untitled"}
          </span>
        </button>
        {node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Move Document</h2>
          <p className="mt-1 text-sm text-gray-400">
            Choose a new location for "{document.title || "Untitled"}".
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto px-2 py-3">
          <button
            type="button"
            onClick={() => setSelectedParentId(null)}
            className={`flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors ${
              selectedParentId === null
                ? "bg-blue-600/20 text-blue-200"
                : "text-gray-200 hover:bg-gray-800"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                selectedParentId === null
                  ? "border-blue-400 bg-blue-500/60"
                  : "border-gray-600"
              }`}
            >
              {selectedParentId === null && (
                <span className="h-2 w-2 rounded-full bg-blue-200" />
              )}
            </span>
            <span className="truncate">Top level</span>
          </button>

          <div className="mt-2 space-y-1">
            {tree
              .filter((node) => node.document._id !== document._id)
              .map((node) => renderNode(node))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedParentId)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isProcessing}
          >
            {isProcessing ? "Moving..." : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
