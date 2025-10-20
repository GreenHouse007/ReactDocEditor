import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { PageOptionsMenu } from "./PageOptionsMenu";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { MoveDocumentModal } from "./MoveDocumentModal";
import { sortDocuments } from "../lib/documentTree";

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
  onRequestMove: (document: Document) => void;
}

function SidebarItem({
  document,
  level,
  allDocuments,
  index,
  onRequestMove,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title || "");
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const children = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = children.length > 0;
  const isActive = currentId === document._id;
  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(document.title || "");
    }
  }, [document.title, isRenaming]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const renameMutation = useMutation({
    mutationFn: (title: string) =>
      api.updateDocument(document._id!, {
        title,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", document._id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteDocument(document._id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (currentId === document._id) {
        navigate("/");
      }
    },
  });

  const handleRenameSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const nextTitle = renameValue.trim();

    if (!nextTitle) {
      setRenameValue(document.title || "");
      setIsRenaming(false);
      return;
    }

    if (nextTitle === (document.title || "")) {
      setIsRenaming(false);
      return;
    }

    renameMutation.mutate(nextTitle, {
      onSuccess: () => {
        setIsRenaming(false);
      },
    });
  };

  const handleRenameCancel = () => {
    setRenameValue(document.title || "");
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
                  className={`relative flex items-center rounded px-2 py-1 pr-9 transition-colors group cursor-pointer
                  ${isActive ? "bg-gray-800" : "hover:bg-gray-800/50"}
                `}
                  style={{ paddingLeft: `${level * 16 + 12}px` }}
                  onClick={() => {
                    if (!isRenaming) {
                      navigate(`/document/${document._id}`);
                    }
                  }}
                >
                  <div
                    {...provided.dragHandleProps}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="mr-2 flex h-5 w-5 items-center justify-center select-none text-xs text-gray-600 group-hover:text-gray-400"
                    aria-label="Drag handle"
                  >
                    ⋮⋮
                  </div>

                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded((prev) => !prev);
                      }}
                      className="mr-2 flex h-5 w-5 items-center justify-center rounded text-xs text-gray-400 hover:bg-gray-700"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  ) : (
                    <div className="mr-2 w-5" />
                  )}

                  {isRenaming ? (
                    <form
                      onSubmit={handleRenameSubmit}
                      className="flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRenameCancel();
                          }
                        }}
                        className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                      />
                    </form>
                  ) : (
                    <span className="flex-1 truncate text-sm text-gray-200">
                      {document.title || "Untitled"}
                    </span>
                  )}

                  <button
                    ref={optionsButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOptions(true);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-200"
                    aria-label="Document actions"
                  >
                    ⋮
                  </button>

                  {showOptions && (
                    <PageOptionsMenu
                      onRename={() => setIsRenaming(true)}
                      onMove={() => onRequestMove(document)}
                      onDelete={() => {
                        if (confirm(`Delete "${document.title}"?`)) {
                          deleteMutation.mutate();
                        }
                      }}
                      onClose={() => setShowOptions(false)}
                      triggerRef={optionsButtonRef.current}
                    />
                  )}
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
                      onRequestMove={onRequestMove}
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

}

export function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moveTarget, setMoveTarget] = useState<Document | null>(null);

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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDocTitle.trim()) {
      createMutation.mutate(newDocTitle);
    }
  };

  const handleDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    console.log("Drag ended:", { destination, source, draggableId });

    if (!destination) {
      console.log("No destination - dropped outside");
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      console.log("No movement detected");
      return;
    }

    let destParentId: string | null = null;

    // Check if dropped onto a document (nest operation)
    if (destination.droppableId.startsWith("nest-")) {
      destParentId = destination.droppableId.replace("nest-", "");
      console.log("Nesting document under:", destParentId);

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

    console.log("Moving document:", {
      documentId: draggableId,
      fromParent: sourceParentId,
      toParent: destParentId,
      newIndex: destination.index,
    });

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

  const handleMoveConfirm = (destinationParentId: string | null) => {
    if (!moveTarget?._id) {
      setMoveTarget(null);
      return;
    }

    const siblings = sortDocuments(
      documents.filter(
        (doc) => (doc.parentId ?? null) === (destinationParentId ?? null)
      )
    ).filter((doc) => doc._id !== moveTarget._id);

    updateMutation.mutate({
      id: moveTarget._id,
      data: {
        parentId: destinationParentId,
        order: siblings.length,
      },
    });

    setMoveTarget(null);
  };

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
                    onRequestMove={(target) => setMoveTarget(target)}
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
          documents={documents}
          document={moveTarget}
          onClose={() => setMoveTarget(null)}
          onMove={handleMoveConfirm}
        />
      )}
    </DragDropContextAny>
  );
}
