import { useEffect, useMemo, useRef, useState } from "react";
import type { Document } from "@enfield/types";

interface PdfExportDialogProps {
  isOpen: boolean;
  documents: Document[];
  initialSelection: string[];
  onClose: () => void;
  onConfirm: (documentIds: string[]) => void;
  currentDocumentId?: string;
}

interface DocumentTreeNode {
  document: Document;
  children: DocumentTreeNode[];
}

const sortDocuments = (docs: Document[]): Document[] => {
  return [...docs].sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA === orderB) {
      return (a.title || "").localeCompare(b.title || "");
    }
    return orderA - orderB;
  });
};

const buildDocumentTree = (documents: Document[]): DocumentTreeNode[] => {
  const map = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  documents.forEach((doc) => {
    if (!doc._id) return;
    map.set(doc._id, { document: doc, children: [] });
  });

  documents.forEach((doc) => {
    if (!doc._id) return;
    const node = map.get(doc._id);
    if (!node) return;

    if (doc.parentId && map.has(doc.parentId)) {
      map.get(doc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: DocumentTreeNode[]) => {
    nodes.sort((a, b) => {
      const orderA = a.document.order ?? 0;
      const orderB = b.document.order ?? 0;
      if (orderA === orderB) {
        return (a.document.title || "").localeCompare(
          b.document.title || ""
        );
      }
      return orderA - orderB;
    });

    nodes.forEach((child) => sortNodes(child.children));
  };

  sortNodes(roots);
  return roots;
};

const collectNodeIds = (node: DocumentTreeNode, set: Set<string>) => {
  const id = node.document._id;
  if (id) {
    set.add(id);
  }
  node.children.forEach((child) => collectNodeIds(child, set));
};

const nodeContainsSelection = (
  node: DocumentTreeNode,
  selected: Set<string>
): boolean => {
  const id = node.document._id;
  if (id && selected.has(id)) {
    return true;
  }
  return node.children.some((child) => nodeContainsSelection(child, selected));
};

const flattenSelectedNodes = (
  nodes: DocumentTreeNode[],
  selected: Set<string>,
  seen: Set<string>,
  acc: string[]
) => {
  nodes.forEach((node) => {
    const id = node.document._id;
    if (id && selected.has(id) && !seen.has(id)) {
      acc.push(id);
      seen.add(id);
    }

    if (node.children.length > 0) {
      flattenSelectedNodes(node.children, selected, seen, acc);
    }
  });
};

interface DocumentTreeItemProps {
  node: DocumentTreeNode;
  level: number;
  selected: Set<string>;
  onToggle: (node: DocumentTreeNode, shouldSelect: boolean) => void;
}

function DocumentTreeItem({
  node,
  level,
  selected,
  onToggle,
}: DocumentTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const childWrapperRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(0);
  const checkboxRef = useRef<HTMLInputElement>(null);

  const id = node.document._id!;
  const isChecked = selected.has(id);
  const hasSelectedDescendant = node.children.some((child) =>
    nodeContainsSelection(child, selected)
  );
  const isIndeterminate = !isChecked && hasSelectedDescendant;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  useEffect(() => {
    if (childWrapperRef.current) {
      setMaxHeight(childWrapperRef.current.scrollHeight);
    }
  }, [node.children.length, isExpanded, selected]);

  return (
    <div className="space-y-1">
      <div
        className="flex items-center rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-white/5"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mr-2 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs text-gray-300 transition hover:border-white/20 hover:text-white"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="mr-2 block h-6 w-6" />
        )}
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={isChecked}
          onChange={(event) => onToggle(node, event.target.checked)}
          className="h-4 w-4 accent-blue-500"
        />
        <span className="ml-3 text-sm font-medium text-gray-200">
          {node.document.title || "Untitled"}
        </span>
      </div>

      {node.children.length > 0 && (
        <div
          style={{
            maxHeight: isExpanded ? maxHeight : 0,
            opacity: isExpanded ? 1 : 0,
            transition: "max-height 0.25s ease, opacity 0.2s ease",
          }}
          className="overflow-hidden"
        >
          <div ref={childWrapperRef} className="space-y-1">
            {node.children.map((child) => (
              <DocumentTreeItem
                key={child.document._id}
                node={child}
                level={level + 1}
                selected={selected}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PdfExportDialog({
  isOpen,
  documents,
  initialSelection,
  onClose,
  onConfirm,
  currentDocumentId,
}: PdfExportDialogProps) {
  const tree = useMemo(() => buildDocumentTree(sortDocuments(documents)), [
    documents,
  ]);

  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelection)
  );

  const initialKey = useMemo(
    () => initialSelection.slice().sort().join("|"),
    [initialSelection]
  );

  useEffect(() => {
    if (isOpen) {
      const nextSelection = new Set(initialSelection);
      if (currentDocumentId && !nextSelection.has(currentDocumentId)) {
        nextSelection.add(currentDocumentId);
      }
      setSelected(nextSelection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialKey, currentDocumentId]);

  if (!isOpen) {
    return null;
  }

  const handleToggle = (node: DocumentTreeNode, shouldSelect: boolean) => {
    const updated = new Set(selected);
    const ids = new Set<string>();
    collectNodeIds(node, ids);

    ids.forEach((id) => {
      if (shouldSelect) {
        updated.add(id);
      } else {
        updated.delete(id);
      }
    });

    setSelected(updated);
  };

  const handleConfirm = () => {
    const orderedIds: string[] = [];
    flattenSelectedNodes(tree, selected, new Set(), orderedIds);

    onConfirm(orderedIds);
  };

  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Export selected pages
            </h2>
            <p className="text-sm text-slate-400">
              Choose the pages you want to include in your PDF export.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="max-h-[460px] overflow-y-auto px-6 py-5">
          {tree.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-6 py-16 text-center text-sm text-slate-400">
              No documents available for export yet.
            </div>
          ) : (
            tree.map((node) => (
              <DocumentTreeItem
                key={node.document._id}
                node={node}
                level={0}
                selected={selected}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/60 px-6 py-4">
          <div className="text-sm text-slate-400">
            {selectedCount === 0
              ? "No pages selected"
              : `${selectedCount} page${selectedCount === 1 ? "" : "s"} selected`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

