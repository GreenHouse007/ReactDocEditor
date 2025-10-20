import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DragDropContextAny = DragDropContext as any;
const DroppableAny = Droppable as any;
const DraggableAny = Draggable as any;

const sortDocuments = (documents: Document[]): Document[] => {
  return [...documents].sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA === orderB) {
      return (a.title || "").localeCompare(b.title || "");
    }
    return orderA - orderB;
  });
};

const getDescendantIds = (rootId: string, documents: Document[]): Set<string> => {
  const descendants = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    documents.forEach((doc) => {
      if (doc.parentId === current && doc._id) {
        descendants.add(doc._id);
        stack.push(doc._id);
      }
    });
  }

  return descendants;
};

interface SidebarProps {
  favorites: string[];
  setFavorites: (favorites: string[]) => void;
}

interface SidebarItemProps {
  document: Document;
  allDocuments: Document[];
  level: number;
  index: number;
  activeId?: string;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void> | void;
  onDelete: (id: string) => void;
  onMove: (id: string, parentId: string | null) => void;
  onOpen: (id: string) => void;
}

interface MoveDialogProps {
  documents: Document[];
  currentDocumentId: string;
  onMove: (parentId: string | null) => void;
  onClose: () => void;
}

interface DocumentTreeNode {
  document: Document;
  children: DocumentTreeNode[];
}

const buildDocumentTree = (documents: Document[]): DocumentTreeNode[] => {
  const nodes = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  documents.forEach((doc) => {
    if (!doc._id) return;
    nodes.set(doc._id, { document: doc, children: [] });
  });

  documents.forEach((doc) => {
    if (!doc._id) return;
    const node = nodes.get(doc._id);
    if (!node) return;

    if (doc.parentId && nodes.has(doc.parentId)) {
      nodes.get(doc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (list: DocumentTreeNode[]) => {
    list.sort((a, b) => {
      const orderA = a.document.order ?? 0;
      const orderB = b.document.order ?? 0;
      if (orderA === orderB) {
        return (a.document.title || "").localeCompare(
          b.document.title || ""
        );
      }
      return orderA - orderB;
    });
    list.forEach((child) => sortNodes(child.children));
  };

  sortNodes(roots);
  return roots;
};

const flattenTree = (
  nodes: DocumentTreeNode[],
  level = 0,
  acc: { id: string; title: string; level: number }[] = []
) => {
  nodes.forEach((node) => {
    if (node.document._id) {
      acc.push({
        id: node.document._id,
        title: node.document.title || "Untitled",
        level,
      });
    }
    if (node.children.length > 0) {
      flattenTree(node.children, level + 1, acc);
    }
  });
  return acc;
};

function MoveDialog({
  documents,
  currentDocumentId,
  onMove,
  onClose,
}: MoveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => {
    const blocked = getDescendantIds(currentDocumentId, documents);
    blocked.add(currentDocumentId);
    const available = documents.filter(
      (doc) => doc._id && !blocked.has(doc._id)
    );
    const tree = buildDocumentTree(sortDocuments(available));
    return flattenTree(tree);
  }, [currentDocumentId, documents]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-xl backdrop-blur-xl"
    >
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Move to
      </div>
      <button
        onClick={() => void onMove(null)}
        className="mb-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
      >
        Root (no parent)
      </button>
      <div className="max-h-60 overflow-y-auto pr-1">
        {options.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No destinations available.
          </p>
        ) : (
          options.map((option) => (
            <button
              key={option.id}
              onClick={() => void onMove(option.id)}
              className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
              style={{ paddingLeft: `${option.level * 16 + 12}px` }}
            >
              {option.title}
            </button>
          ))
        )}
      </div>
      <button
        onClick={onClose}
        className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

function SidebarItem({
  document,
  allDocuments,
  level,
  index,
  activeId,
  favorites,
  onToggleFavorite,
  onRename,
  onDelete,
  onMove,
  onOpen,
}: SidebarItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title || "Untitled");
  const menuRef = useRef<HTMLDivElement>(null);
  const childWrapperRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const children = useMemo(
    () =>
      sortDocuments(
        allDocuments.filter((doc) => doc.parentId === document._id)
      ),
    [allDocuments, document._id]
  );

  const isActive = activeId === document._id;
  const hasChildren = children.length > 0;
  const isFavorite = favorites.includes(document._id || "");

  useEffect(() => {
    setRenameValue(document.title || "Untitled");
  }, [document.title]);

  useEffect(() => {
    if (childWrapperRef.current) {
      setMaxHeight(childWrapperRef.current.scrollHeight);
    }
  }, [children.length, isExpanded]);

  useEffect(() => {
    if (!showMenu) return;

    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== document.title) {
      void onRename(document._id!, trimmed);
    } else {
      setRenameValue(document.title || "Untitled");
    }
  };

  return (
    <DraggableAny draggableId={document._id!} index={index}>
      {(provided: any, snapshot: any) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={snapshot.isDragging ? "opacity-60" : ""}
        >
          <DroppableAny droppableId={`nest-${document._id}`} type="document">
            {(droppableProvided: any, droppableSnapshot: any) => (
              <div
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className={
                  droppableSnapshot.isDraggingOver
                    ? "rounded-xl bg-blue-500/20"
                    : ""
                }
              >
                <div
                  {...provided.dragHandleProps}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => {
                    setIsHovered(false);
                    setShowMenu(false);
                  }}
                  onClick={() => onOpen(document._id!)}
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-2 transition-colors duration-150 ${
                    isActive
                      ? "bg-slate-800/80 ring-1 ring-blue-500/40"
                      : "hover:bg-slate-800/50"
                  }`}
                  style={{ paddingLeft: `${level * 18 + 12}px` }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsExpanded((prev) => !prev);
                      }}
                      className="mr-1 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="mr-1 block h-6 w-6" />
                  )}

                  {isRenaming ? (
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleRenameSubmit();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setIsRenaming(false);
                          setRenameValue(document.title || "Untitled");
                        }
                      }}
                      autoFocus
                      className="flex-1 rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm font-medium text-slate-100">
                      {document.title || "Untitled"}
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(document._id!);
                      }}
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                        isFavorite
                          ? "text-amber-400 hover:text-amber-300"
                          : "text-slate-500 hover:text-slate-300"
                      } ${isHovered ? "opacity-100" : "opacity-0"}`}
                    >
                      {isFavorite ? "★" : "☆"}
                    </button>

                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowMenu((prev) => !prev);
                        }}
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-sm transition ${
                          isHovered ? "text-slate-400" : "text-slate-600"
                        } hover:text-white`}
                      >
                        ⋮
                      </button>

                      {showMenu && (
                        <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-lg">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setShowMenu(false);
                              setIsRenaming(true);
                            }}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                          >
                            Rename
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setShowMenu(false);
                              setShowMoveDialog(true);
                            }}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/10"
                          >
                            Move
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setShowMenu(false);
                              if (
                                confirm(
                                  `Delete "${document.title || "Untitled"}" and its nested pages?`
                                )
                              ) {
                                onDelete(document._id!);
                              }
                            }}
                            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      )}

                      {showMoveDialog && (
                        <MoveDialog
                          documents={allDocuments}
                          currentDocumentId={document._id!}
                          onMove={(parentId) => {
                            setShowMoveDialog(false);
                            void onMove(document._id!, parentId);
                          }}
                          onClose={() => setShowMoveDialog(false)}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {droppableProvided.placeholder}
              </div>
            )}
          </DroppableAny>

          {hasChildren && (
            <DroppableAny droppableId={`children-${document._id}`} type="document">
              {(providedChildren: any) => (
                <div
                  ref={providedChildren.innerRef}
                  {...providedChildren.droppableProps}
                  className="overflow-hidden"
                  style={{
                    maxHeight: isExpanded ? maxHeight ?? 1200 : 0,
                    opacity: isExpanded ? 1 : 0,
                    transition: "max-height 0.3s ease, opacity 0.2s ease",
                  }}
                >
                  <div ref={childWrapperRef} className="space-y-1">
                    {children.map((child, childIndex) => (
                      <SidebarItem
                        key={child._id}
                        document={child}
                        allDocuments={allDocuments}
                        level={level + 1}
                        index={childIndex}
                        activeId={activeId}
                        favorites={favorites}
                        onToggleFavorite={onToggleFavorite}
                        onRename={onRename}
                        onDelete={onDelete}
                        onMove={onMove}
                        onOpen={onOpen}
                      />
                    ))}
                    {providedChildren.placeholder}
                  </div>
                </div>
              )}
            </DroppableAny>
          )}
        </div>
      )}
    </DraggableAny>
  );
}

export function Sidebar({ favorites, setFavorites }: SidebarProps) {
  const navigate = useNavigate();
  const { id: activeId } = useParams();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api.createDocument({
        title,
        authorId: "demo-user",
        icon: "📄",
      }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsCreating(false);
      setNewDocTitle("");
      navigate(`/document/${doc._id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentDto }) =>
      api.updateDocument(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (variables?.data?.title) {
        queryClient.invalidateQueries({ queryKey: ["document", variables.id] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (activeId === deletedId) {
        navigate("/");
      }
    },
  });

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newDocTitle.trim()) {
      createMutation.mutate(newDocTitle.trim());
    }
  };

  const handleRename = async (id: string, title: string) => {
    await updateMutation.mutateAsync({ id, data: { title } });
  };

  const handleMove = async (id: string, parentId: string | null) => {
    const siblingCount = documents.filter(
      (doc) => (doc.parentId ?? null) === (parentId ?? null) && doc._id !== id
    ).length;
    await updateMutation.mutateAsync({
      id,
      data: { parentId, order: siblingCount },
    });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const toggleFavorite = (id: string) => {
    setFavorites(
      favorites.includes(id)
        ? favorites.filter((fav) => fav !== id)
        : [...favorites, id]
    );
  };

  const openDocument = (id: string) => {
    navigate(`/document/${id}`);
  };

  const rootDocuments = useMemo(
    () => sortDocuments(documents.filter((doc) => !doc.parentId)),
    [documents]
  );

  const filteredRootDocs = useMemo(() => {
    if (!searchQuery.trim()) {
      return rootDocuments;
    }
    const lower = searchQuery.toLowerCase();
    return rootDocuments.filter((doc) =>
      (doc.title || "Untitled").toLowerCase().includes(lower)
    );
  }, [rootDocuments, searchQuery]);

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    const destDroppableId: string = destination.droppableId;
    const sourceDroppableId: string = source.droppableId;

    const destinationParentId =
      destDroppableId === "root"
        ? null
        : destDroppableId.startsWith("children-")
        ? destDroppableId.replace("children-", "")
        : destDroppableId.startsWith("nest-")
        ? destDroppableId.replace("nest-", "")
        : null;

    const sourceParentId =
      sourceDroppableId === "root"
        ? null
        : sourceDroppableId.startsWith("children-")
        ? sourceDroppableId.replace("children-", "")
        : null;

    if (
      destination.droppableId === sourceDroppableId &&
      destination.index === source.index &&
      (destinationParentId ?? null) === (sourceParentId ?? null)
    ) {
      return;
    }

    const movingDocument = documents.find((doc) => doc._id === draggableId);
    if (!movingDocument) {
      return;
    }

    const destinationSiblings = sortDocuments(
      documents.filter(
        (doc) =>
          doc._id !== draggableId &&
          (doc.parentId ?? null) === (destinationParentId ?? null)
      )
    );

    const insertionIndex = destDroppableId.startsWith("nest-")
      ? destinationSiblings.length
      : destination.index;

    const virtualDoc: Document = {
      ...movingDocument,
      parentId: destinationParentId ?? null,
      order: insertionIndex,
    };

    destinationSiblings.splice(insertionIndex, 0, virtualDoc);

    const updates: Promise<unknown>[] = destinationSiblings.map((doc, idx) =>
      api.updateDocument(doc._id!, {
        parentId: destinationParentId,
        order: idx,
      })
    );

    if ((destinationParentId ?? null) !== (sourceParentId ?? null)) {
      const remainingSiblings = sortDocuments(
        documents.filter(
          (doc) =>
            doc._id !== draggableId &&
            (doc.parentId ?? null) === (sourceParentId ?? null)
        )
      );

      remainingSiblings.forEach((doc, idx) => {
        updates.push(
          api.updateDocument(doc._id!, {
            order: idx,
          })
        );
      });
    }

    try {
      await Promise.all(updates);
    } catch (error) {
      console.error("Failed to update document order", error);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  };

  return (
    <DragDropContextAny onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-72 flex-col border-r border-slate-800/70 bg-slate-950/80 text-white backdrop-blur-xl">
        <div className="border-b border-slate-800/70 px-5 py-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-xl font-bold text-white shadow-lg shadow-blue-500/40">
              E
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Enfield</p>
              <p className="text-xs text-slate-400">World Builder</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="mb-3 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10"
          >
            Dashboard
          </button>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search pages..."
              className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Pages</span>
            <button
              onClick={() => setIsCreating(true)}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-white/20 hover:text-white"
              title="New page"
            >
              +
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateSubmit} className="mb-3 px-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(event) => setNewDocTitle(event.target.value)}
                onBlur={() => {
                  if (!newDocTitle.trim()) {
                    setIsCreating(false);
                    setNewDocTitle("");
                  }
                }}
                autoFocus
                placeholder="Page title..."
                className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </form>
          )}

          <DroppableAny droppableId="root" type="document">
            {(providedRoot: any) => (
              <div
                ref={providedRoot.innerRef}
                {...providedRoot.droppableProps}
                className="space-y-1"
              >
                {filteredRootDocs.map((doc, idx) => (
                  <SidebarItem
                    key={doc._id}
                    document={doc}
                    allDocuments={documents}
                    level={0}
                    index={idx}
                    activeId={activeId}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMove={handleMove}
                    onOpen={openDocument}
                  />
                ))}
                {providedRoot.placeholder}
              </div>
            )}
          </DroppableAny>

          {filteredRootDocs.length === 0 && !isCreating && (
            <div className="px-2 py-12 text-center text-sm text-slate-500">
              {searchQuery ? "No pages match your search." : "No pages yet. Create your first one."}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/70 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold">
              A
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Demo User</p>
              <p className="truncate text-xs text-slate-400">demo@enfield.app</p>
            </div>
          </div>
        </div>
      </div>
    </DragDropContextAny>
  );
}

