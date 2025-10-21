import { useState, useEffect } from "react";
import type { Document } from "@enfield/types";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Document[];
  onExport: (selectedIds: string[], includePageNumbers: boolean) => void;
}

function sortDocuments(docs: Document[]): Document[] {
  return [...docs].sort((a, b) => {
    const orderA = a.order ?? 999999;
    const orderB = b.order ?? 999999;
    return orderA - orderB;
  });
}

interface TreeItemProps {
  document: Document;
  allDocuments: Document[];
  level: number;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeItem({
  document,
  allDocuments,
  level,
  selectedIds,
  onToggle,
  expandedIds,
  onToggleExpand,
}: TreeItemProps) {
  const children = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(document._id || "");
  const isSelected = selectedIds.has(document._id || "");

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 hover:bg-gray-800/50 rounded px-2"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={() => onToggleExpand(document._id!)}
            className="w-4 h-4 flex items-center justify-center hover:bg-gray-700 rounded flex-shrink-0"
          >
            <span className="text-xs text-gray-400">
              {isExpanded ? "▼" : "▶"}
            </span>
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(document._id!)}
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
        />

        {/* Title */}
        <span className="text-sm text-gray-200 flex-1">
          {document.title || "Untitled"}
        </span>
      </div>

      {/* Render children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child._id}
              document={child}
              allDocuments={allDocuments}
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExportModal({
  isOpen,
  onClose,
  documents,
  onExport,
}: ExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Expand all on open
  useEffect(() => {
    if (isOpen) {
      const allIds = new Set(documents.map((d) => d._id!));
      setExpandedIds(allIds);
    }
  }, [isOpen, documents]);

  if (!isOpen) return null;

  const rootDocuments = sortDocuments(documents.filter((doc) => !doc.parentId));
  const allSelected =
    documents.length > 0 && selectedIds.size === documents.length;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d._id!)));
    }
  };

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(Array.from(selectedIds), includePageNumbers);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-2xl font-bold text-white">Export to PDF</h2>
            <p className="text-gray-400 text-sm mt-1">
              Select pages to include in your export
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Select All */}
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-800">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
              />
              <span className="text-sm font-semibold text-white">
                Select All ({selectedIds.size} of {documents.length})
              </span>
            </div>

            {/* Tree */}
            <div className="space-y-1">
              {rootDocuments.map((doc) => (
                <TreeItem
                  key={doc._id}
                  document={doc}
                  allDocuments={documents}
                  level={0}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </div>

            {documents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No pages available to export
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800">
            {/* Options */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={includePageNumbers}
                  onChange={(e) => setIncludePageNumbers(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                />
                Include page numbers
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={selectedIds.size === 0 || isExporting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting
                  ? "Exporting..."
                  : `Export ${selectedIds.size} Page${
                      selectedIds.size !== 1 ? "s" : ""
                    }`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
