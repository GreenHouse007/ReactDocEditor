import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { DocumentMenu } from "./menus/DocumentMenu";
import { MoveDocumentModal } from "./modals/MoveDocumentModal";
import { sortDocuments } from "../utils/documentTree";

// Workaround for type conflicts between multiple @types/react versions in the monorepo.
// Cast the DnD components to `any` so they can be used in JSX without TypeScript errors.
const DragDropContextAny = DragDropContext as any;
const DroppableAny = Droppable as any;
const DraggableAny = Draggable as any;

interface SidebarItemProps {
  document: Document;
  level: number;
  allDocuments: Document[];
  index: number;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMoveRequest: (document: Document) => void;
}

function SidebarItem({
  document,
  level,
  allDocuments,
  index,
  onRename,
  onDelete,
  onMoveRequest,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const [isExpanded, setIsExpanded] = useState(true);
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

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    setRenameValue(document.title || "Untitled");
  }, [document.title]);

  const handleRenameConfirm = async () => {
    const newTitle = renameValue.trim();
    if (!newTitle || newTitle === document.title) {
      setIsRenaming(false);
      return;
    }

    await onRename(document._id!, newTitle);
    setIsRenaming(false);
  };

  return (
    <DraggableAny draggableId={document._id!} index={index}>
      {(provided: any, snapshot: any) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={snapshot.isDragging ? "opacity-50" : ""}
        >
          {/* Wrap the item in a Droppable so we can drop onto it */}
          <DroppableAny
            droppableId={`nest-${document._id}`}
            type="document"
            isDropDisabled={false}
          >
            {(droppableProvided: any, droppableSnapshot: any) => (
              <div
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
                className={`
                ${
                  droppableSnapshot.isDraggingOver
                    ? "bg-blue-900/30 ring-2 ring-blue-500/50"
                    : ""
                }
              `}
              >
                <div
                  className={`relative flex items-center gap-2 px-3 py-2 rounded cursor-pointer group hover:bg-gray-800/60 transition-colors ${isActive ? "bg-gray-800" : ""}`}
                  style={{ paddingLeft: `${level * 12 + 8}px` }}
                  onClick={() => {
                    if (!isRenaming) {
                      navigate(`/document/${document._id}`);
                    }
                  }}
                >
                  <div
                    {...provided.dragHandleProps}
                    className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-600 group-hover:text-gray-400"
                  >
                    ⋮⋮
                  </div>

                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                      className="w-4 h-4 flex items-center justify-center hover:bg-gray-700 rounded flex-shrink-0"
                    >
                      <span className="text-xs text-gray-400">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </button>
                  ) : (
                    <div className="w-4 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        className="w-full bg-transparent border border-blue-500/60 rounded px-2 py-1 text-sm text-gray-100 focus:outline-none"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameConfirm}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRenameConfirm();
                          }
                          if (e.key === "Escape") {
                            setIsRenaming(false);
                            setRenameValue(document.title || "Untitled");
                          }
                        }}
                      />
                    ) : (
                      <span className="text-sm text-gray-200 truncate">
                        {document.title || "Untitled"}
                      </span>
                    )}
                  </div>

                  <div className="flex-shrink-0 ml-2 relative">
                    <button
                      ref={menuButtonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen((prev) => !prev);
                      }}
                      className={`w-6 h-6 flex items-center justify-center rounded text-gray-400 transition-opacity duration-150 group-hover:opacity-100 ${
                        isMenuOpen ? "opacity-100" : "opacity-0"
                      }`}
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
                {droppableProvided.placeholder}
              </div>
            )}
          </DroppableAny>

          {/* Render children */}
          {hasChildren && isExpanded && (
            <DroppableAny
              droppableId={`children-${document._id}`}
              type="document"
            >
              {(provided: any) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {children.map((child, idx) => (
                    <SidebarItem
                      key={child._id}
                      document={child}
                      level={level + 1}
                      allDocuments={allDocuments}
                      index={idx}
                      onRename={onRename}
                      onDelete={onDelete}
                      onMoveRequest={onMoveRequest}
                    />
                  ))}
                  {provided.placeholder as any}
                </div>
              )}
            </DroppableAny>
          )}
        </div>
      )}
    </DraggableAny>
  );

  interface SidebarProps {
    favorites: string[];
    setFavorites: (favorites: string[]) => void;
  }
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
  const { id: currentId } = useParams();

  void _favorites;
  void _setFavorites;

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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (variables.id === currentId) {
        queryClient.invalidateQueries({ queryKey: ["document", currentId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (currentId === id) {
        navigate("/");
      }
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    // Check if dropped onto a document (nest operation)
    if (destination.droppableId.startsWith("nest-")) {
      destParentId = destination.droppableId.replace("nest-", "");

      // Make it a child and set order to 0 (first child)
      updateMutation.mutate({
        id: draggableId,
        data: {
          parentId: destParentId,
          order: 0,
        },
      });
      return;
    }

    // Normal drop in a list
    destParentId =
      destination.droppableId === "root"
        ? null
        : destination.droppableId.replace("children-", "");

    const sourceParentId =
      source.droppableId === "root"
        ? null
        : source.droppableId.replace("children-", "");

    const newOrder = destination.index;

    // Update the dragged document
    updateMutation.mutate({
      id: draggableId,
      data: {
        parentId: destParentId,
        order: newOrder,
      },
    });

    // Adjust orders for sibling documents
    const destParentIdStr = destParentId;
    const sourceParentIdStr = sourceParentId;

    const siblings = sortDocuments(
      documents.filter((d) => (d.parentId ?? null) === destParentIdStr)
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

  const rootDocuments = sortDocuments(documents.filter((doc) => !doc.parentId));

  const filteredRootDocs = searchQuery
    ? rootDocuments.filter((doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rootDocuments;

  return (
    <DragDropContextAny onDragEnd={handleDragEnd}>
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Enfield</div>
              <div className="text-gray-400 text-xs">World Builder</div>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-200 transition-colors mb-3"
          >
            🏠 Dashboard
          </button>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full px-3 py-2 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Pages Section */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-xs text-gray-400 uppercase font-semibold">
              Pages
            </span>
            <button
              onClick={() => setIsCreating(true)}
              className="w-5 h-5 flex items-center justify-center hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
              title="Add page"
            >
              +
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreateSubmit} className="px-2 mb-2">
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                onBlur={() => {
                  if (!newDocTitle.trim()) setIsCreating(false);
                }}
                placeholder="Page title..."
                autoFocus
                className="w-full px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500"
              />
            </form>
          )}

          <DroppableAny droppableId="root" type="document">
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
            <div className="px-2 py-8 text-center text-gray-500 text-sm">
              {searchQuery
                ? "No pages found"
                : "No pages yet. Click + to create one."}
            </div>
          )}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">
                Demo User
              </div>
              <div className="text-gray-400 text-xs truncate">
                demo@enfield.app
              </div>
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
