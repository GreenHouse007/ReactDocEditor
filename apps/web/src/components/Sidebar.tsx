import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { DocumentActionMenu } from "./DocumentActionMenu";
import { MoveDocumentDialog } from "./MoveDocumentDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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

interface SidebarItemProps {
  document: Document;
  level: number;
  allDocuments: Document[];
  index: number;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMoveRequest: (id: string) => void;
}

function SidebarItem({
  document,
  level,
  allDocuments,
  index,
  favorites,
  onToggleFavorite,
  onRename,
  onDelete,
  onMoveRequest,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title || "Untitled");
  const [showMenu, setShowMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRenameValue(document.title || "Untitled");
  }, [document.title]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const children = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = children.length > 0;
  const isActive = currentId === document._id;
  const isFavorite = favorites.includes(document._id || "");

  const handleNavigate = () => {
    if (isRenaming) return;
    navigate(`/document/${document._id}`);
  };

  const handleRenameCommit = () => {
    const trimmed = renameValue.trim();
    if (!document._id) {
      setIsRenaming(false);
      return;
    }
    if (trimmed && trimmed !== document.title) {
      onRename(document._id, trimmed);
    }
    setRenameValue(trimmed || document.title || "Untitled");
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameCommit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setRenameValue(document.title || "Untitled");
      setIsRenaming(false);
    }
  };

  return (
    <DraggableAny draggableId={document._id!} index={index}>
      {(provided: any, snapshot: any) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`transition-opacity ${snapshot.isDragging ? "opacity-50" : ""}`}
        >
          <DroppableAny droppableId={`nest-${document._id}`} type="document" isDropDisabled={false}>
            {(droppableProvided: any, droppableSnapshot: any) => (
              <div
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className={`${
                  droppableSnapshot.isDraggingOver
                    ? "rounded-lg border border-blue-500/40 bg-blue-900/20"
                    : ""
                }`}
              >
                <div
                  className={`group relative flex items-center gap-2 rounded-xl px-2 py-2 transition-all duration-150 hover:bg-white/5 ${
                    isActive ? "bg-white/10" : ""
                  }`}
                  style={{ paddingLeft: `${level * 14 + 12}px` }}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onClick={handleNavigate}
                >
                  {hasChildren ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsExpanded((prev) => !prev);
                      }}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded hover:bg-white/10"
                    >
                      <span className="text-xs text-gray-400">{isExpanded ? "▼" : "▶"}</span>
                    </button>
                  ) : (
                    <span className="h-6 w-6 flex-shrink-0" />
                  )}

                  <div
                    className="flex min-w-0 flex-1 items-center gap-2"
                    {...provided.dragHandleProps}
                  >
                    {isRenaming ? (
                      <input
                        ref={inputRef}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={handleRenameCommit}
                        onKeyDown={handleRenameKeyDown}
                        onClick={(event) => event.stopPropagation()}
                        className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white focus:border-blue-400 focus:outline-none"
                      />
                    ) : (
                      <span className="cursor-grab text-sm font-medium text-gray-200 transition active:cursor-grabbing">
                        {document.title || "Untitled"}
                      </span>
                    )}
                  </div>

                  {isHovered && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleFavorite(document._id!);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-yellow-400 transition hover:bg-yellow-400/10"
                    >
                      {isFavorite ? "★" : "☆"}
                    </button>
                  )}

                  {isHovered && (
                    <button
                      ref={menuButtonRef}
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowMenu(true);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
                    >
                      ⋮
                    </button>
                  )}

                  {showMenu && (
                    <DocumentActionMenu
                      onRename={() => setIsRenaming(true)}
                      onMove={() => onMoveRequest(document._id!)}
                      onDelete={() => onDelete(document._id!)}
                      onClose={() => setShowMenu(false)}
                      triggerRef={menuButtonRef.current}
                    />
                  )}
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
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                    isExpanded ? "max-h-[1000px]" : "max-h-0"
                  }`}
                >
                  <div className="space-y-0.5 py-0.5">
                    {children.map((child, idx) => (
                      <SidebarItem
                        key={child._id}
                        document={child}
                        level={level + 1}
                        allDocuments={allDocuments}
                        index={idx}
                        favorites={favorites}
                        onToggleFavorite={onToggleFavorite}
                        onRename={onRename}
                        onDelete={onDelete}
                        onMoveRequest={onMoveRequest}
                      />
                    ))}
                  </div>
                  {providedChildren.placeholder as any}
                </div>
              )}
            </DroppableAny>
          )}
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
  const { id: currentDocumentId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document"] });
      if (currentDocumentId === deletedId) {
        navigate("/");
      }
    },
  });

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newDocTitle.trim()) {
      createMutation.mutate(newDocTitle);
    }
  };

  const handleDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    let destParentId: string | null = null;

    if (destination.droppableId.startsWith("nest-")) {
      destParentId = destination.droppableId.replace("nest-", "");

      updateMutation.mutate({
        id: draggableId,
        data: {
          parentId: destParentId,
          order: 0,
        },
      });
      return;
    }

    destParentId =
      destination.droppableId === "root"
        ? null
        : destination.droppableId.replace("children-", "");

    const sourceParentId =
      source.droppableId === "root"
        ? null
        : source.droppableId.replace("children-", "");

    const newOrder = destination.index;

    updateMutation.mutate({
      id: draggableId,
      data: {
        parentId: destParentId,
        order: newOrder,
      },
    });

    const destParentIdStr = destParentId;
    const sourceParentIdStr = sourceParentId;

    const siblings = sortDocuments(
      documents.filter((doc) => (doc.parentId ?? null) === destParentIdStr)
    );

    siblings.forEach((doc, idx) => {
      if (doc._id === draggableId) return;

      let adjustedIdx = idx;

      if (destParentIdStr === sourceParentIdStr) {
        if (source.index < destination.index) {
          if (idx > source.index && idx <= destination.index) {
            adjustedIdx = idx - 1;
          }
        } else if (source.index > destination.index) {
          if (idx >= destination.index && idx < source.index) {
            adjustedIdx = idx + 1;
          }
        }
      }

      if (adjustedIdx >= newOrder) {
        updateMutation.mutate({
          id: doc._id!,
          data: { order: adjustedIdx + 1 },
        });
      }
    });
  };

  const toggleFavorite = (id: string) => {
    setFavorites(
      favorites.includes(id)
        ? favorites.filter((fav) => fav !== id)
        : [...favorites, id]
    );
  };

  const handleRename = (id: string, title: string) => {
    updateMutation.mutate({
      id,
      data: { title },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this document?")) return;
    deleteMutation.mutate(id);
  };

  const rootDocuments = sortDocuments(documents.filter((doc) => !doc.parentId));

  const filteredRootDocs = searchQuery
    ? rootDocuments.filter((doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootDocuments;

  return (
    <DragDropContextAny onDragEnd={handleDragEnd}>
      <div className="flex h-screen w-64 flex-col border-r border-white/10 bg-gray-950/80 backdrop-blur-lg">
        <div className="border-b border-white/5 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Enfield</div>
              <div className="text-xs text-gray-400">World Builder</div>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="mb-3 w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10"
          >
            Dashboard
          </button>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search pages..."
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Documents
            </span>
            <button
              onClick={() => setIsCreating(true)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
              title="Add page"
            >
              +
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateSubmit} className="px-2 pb-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(event) => setNewDocTitle(event.target.value)}
                onBlur={() => {
                  if (!newDocTitle.trim()) setIsCreating(false);
                }}
                placeholder="Page title..."
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </form>
          )}

          <DroppableAny droppableId="root" type="document">
            {(provided: any) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0.5">
                {filteredRootDocs.map((doc, idx) => (
                  <SidebarItem
                    key={doc._id}
                    document={doc}
                    level={0}
                    allDocuments={documents}
                    index={idx}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMoveRequest={(id) => setMovingDocumentId(id)}
                  />
                ))}
                {provided.placeholder as any}
              </div>
            )}
          </DroppableAny>

          {filteredRootDocs.length === 0 && !isCreating && (
            <div className="px-2 py-8 text-center text-sm text-gray-500">
              {searchQuery ? "No pages found" : "No pages yet. Click + to create one."}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">Demo User</div>
              <div className="truncate text-xs text-gray-400">demo@enfield.app</div>
            </div>
          </div>
        </div>
      </div>
      <MoveDocumentDialog
        documents={documents}
        documentId={movingDocumentId || ""}
        isOpen={Boolean(movingDocumentId)}
        onClose={() => setMovingDocumentId(null)}
        onMove={(parentId) => {
          if (!movingDocumentId) return;
          updateMutation.mutate({
            id: movingDocumentId,
            data: { parentId, order: 0 },
          });
        }}
      />
    </DragDropContextAny>
  );
}
