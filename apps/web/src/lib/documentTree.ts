import type { Document } from "@enfield/types";

export interface DocumentTreeNode extends Document {
  children: DocumentTreeNode[];
}

const FALLBACK_ORDER = 999999;

function getOrderValue(doc: Document): number {
  return doc.order ?? FALLBACK_ORDER;
}

export function buildDocumentTree(documents: Document[]): DocumentTreeNode[] {
  const map = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  const sortedDocs = [...documents].sort((a, b) => getOrderValue(a) - getOrderValue(b));

  sortedDocs.forEach((doc) => {
    const node: DocumentTreeNode = { ...doc, children: [] };
    if (doc._id) {
      map.set(doc._id, node);
    }
  });

  map.forEach((node) => {
    const parentId = node.parentId ?? null;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (nodes: DocumentTreeNode[]) => {
    nodes.sort((a, b) => getOrderValue(a) - getOrderValue(b));
    nodes.forEach((child) => sortChildren(child.children));
  };

  sortChildren(roots);
  return roots;
}

export function collectDescendantIds(node: DocumentTreeNode): string[] {
  const ids: string[] = [];

  node.children.forEach((child) => {
    if (child._id) {
      ids.push(child._id);
      ids.push(...collectDescendantIds(child));
    }
  });

  return ids;
}

export function flattenTree(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
  const list: DocumentTreeNode[] = [];

  nodes.forEach((node) => {
    list.push(node);
    list.push(...flattenTree(node.children));
  });

  return list;
}
