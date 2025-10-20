import type { Document } from "@enfield/types";

export interface DocumentTreeNode {
  document: Document;
  children: DocumentTreeNode[];
}

export function sortDocuments(documents: Document[]): Document[] {
  return [...documents].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return (a.title || "").localeCompare(b.title || "");
  });
}

export function buildDocumentTree(
  documents: Document[],
  parentId: string | null = null
): DocumentTreeNode[] {
  return sortDocuments(
    documents.filter((doc) => (doc.parentId ?? null) === parentId)
  ).map((doc) => {
    const currentId = doc._id ?? null;

    return {
      document: doc,
      children:
        currentId !== null
          ? buildDocumentTree(documents, currentId)
          : [],
    };
  });
}

export function collectDescendantIds(
  documents: Document[],
  rootId: string
): Set<string> {
  const descendants = new Set<string>();

  const traverse = (currentId: string) => {
    documents.forEach((doc) => {
      if ((doc.parentId ?? null) === currentId) {
        const childId = doc._id;
        if (childId) {
          if (!descendants.has(childId)) {
            descendants.add(childId);
            traverse(childId);
          }
        }
      }
    });
  };

  traverse(rootId);
  return descendants;
}

export function flattenTree(nodes: DocumentTreeNode[]): Document[] {
  const result: Document[] = [];

  const walk = (node: DocumentTreeNode) => {
    result.push(node.document);
    node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return result;
}
