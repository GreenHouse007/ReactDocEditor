import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Document } from "@enfield/types";
import {
  buildDocumentTree,
  collectDescendantIds,
  type DocumentTreeNode,
} from "../lib/documentTree";

interface MoveDocumentDialogProps {
  documents: Document[];
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onMove: (parentId: string | null) => void;
}

export function MoveDocumentDialog({
  documents,
  documentId,
  isOpen,
  onClose,
  onMove,
}: MoveDocumentDialogProps) {
  const tree = useMemo(() => buildDocumentTree(documents), [documents]);
  const currentDoc = documents.find((doc) => doc._id === documentId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedParent, setSelectedParent] = useState<string | null>(
    currentDoc?.parentId ?? null
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedParent(currentDoc?.parentId ?? null);

    if (currentDoc?.parentId) {
      const ancestors = findAncestorIds(tree, currentDoc.parentId);
      const expanded = new Set(ancestors);
      expanded.add(currentDoc.parentId);
      setExpandedIds(expanded);
    } else {
      setExpandedIds(new Set());
    }
  }, [currentDoc?.parentId, isOpen, tree]);

  const blockedIds = useMemo(() => {
    if (!currentDoc?._id) return new Set<string>();
    const lookup = new Map<string, DocumentTreeNode>();
    tree.forEach((node) => fillLookup(node, lookup));

    const blocked = new Set<string>([currentDoc._id]);
    const targetNode = lookup.get(currentDoc._id);
    if (targetNode) {
      collectDescendantIds(targetNode).forEach((id) => blocked.add(id));
    }

    return blocked;
  }, [currentDoc?._id, tree]);

  if (!isOpen || !currentDoc) {
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

  const handleConfirm = () => {
    onMove(selectedParent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/95 p-6 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Move Document</h2>
          <p className="text-sm text-gray-400">
            Choose a new location for "{currentDoc.title || "Untitled"}".
          </p>
        </div>
        <div className="mb-4 rounded-xl border border-white/5 bg-black/20 p-3 max-h-72 overflow-y-auto">
          <button
            onClick={() => setSelectedParent(null)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              selectedParent === null
                ? "bg-white/10 text-white"
                : "text-gray-300 hover:bg-white/5"
            }`}
          >
            <span>Workspace root</span>
            <span className="text-xs text-gray-500">Top level</span>
          </button>
          <div className="mt-2 space-y-1">
            {tree.map((node) => (
              <TreeRow
                key={node._id}
                node={node}
                level={0}
                blockedIds={blockedIds}
                expandedIds={expandedIds}
                onToggleExpanded={toggleExpanded}
                selectedParent={selectedParent}
                setSelectedParent={setSelectedParent}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:from-blue-400 hover:to-purple-400"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

interface TreeRowProps {
  node: DocumentTreeNode;
  level: number;
  blockedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  selectedParent: string | null;
  setSelectedParent: Dispatch<SetStateAction<string | null>>;
}

function TreeRow({
  node,
  level,
  blockedIds,
  expandedIds,
  onToggleExpanded,
  selectedParent,
  setSelectedParent,
}: TreeRowProps) {
  if (!node._id) return null;

  const isBlocked = blockedIds.has(node._id);
  const isExpanded = expandedIds.has(node._id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 transition ${
          selectedParent === node._id
            ? "bg-white/10 text-white"
            : "text-gray-300 hover:bg-white/5"
        } ${isBlocked ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${level * 16}px` }}
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
        <button
          disabled={isBlocked}
          onClick={() => setSelectedParent(node._id!)}
          className="flex-1 text-left"
        >
          {node.title || "Untitled"}
        </button>
      </div>
      {hasChildren && (
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
            isExpanded ? "max-h-[800px]" : "max-h-0"
          }`}
        >
          <div className="space-y-1">
            {node.children.map((child) => (
              <TreeRow
                key={child._id}
                node={child}
                level={level + 1}
                blockedIds={blockedIds}
                expandedIds={expandedIds}
                onToggleExpanded={onToggleExpanded}
                selectedParent={selectedParent}
                setSelectedParent={setSelectedParent}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function fillLookup(node: DocumentTreeNode, map: Map<string, DocumentTreeNode>) {
  if (!node._id) return;
  map.set(node._id, node);
  node.children.forEach((child) => fillLookup(child, map));
}

function findAncestorIds(
  nodes: DocumentTreeNode[],
  targetId: string,
  trail: string[] = []
): string[] {
  for (const node of nodes) {
    if (!node._id) continue;
    if (node._id === targetId) {
      return trail;
    }
    const result = findAncestorIds(node.children, targetId, [...trail, node._id]);
    if (result.length) {
      return result;
    }
  }
  return [];
}
