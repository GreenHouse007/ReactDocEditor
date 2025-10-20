import { useEffect, useMemo, useState } from "react";
import type { Document } from "@enfield/types";
import {
  buildDocumentTree,
  collectDescendantIds,
  type DocumentTreeNode,
} from "../lib/documentTree";

interface ExportDocumentsModalProps {
  isOpen: boolean;
  documents: Document[];
  selectedIds: string[];
  onChangeSelection: (ids: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function ExportDocumentsModal({
  isOpen,
  documents,
  selectedIds,
  onChangeSelection,
  onClose,
  onConfirm,
}: ExportDocumentsModalProps) {
  const tree = useMemo(() => buildDocumentTree(documents), [documents]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    const expanded = new Set<string>();
    const expandAllWithSelection = (nodes: DocumentTreeNode[]) => {
      nodes.forEach((node) => {
        if (!node._id) return;
        const hasSelectedDescendants = collectDescendantIds(node).some((id) =>
          selectedIds.includes(id)
        );
        if (selectedIds.includes(node._id) || hasSelectedDescendants) {
          expanded.add(node._id);
        }
        expandAllWithSelection(node.children);
      });
    };

    expandAllWithSelection(tree);
    setExpandedIds(expanded);
  }, [isOpen, selectedIds, tree]);

  if (!isOpen) {
    return null;
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleDocument = (node: DocumentTreeNode, checked: boolean) => {
    if (!node._id) return;
    const descendants = collectDescendantIds(node);
    const idsToToggle = [node._id, ...descendants];

    if (checked) {
      const newSelection = new Set(selectedIds);
      idsToToggle.forEach((id) => newSelection.add(id));
      onChangeSelection(Array.from(newSelection));
    } else {
      onChangeSelection(selectedIds.filter((id) => !idsToToggle.includes(id)));
    }
  };

  const isAllSelected = documents.length > 0 && selectedIds.length === documents.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChangeSelection([]);
    } else {
      const allIds = documents.flatMap((doc) => (doc._id ? [doc._id] : []));
      onChangeSelection(allIds);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gray-900/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Export to PDF</h2>
            <p className="text-sm text-gray-400">
              Select the documents you want to include in your export.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-gray-300 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-white">Document selection</h3>
            <p className="text-xs text-gray-400">
              Drag to reorder in the sidebar. Order here follows your document tree.
            </p>
          </div>
          <button
            onClick={handleToggleAll}
            className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
          >
            {isAllSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/30 p-3">
          {tree.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No documents available.
            </div>
          ) : (
            <div className="space-y-1">
              {tree.map((node) => (
                <ExportTreeRow
                  key={node._id}
                  node={node}
                  level={0}
                  expandedIds={expandedIds}
                  onToggleExpanded={toggleExpanded}
                  onToggleDocument={toggleDocument}
                  selectedIds={selectedIds}
                />
              ))}
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
          <span>{selectedIds.length} document(s) selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:from-blue-400 hover:to-purple-400"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExportTreeRowProps {
  node: DocumentTreeNode;
  level: number;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  onToggleDocument: (node: DocumentTreeNode, checked: boolean) => void;
  selectedIds: string[];
}

function ExportTreeRow({
  node,
  level,
  expandedIds,
  onToggleExpanded,
  onToggleDocument,
  selectedIds,
}: ExportTreeRowProps) {
  if (!node._id) return null;
  const isExpanded = expandedIds.has(node._id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedIds.includes(node._id);

  const descendants = collectDescendantIds(node);
  const hasPartialSelection = descendants.some((id) => selectedIds.includes(id));

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${
          isSelected || hasPartialSelection
            ? "bg-white/5 text-white"
            : "text-gray-300 hover:bg-white/5"
        }`}
        style={{ paddingLeft: `${level * 18}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggleExpanded(node._id!)}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10"
          >
            <span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
          </button>
        ) : (
          <span className="h-6 w-6" />
        )}
        <label className="flex flex-1 items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(event) => onToggleDocument(node, event.target.checked)}
            className="h-4 w-4 rounded border border-white/20 bg-black/40 text-blue-500 focus:ring-blue-400"
          />
          <span className="truncate text-sm">{node.title || "Untitled"}</span>
        </label>
      </div>
      {hasChildren && (
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
            isExpanded ? "max-h-[800px]" : "max-h-0"
          }`}
        >
          <div className="space-y-1">
            {node.children.map((child) => (
              <ExportTreeRow
                key={child._id}
                node={child}
                level={level + 1}
                expandedIds={expandedIds}
                onToggleExpanded={onToggleExpanded}
                onToggleDocument={onToggleDocument}
                selectedIds={selectedIds}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
