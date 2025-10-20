import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  type Dispatch,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { DocumentMenu } from "./menus/DocumentMenu";
import { MoveDocumentModal } from "./modals/MoveDocumentModal";
import { collectDescendantIds, sortDocuments } from "../utils/documentTree";

// Workaround for type conflicts between multiple @types/react versions in the monorepo.
// Cast the DnD components to `any` so they can be used in JSX without TypeScript errors.
const DragDropContextAny = DragDropContext as any;
const DroppableAny = Droppable as any;
const DraggableAny = Draggable as any;

interface SidebarProps {
  favorites: string[];
  setFavorites: (favorites: string[]) => void;
}

interface SidebarItemProps {
  document: Document;
  level: number;
  allDocuments: Document[];
  index: number;
  expandedState: Record<string, boolean>;
  setExpandedState: Dispatch<SetStateAction<Record<string, boolean>>>;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMoveRequest: (document: Document) => void;
}

function SidebarItem({
  document,
  level,
  allDocuments,
  index,
  expandedState,
  setExpandedState,
  onRename,
  onDelete,
  onMoveRequest,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title || "Untitled");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const children = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = children.length > 0;
  const isActive = currentId === document._id;
  const isExpanded = expandedState[document._id!] ?? true;

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    setRenameValue(document.title || "Untitled");
  }, [document.title]);

  const toggleExpand = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      setExpandedState((prev) => ({
        ...prev,
        [document._id!]: !(prev[document._id!] ?? true),
      }));
    },
    [document._id, setExpandedState]
  );

  const handleRenameConfirm = useCallback(async () => {
    const newTitle = renameValue.trim();
    if (!newTitle || newTitle === (document.title || "")) {
      setIsRenaming(false);
      setRenameValue(document.title || "Untitled");
      return;
    }

    await onRename(document._id!, newTitle);
    setIsRenaming(false);
  }, [document._id, document.title, onRename, renameValue]);

  return (
    <DraggableAny draggableId={document._id!} index={index}>
      {(provided: any, snapshot: any) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={provided.draggableProps?.style}
        >
          <div
            className={`group relative flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors
              ${isActive ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-800/70"}
              ${snapshot.isDragging ? "ring-2 ring-blue-500/50 bg-gray-800/80" : ""}
              ${snapshot.combineTargetFor ? "ring-2 ring-blue-400/60" : ""}`}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
            onClick={() => {
              if (!isRenaming) {
                navigate(`/document/${document._id}`);
              }
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={toggleExpand}
                className={`flex h-5 w-5 items-center justify-center rounded transition-colors
                  ${isExpanded ? "text-gray-300" : "text-gray-500"}
                  hover:bg-gray-700/60`}
              >
                <span
                  className={`text-xs transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                >
                  ▸
                </span>
              </button>
            ) : (
              <div className="h-5 w-5" />
            )}

            <div
              {...provided.dragHandleProps}
              onClick={(event) => event.stopPropagation()}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-700/70 hover:text-gray-200"
            >
              <span className="text-base leading-none">⋮⋮</span>
            </div>

            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  className="w-full rounded border border-blue-500/60 bg-transparent px-2 py-1 text-sm text-gray-100 focus:outline-none"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleRenameConfirm();
                    }
                    if (event.key === "Escape") {
                      setIsRenaming(false);
                      setRenameValue(document.title || "Untitled");
                    }
                  }}
                />
              ) : (
                <span className="block truncate text-sm text-gray-200">
                  {document.title || "Untitled"}
                </span>
              )}
            </div>

            <div className="relative ml-1 flex shrink-0">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsMenuOpen((prev) => !prev);
                }}
                className={`flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-opacity duration-150
                  ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <span className="text-lg leading-none">⋮</span>
              </button>

              <DocumentMenu
                isOpen={isMenuOpen}
                anchorRef={menuButtonRef}
                onRequestClose={() => setIsMenuOpen(false)}
                onRename={() => {
                  setIsMenuOpen(false);
                  setRenameValue(document.title || "Untitled");
                  setIsRenaming(true);
                }}
                onDelete={() => {
                  setIsMenuOpen(false);
                  if (confirm(`Delete "${document.title || "Untitled"}"?`)) {
                    onDelete(document._id!);
                  }
                }}
                onMove={() => {
                  setIsMenuOpen(false);
                  onMoveRequest(document);
                }}
              />
            </div>
          </div>

          <DroppableAny
            droppableId={`children-${document._id}`}
            type="document"
            isCombineEnabled
            isDropDisabled={!isExpanded}
          >
            {(droppableProvided: any, droppableSnapshot: any) => (
              <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                {isExpanded && (
                  <div className="space-y-0.5">
                    {children.map((child, childIndex) => (
                      <SidebarItem
                        key={child._id}
                        document={child}
                        level={level + 1}
                        allDocuments={allDocuments}
                        index={childIndex}
                        expandedState={expandedState}
                        setExpandedState={setExpandedState}
                        onRename={onRename}
                        onDelete={onDelete}
                        onMoveRequest={onMoveRequest}
                      />
                    ))}
                    {droppableProvided.placeholder as any}
                    {children.length === 0 && droppableSnapshot.isDraggingOver && (
                      <div
                        className="rounded border border-dashed border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100"
                        style={{ marginLeft: `${(level + 1) * 16 + 12}px` }}
                      >
                        Drop to create a sub-page
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </DroppableAny>
        </div>
      )}
    </DraggableAny>
  );
}

export function Sidebar({ favorites: _favorites, setFavorites: _setFavorites }: SidebarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moveTarget, setMoveTarget] = useState<Document | null>(null);
  const [moveParentId, setMoveParentId] = useState<string | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isMoveLoading, setIsMoveLoading] = useState(false);
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});
  const { id: currentId } = useParams();

  void _favorites;
  void _setFavorites;

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });

  const documentsById = useMemo(() => {
    return new Map((documents ?? []).map((doc) => [doc._id!, doc]));
  }, [documents]);

  useEffect(() => {
    if (!currentId) return;
    setExpandedState((prev) => {
      const next = { ...prev };
      let cursor = documentsById.get(currentId)?.parentId ?? null;
      while (cursor) {
        next[cursor] = true;
        cursor = documentsById.get(cursor)?.parentId ?? null;
      }
      return next;
    });
  }, [currentId, documentsById]);

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api.createDocument({
        title,
        authorId: "demo-user",
        icon: "📄",
      }),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsCreating(false);
      setNewDocTitle("");
      navigate(`/document/${document._id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentDto }) =>
      api.updateDocument(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (variables.id === currentId) {
        queryClient.invalidateQueries({ queryKey: ["document", currentId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (currentId === id) {
        navigate("/");
      }
    },
  });

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (newDocTitle.trim()) {
      createMutation.mutate(newDocTitle);
    }
  };

  const resequenceSiblings = useCallback(
    async (parentId: string | null, excludeId?: string) => {
      const siblings = sortDocuments(
        documents.filter(
          (doc) => (doc.parentId ?? null) === parentId && doc._id !== excludeId
        )
      );

      for (let index = 0; index < siblings.length; index += 1) {
        const sibling = siblings[index];
        if (!sibling?._id) continue;
        if ((sibling.order ?? index) !== index) {
          await updateMutation.mutateAsync({
            id: sibling._id,
            data: { order: index },
          });
        }
      }
    },
    [documents, updateMutation]
  );

  const handleDragEnd = useCallback(
    async (result: any) => {
      try {
        const { destination, source, draggableId, combine } = result;
        if (!draggableId) return;

        const draggedDoc = documents.find((doc) => doc._id === draggableId);
        if (!draggedDoc) return;

        const sourceParentId = draggedDoc.parentId ?? null;

        if (combine) {
          const targetId: string | undefined = combine.draggableId;
          if (!targetId || targetId === draggableId) {
            return;
          }

          const invalidTargets = collectDescendantIds(documents, draggableId);
          if (invalidTargets.has(targetId)) {
            return;
          }

          const targetChildren = sortDocuments(
            documents.filter((doc) => (doc.parentId ?? null) === targetId)
          );

          await updateMutation.mutateAsync({
            id: draggableId,
            data: { parentId: targetId, order: targetChildren.length },
          });

          setExpandedState((prev) => ({ ...prev, [targetId]: true }));

          await resequenceSiblings(sourceParentId, draggableId);
          return;
        }

        if (!destination) {
          return;
        }

        const destinationParentId =
          destination.droppableId === "root"
            ? null
            : destination.droppableId.replace("children-", "");

        if (
          destinationParentId === sourceParentId &&
          destination.index === source.index
        ) {
          return;
        }

        const siblings = sortDocuments(
          documents.filter(
            (doc) =>
              (doc.parentId ?? null) === destinationParentId &&
              doc._id !== draggableId
          )
        );

        const insertionIndex = Math.max(0, destination.index);
        siblings.splice(insertionIndex, 0, {
          ...draggedDoc,
          parentId: destinationParentId ?? undefined,
        });

        if (destinationParentId) {
          setExpandedState((prev) => ({ ...prev, [destinationParentId]: true }));
        }

        for (let index = 0; index < siblings.length; index += 1) {
          const sibling = siblings[index];
          if (!sibling?._id) continue;

          if (sibling._id === draggableId) {
            await updateMutation.mutateAsync({
              id: draggableId,
              data: { parentId: destinationParentId, order: index },
            });
          } else if ((sibling.order ?? index) !== index) {
            await updateMutation.mutateAsync({
              id: sibling._id,
              data: { order: index },
            });
          }
        }

        if (sourceParentId !== destinationParentId) {
          await resequenceSiblings(sourceParentId, draggableId);
        }
      } catch (error) {
        console.error("Failed to reorder documents", error);
      }
    },
    [documents, resequenceSiblings, setExpandedState, updateMutation]
  );

  const rootDocuments = sortDocuments(documents.filter((doc) => !doc.parentId));

  const filteredRootDocs = searchQuery
    ? rootDocuments.filter((doc) =>
        (doc.title || "Untitled")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    : rootDocuments;

  return (
    <DragDropContextAny onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-64 flex-col border-r border-gray-800 bg-gray-900">
        {/* Header */}
        <div className="border-b border-gray-800 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-white font-bold">E</span>
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

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pages..."
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Pages Section */}
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
                  if (!newDocTitle.trim()) setIsCreating(false);
                }}
                placeholder="Page title..."
                autoFocus
                className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </form>
          )}

          <DroppableAny droppableId="root" type="document" isCombineEnabled>
            {(provided: any) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-0.5"
              >
                {filteredRootDocs.map((doc, idx) => (
                  <SidebarItem
                    key={doc._id}
                    document={doc}
                    level={0}
                    allDocuments={documents}
                    index={idx}
                    expandedState={expandedState}
                    setExpandedState={setExpandedState}
                    onRename={async (id, title) => {
                      await updateMutation.mutateAsync({
                        id,
                        data: { title },
                      });
                    }}
                    onDelete={async (id) => {
                      await deleteMutation.mutateAsync(id);
                    }}
                    onMoveRequest={(documentToMove) => {
                      setMoveTarget(documentToMove);
                      setMoveParentId(documentToMove.parentId ?? null);
                      setIsMoveModalOpen(true);
                    }}
                  />
                ))}
                {provided.placeholder as any}
              </div>
            )}
          </DroppableAny>

          {filteredRootDocs.length === 0 && !isCreating && (
            <div className="px-2 py-8 text-center text-sm text-gray-500">
              {searchQuery
                ? "No pages found"
                : "No pages yet. Click + to create one."}
            </div>
          )}
        </div>

        {/* User Section */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500">
              <span className="text-sm font-semibold text-white">A</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                Demo User
              </div>
              <div className="truncate text-xs text-gray-400">demo@enfield.app</div>
            </div>
          </div>
        </div>
      </div>
      {moveTarget && (
        <MoveDocumentModal
          isOpen={isMoveModalOpen}
          isProcessing={isMoveLoading}
          documents={documents}
          document={moveTarget}
          initialParentId={moveParentId}
          onClose={() => {
            if (!isMoveLoading) {
              setIsMoveModalOpen(false);
              setMoveTarget(null);
            }
          }}
          onConfirm={async (parentId) => {
            if (!moveTarget?._id) return;
            setIsMoveLoading(true);
            try {
              const siblings = sortDocuments(
                documents.filter((doc) =>
                  doc._id === moveTarget._id
                    ? false
                    : (doc.parentId ?? null) === parentId
                )
              );

              await updateMutation.mutateAsync({
                id: moveTarget._id,
                data: {
                  parentId: parentId ?? null,
                  order: siblings.length,
                },
              });
              setIsMoveModalOpen(false);
              setMoveTarget(null);
            } finally {
              setIsMoveLoading(false);
            }
          }}
        />
      )}
    </DragDropContextAny>
  );
}
