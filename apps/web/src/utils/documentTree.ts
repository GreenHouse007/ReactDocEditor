import type { Document } from "@enfield/types";

export interface DocumentTreeNode {
  document: Document;
  children: DocumentTreeNode[];
}

export function sortDocuments(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

export function buildDocumentTree(
  documents: Document[],
  parentId: string | null = null
): DocumentTreeNode[] {
  return sortDocuments(
    documents.filter((doc) => (doc.parentId ?? null) === parentId)
  ).map((doc) => ({
    document: doc,
    children: buildDocumentTree(documents, doc._id ?? null),
  }));
}

export function collectDescendantIds(
  documents: Document[],
  rootId: string
): Set<string> {
  const descendants = new Set<string>();

  const visit = (parentId: string) => {
    documents
      .filter((doc) => (doc.parentId ?? null) === parentId)
      .forEach((child) => {
        if (!child._id) return;
        descendants.add(child._id);
        visit(child._id);
      });
  };

  visit(rootId);
  return descendants;
}

export function getOrderedDocumentIds(
  documents: Document[],
  selectedIds: Set<string>
): string[] {
  const orderedIds: string[] = [];

  const traverse = (nodes: DocumentTreeNode[]) => {
    nodes.forEach((node) => {
      const id = node.document._id;
      if (id && selectedIds.has(id)) {
        orderedIds.push(id);
      }
      if (node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(buildDocumentTree(documents));
  return orderedIds;
}
