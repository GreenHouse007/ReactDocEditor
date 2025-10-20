import { useMemo } from "react";
import type { Document } from "@enfield/types";
import { buildDocumentTree, DocumentTreeNode } from "../../utils/documentTree";

interface ExportPdfModalProps {
  isOpen: boolean;
  documents: Document[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectOnly: (ids: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
  isExporting: boolean;
}

export function ExportPdfModal({
  isOpen,
  documents,
  selectedIds,
  onToggle,
  onSelectOnly,
  onClose,
  onConfirm,
  isExporting,
}: ExportPdfModalProps) {
  const tree = useMemo(() => buildDocumentTree(documents), [documents]);

  if (!isOpen) {
    return null;
  }

  const collectIds = (node: DocumentTreeNode): string[] => {
    const currentId = node.document._id;
    const childIds = node.children.flatMap(collectIds);
    return currentId ? [currentId, ...childIds] : childIds;
  };

  const renderNode = (node: DocumentTreeNode, depth = 0) => {
    const id = node.document._id ?? "";
    const isChecked = selectedIds.has(id);

    const handleCheckboxChange = () => {
      onToggle(id);
    };

    return (
      <div key={id} className="space-y-1">
        <label
          className="flex cursor-pointer items-center gap-3 rounded px-2 py-2 hover:bg-gray-800"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500"
            checked={isChecked}
            onChange={handleCheckboxChange}
          />
          <span className="flex-1 truncate text-sm text-gray-200">
            {node.document.title || "Untitled"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const ids = collectIds(node);
              onSelectOnly(ids);
            }}
            className="text-xs text-blue-300 hover:text-blue-100"
          >
            Only
          </button>
        </label>
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
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Export to PDF</h2>
          <p className="mt-1 text-sm text-gray-400">
            Select the documents you want to include in the exported PDF.
          </p>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-2 py-3">
          {tree.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              No documents available.
            </div>
          ) : (
            <div className="space-y-1">{tree.map((node) => renderNode(node))}</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-gray-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={selectedIds.size === 0 || isExporting}
          >
            {isExporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
