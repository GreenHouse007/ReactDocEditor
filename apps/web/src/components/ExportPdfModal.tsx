import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Document } from "@enfield/types";
import { buildDocumentTree, type DocumentTreeNode } from "../lib/documentTree";

interface ExportPdfModalProps {
  documents: Document[];
  isOpen: boolean;
  initialSelectedIds: string[];
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

function gatherIds(node: DocumentTreeNode): string[] {
  const ids: string[] = [];
  if (node.document._id) {
    ids.push(node.document._id);
  }
  node.children.forEach((child) => {
    ids.push(...gatherIds(child));
  });
  return ids;
}

function collectSelectedInOrder(
  nodes: DocumentTreeNode[],
  selected: Set<string>
): string[] {
  const result: string[] = [];

  nodes.forEach((node) => {
    const id = node.document._id;
    if (id && selected.has(id)) {
      result.push(id);
    }
    result.push(...collectSelectedInOrder(node.children, selected));
  });

  return result;
}

function Checkbox({
  checked,
  indeterminate,
  onChange,
  id,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  id?: string;
}) {
  const [element, setElement] = useState<HTMLInputElement | null>(null);

  useEffect(() => {
    if (element) {
      element.indeterminate = indeterminate;
    }
  }, [element, indeterminate]);

  return (
    <input
      ref={setElement}
      id={id}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
    />
  );
}

export function ExportPdfModal({
  documents,
  isOpen,
  initialSelectedIds,
  onClose,
  onConfirm,
}: ExportPdfModalProps) {
  const tree = useMemo(() => buildDocumentTree(documents), [documents]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    setSelectedIds(new Set(initialSelectedIds));

    const expanded = new Set<string>();
    documents.forEach((doc) => {
      if (doc._id && doc.parentId) {
        expanded.add(doc.parentId);
      }
    });
    setExpandedIds(expanded);
  }, [documents, initialSelectedIds, isOpen]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handler);
    }

    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const toggleSelection = (node: DocumentTreeNode, nextChecked: boolean) => {
    const ids = gatherIds(node);
    setSelectedIds((prev) => {
      const updated = new Set(prev);
      ids.forEach((id) => {
        if (nextChecked) {
          updated.add(id);
        } else {
          updated.delete(id);
        }
      });
      return updated;
    });
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(nodeId)) {
        updated.delete(nodeId);
      } else {
        updated.add(nodeId);
      }
      return updated;
    });
  };

  const renderNode = (node: DocumentTreeNode, depth = 0) => {
    const nodeId = node.document._id;
    const hasChildren = node.children.length > 0;
    const subtreeIds = gatherIds(node);
    const selectedCount = subtreeIds.filter((id) => selectedIds.has(id)).length;
    const isChecked = subtreeIds.length > 0 && selectedCount === subtreeIds.length;
    const isIndeterminate = selectedCount > 0 && selectedCount < subtreeIds.length;
    const isExpanded = nodeId ? expandedIds.has(nodeId) || depth === 0 : true;
    const labelId = nodeId ? `export-node-${nodeId}` : undefined;

    return (
      <li key={nodeId ?? `${node.document.title}-${depth}`} className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-gray-200">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => nodeId && toggleExpanded(nodeId)}
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-gray-400 hover:bg-gray-700"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="inline-flex h-5 w-5 items-center justify-center text-gray-700">•</span>
          )}
          <Checkbox
            id={labelId}
            checked={isChecked}
            indeterminate={isIndeterminate}
            onChange={(event) => toggleSelection(node, event.target.checked)}
          />
          <label htmlFor={labelId} className="flex-1 cursor-pointer select-none">
            {node.document.title || "Untitled"}
          </label>
        </div>
        {hasChildren && isExpanded && (
          <ul className="ml-6 space-y-1 border-l border-gray-700/60 pl-4">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const orderedIds = collectSelectedInOrder(tree, selectedIds);
    if (orderedIds.length === 0) {
      return;
    }
    onConfirm(orderedIds);
  };

  const canSubmit = selectedIds.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Export to PDF</h2>
            <p className="text-sm text-gray-400">
              Choose the pages you want to include in the export.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-gray-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-80 overflow-y-auto rounded border border-gray-800 bg-gray-900/60 p-3">
            <ul className="space-y-1">
              {tree.map((node) => renderNode(node))}
            </ul>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{selectedIds.size} page{selectedIds.size === 1 ? "" : "s"} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-600/50"
              >
                Export PDF
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
