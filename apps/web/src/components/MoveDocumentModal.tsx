import { useEffect, useMemo, useState } from "react";
import type { Document } from "@enfield/types";
import {
  buildDocumentTree,
  collectDescendantIds,
  type DocumentTreeNode,
} from "../lib/documentTree";

interface MoveDocumentModalProps {
  documents: Document[];
  document: Document;
  onClose: () => void;
  onMove: (destinationParentId: string | null) => void;
}

interface Option {
  id: string;
  label: string;
}

export function MoveDocumentModal({
  documents,
  document,
  onClose,
  onMove,
}: MoveDocumentModalProps) {
  const documentId = document._id ?? null;

  const invalidIds = useMemo(() => {
    const ids = new Set<string>();
    if (documentId) {
      ids.add(documentId);
      collectDescendantIds(documents, documentId).forEach((id) =>
        ids.add(id)
      );
    }
    return ids;
  }, [documents, documentId]);

  const tree = useMemo<DocumentTreeNode[]>(
    () => buildDocumentTree(documents),
    [documents]
  );

  const options = useMemo<Option[]>(() => {
    const result: Option[] = [];

    const walk = (nodes: DocumentTreeNode[], depth: number) => {
      nodes.forEach((node) => {
        const id = node.document._id;
        if (!id || invalidIds.has(id)) {
          walk(node.children, depth + 1);
          return;
        }

        const indent = "\u00A0".repeat(depth * 2);
        result.push({
          id,
          label: `${indent}${node.document.title || "Untitled"}`,
        });
        walk(node.children, depth + 1);
      });
    };

    walk(tree, 0);
    return result;
  }, [invalidIds, tree]);

  const [selectedParent, setSelectedParent] = useState<string | null>(
    document.parentId ?? null
  );

  useEffect(() => {
    setSelectedParent(document.parentId ?? null);
  }, [document.parentId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onMove(selectedParent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-3">Move Document</h2>
        <p className="text-sm text-gray-400 mb-4">
          Choose a new location for <span className="font-medium text-gray-200">{document.title || "Untitled"}</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Destination
            </label>
            <select
              value={selectedParent ?? ""}
              onChange={(e) =>
                setSelectedParent(e.target.value ? e.target.value : null)
              }
              className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Root (no parent)</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {options.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">
                No available destinations. Try reorganizing other documents first.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={options.length === 0}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-600/50"
            >
              Move
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
