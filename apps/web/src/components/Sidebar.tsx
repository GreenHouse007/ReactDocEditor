import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { PageOptionsMenu } from "./PageOptionsMenu";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

// Workaround for type conflicts between multiple @types/react versions in the monorepo.
// Cast the DnD components to `any` so they can be used in JSX without TypeScript errors.
const DragDropContextAny = DragDropContext as any;
const DroppableAny = Droppable as any;
const DraggableAny = Draggable as any;

function sortDocuments(docs: Document[]): Document[] {
  return [...docs].sort((a, b) => {
    const orderA = a.order ?? 999999;
    const orderB = b.order ?? 999999;
    return orderA - orderB;
  });
}

function isDescendant(
  docs: Document[],
  potentialDescendantId: string | null | undefined,
  potentialAncestorId: string
): boolean {
  if (!potentialDescendantId) {
    return false;
  }

  let current = docs.find((doc) => doc._id === potentialDescendantId) ?? null;

  while (current) {
    if (current.parentId === potentialAncestorId) {
      return true;
    }

    if (!current.parentId) {
      return false;
    }

    current = docs.find((doc) => doc._id === current?.parentId) ?? null;
  }

  return false;
}

interface SidebarItemProps {
  document: Document;
  index: number;
  level: number;
  allDocuments: Document[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  ensureExpanded: (id: string) => void;
  renderChildren: (parentId: string | null, level: number) => ReactNode;
}

function SidebarItem({
  document,
  index,
  level,
  allDocuments,
  favorites,
  onToggleFavorite,
  isExpanded,
  onToggleExpand,
  ensureExpanded,
  renderChildren,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const queryClient = useQueryClient();
  const [isHovered, setIsHovered] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  const allChildren = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = allChildren.length > 0 || isCreatingChild;
  const isActive = currentId === document._id;
  const isFavorite = favorites.includes(document._id || "");

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteDocument(document._id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (currentId === document._id) {
        navigate("/");
      }
    },
  });

  const createChildMutation = useMutation({
    mutationFn: (title: string) =>
      api.createDocument({
        title,
        authorId: "demo-user",
        parentId: document._id,
      }),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsCreatingChild(false);
      setChildTitle("");
      ensureExpanded(document._id!);
      navigate(`/document/${newDoc._id}`);
    },
  });

  const handleCreateChild = (event: React.FormEvent) => {
    event.preventDefault();
    if (childTitle.trim()) {
      createChildMutation.mutate(childTitle.trim());
    }
  };

  return (
    <DraggableAny draggableId={document._id!} index={index}>
      {(provided: any, snapshot: any) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <DroppableAny droppableId={`into:${document._id}`} type="document">
            {(dropProvided: any, dropSnapshot: any) => (
              <div
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
                className={`rounded-md transition-colors ${
                  dropSnapshot.isDraggingOver
                    ? "bg-blue-900/30 ring-2 ring-blue-500/40"
                    : ""
                }`}
              >
                <div
                  className={`flex items-center gap-2 py-1 pr-2 text-sm text-gray-200 transition-colors ${
                    isActive ? "bg-gray-800" : "hover:bg-gray-800/60"
                  } ${snapshot.isDragging ? "opacity-75" : ""}`}
                  style={{ paddingLeft: `${level * 16 + 12}px` }}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onClick={() => navigate(`/document/${document._id}`)}
                >
                  <button
                    {...provided.dragHandleProps}
                    onClick={(event) => event.stopPropagation()}
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs text-gray-500 hover:text-gray-300"
                    title="Drag to reorder"
                  >
                    ⠿
                  </button>
                  {hasChildren ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleExpand();
                      }}
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-300"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="w-5 flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate">
                    {document.title || "Untitled"}
                  </span>
                  {isHovered && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(document._id!);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded text-base transition-colors hover:bg-gray-700"
                      title="Toggle favorite"
                    >
                      <span
                        className={
                          isFavorite ? "text-yellow-400" : "text-gray-500"
                        }
                      >
                        {isFavorite ? "★" : "☆"}
                      </span>
                    </button>
                  )}
                  {isHovered && (
                    <button
                      ref={optionsButtonRef}
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowOptions((prev) => !prev);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-700"
                      title="More options"
                    >
                      ⋯
                    </button>
                  )}
                </div>
                {dropProvided.placeholder}
              </div>
            )}
          </DroppableAny>

          {showOptions && (
            <PageOptionsMenu
              onAddChild={() => {
                setIsCreatingChild(true);
                ensureExpanded(document._id!);
              }}
              onDelete={() => {
                if (confirm(`Delete "${document.title || "Untitled"}"?`)) {
                  deleteMutation.mutate();
                }
              }}
              onClose={() => setShowOptions(false)}
              triggerRef={optionsButtonRef.current}
            />
          )}

          {isCreatingChild && (
            <form
              onSubmit={handleCreateChild}
              style={{ paddingLeft: `${level * 16 + 44}px` }}
              className="px-2 py-1"
            >
              <input
                type="text"
                value={childTitle}
                onChange={(event) => setChildTitle(event.target.value)}
                onBlur={() => {
                  if (!childTitle.trim()) {
                    setIsCreatingChild(false);
                  }
                }}
                placeholder="Page title..."
                autoFocus
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </form>
          )}

          {isExpanded && renderChildren(document._id!, level + 1)}
        </div>
      )}
    </DraggableAny>
  );
}

interface SidebarProps {
  favorites: string[];
  setFavorites: (favorites: string[]) => void;
}

export function Sidebar({ favorites, setFavorites }: SidebarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });

  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      documents.forEach((doc) => {
        if (!doc.parentId && doc._id) {
          next.add(doc._id);
        }
      });
      return next;
    });
  }, [documents]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchSet = useMemo(() => {
    if (!normalizedQuery) {
      return null;
    }

    const matches = new Set<string>();
    const lookup = new Map<string, Document>();

    documents.forEach((doc) => {
      if (!doc._id) {
        return;
      }

      lookup.set(doc._id, doc);

      if ((doc.title || "Untitled").toLowerCase().includes(normalizedQuery)) {
        matches.add(doc._id);
      }
    });

    const includeAncestors = (id: string | null | undefined) => {
      if (!id) {
        return;
      }

      if (matches.has(id)) {
        return;
      }

      matches.add(id);
      const parent = lookup.get(id)?.parentId ?? null;
      includeAncestors(parent);
    };

    Array.from(matches).forEach((id) => {
      const parent = lookup.get(id)?.parentId ?? null;
      includeAncestors(parent);
    });

    return matches;
  }, [documents, normalizedQuery]);

  useEffect(() => {
    if (!matchSet || matchSet.size === 0) {
      return;
    }

    const lookup = new Map<string, Document>();
    documents.forEach((doc) => {
      if (doc._id) {
        lookup.set(doc._id, doc);
      }
    });

    setExpandedIds((prev) => {
      const next = new Set(prev);
      matchSet.forEach((id) => {
        let parentId = lookup.get(id)?.parentId ?? null;
        while (parentId) {
          next.add(parentId);
          parentId = lookup.get(parentId)?.parentId ?? null;
        }
      });
      return next;
    });
  }, [matchSet, documents]);

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api.createDocument({
        title,
        authorId: "demo-user",
      }),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsCreating(false);
      setNewDocTitle("");
      navigate(`/document/${document._id}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; data: UpdateDocumentDto }[]) => {
      await Promise.all(
        updates.map(({ id, data }) => api.updateDocument(id, data))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error) => {
      console.error("Failed to reorder documents:", error);
    },
  });

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newDocTitle.trim()) {
      createMutation.mutate(newDocTitle.trim());
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(
      favorites.includes(id)
        ? favorites.filter((fav) => fav !== id)
        : [...favorites, id]
    );
  };

  const ensureExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const parseListParentId = (droppableId: string): string | null => {
    if (droppableId === "list:root") {
      return null;
    }

    if (droppableId.startsWith("list:")) {
      const id = droppableId.replace("list:", "");
      return id || null;
    }

    return null;
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    const movingDoc = documents.find((doc) => doc._id === draggableId);
    if (!movingDoc) {
      return;
    }

    const updatesMap = new Map<string, UpdateDocumentDto>();

    const queueUpdate = (id: string, data: UpdateDocumentDto) => {
      if (!id) {
        return;
      }

      const existing = updatesMap.get(id) ?? {};
      updatesMap.set(id, { ...existing, ...data });
    };

    const getSiblings = (parentId: string | null) =>
      sortDocuments(
        documents.filter((doc) => (doc.parentId ?? null) === parentId)
      );

    const reindexSiblings = (
      siblings: Document[],
      parentId: string | null
    ) => {
      siblings.forEach((doc, idx) => {
        if (!doc._id) {
          return;
        }

        const data: UpdateDocumentDto = {};

        if (doc._id === draggableId) {
          data.parentId = parentId;
          data.order = idx;
        } else if (doc.order !== idx) {
          data.order = idx;
        }

        if (Object.keys(data).length > 0) {
          queueUpdate(doc._id, data);
        }
      });
    };

    const sourceParentId = parseListParentId(source.droppableId);

    try {
      if (destination.droppableId.startsWith("into:")) {
        const destParentId = destination.droppableId.replace("into:", "");

        if (!destParentId || destParentId === draggableId) {
          return;
        }

        if (isDescendant(documents, destParentId, draggableId)) {
          return;
        }

        const destSiblings = getSiblings(destParentId).filter(
          (doc) => doc._id !== draggableId
        );
        destSiblings.push({ ...movingDoc, parentId: destParentId });
        reindexSiblings(destSiblings, destParentId);

        if (sourceParentId !== destParentId) {
          const sourceSiblings = getSiblings(sourceParentId).filter(
            (doc) => doc._id !== draggableId
          );
          reindexSiblings(sourceSiblings, sourceParentId);
        }

        ensureExpanded(destParentId);
      } else if (destination.droppableId.startsWith("list:")) {
        const destParentId = parseListParentId(destination.droppableId);

        if (
          destination.droppableId === source.droppableId &&
          destination.index === source.index &&
          (destParentId ?? null) === (sourceParentId ?? null)
        ) {
          return;
        }

        if (destParentId && isDescendant(documents, destParentId, draggableId)) {
          return;
        }

        const destSiblings = getSiblings(destParentId).filter(
          (doc) => doc._id !== draggableId
        );

        destSiblings.splice(destination.index, 0, {
          ...movingDoc,
          parentId: destParentId,
        });

        reindexSiblings(destSiblings, destParentId);

        if (destParentId !== sourceParentId) {
          const sourceSiblings = getSiblings(sourceParentId).filter(
            (doc) => doc._id !== draggableId
          );
          reindexSiblings(sourceSiblings, sourceParentId);
        }

        if (destParentId) {
          ensureExpanded(destParentId);
        }
      } else {
        return;
      }

      const updates = Array.from(updatesMap.entries()).map(([id, data]) => ({
        id,
        data,
      }));

      if (updates.length === 0) {
        return;
      }

      await reorderMutation.mutateAsync(updates);
    } catch (error) {
      console.error("Failed to handle drag and drop:", error);
    }
  };

  const renderChildren = (
    parentId: string | null,
    level: number
  ): ReactNode => {
    const siblings = sortDocuments(
      documents.filter((doc) => (doc.parentId ?? null) === parentId)
    );

    const visibleSiblings =
      matchSet === null
        ? siblings
        : siblings.filter((doc) => doc._id && matchSet.has(doc._id));

    const droppableId = parentId ? `list:${parentId}` : "list:root";

    return (
      <DroppableAny droppableId={droppableId} type="document">
        {(provided: any) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              minHeight: visibleSiblings.length === 0 ? "12px" : undefined,
            }}
          >
            {visibleSiblings.map((doc, idx) => (
              <SidebarItem
                key={doc._id}
                document={doc}
                index={idx}
                level={level}
                allDocuments={documents}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                isExpanded={!!(doc._id && expandedIds.has(doc._id))}
                onToggleExpand={() => {
                  if (!doc._id) {
                    return;
                  }
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(doc._id!)) {
                      next.delete(doc._id!);
                    } else {
                      next.add(doc._id!);
                    }
                    return next;
                  });
                }}
                ensureExpanded={ensureExpanded}
                renderChildren={renderChildren}
              />
            ))}
            {provided.placeholder as any}
          </div>
        )}
      </DroppableAny>
    );
  };

  const noSearchResults = matchSet !== null && matchSet.size === 0;
  const noDocuments = documents.length === 0;

  return (
    <DragDropContextAny onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="font-bold text-white">E</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Enfield</div>
              <div className="text-xs text-gray-400">World Builder</div>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="mb-3 w-full rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-gray-700"
          >
            🏠 Dashboard
          </button>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pages..."
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-xs font-semibold uppercase text-gray-400">
              Pages
            </span>
            <button
              onClick={() => setIsCreating(true)}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              title="Add page"
            >
              +
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateSubmit} className="mb-2 px-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(event) => setNewDocTitle(event.target.value)}
                onBlur={() => {
                  if (!newDocTitle.trim()) {
                    setIsCreating(false);
                  }
                }}
                placeholder="Page title..."
                autoFocus
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </form>
          )}

          {!(noSearchResults || (noDocuments && !isCreating)) && (
            <>{renderChildren(null, 0)}</>
          )}

          {noSearchResults && !isCreating && (
            <div className="px-2 py-8 text-center text-sm text-gray-500">
              No pages found
            </div>
          )}

          {noDocuments && !isCreating && !noSearchResults && (
            <div className="px-2 py-8 text-center text-sm text-gray-500">
              No pages yet. Click + to create one.
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500">
              <span className="text-sm font-semibold text-white">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                Demo User
              </div>
              <div className="truncate text-xs text-gray-400">
                demo@enfield.app
              </div>
            </div>
          </div>
        </div>
      </div>
    </DragDropContextAny>
  );
}
