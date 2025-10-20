import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { IconPicker } from "./IconPicker";
import { PageOptionsMenu } from "./PageOptionsMenu";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// Workaround for type conflicts between multiple @types/react versions in the monorepo.
// Cast the DnD components to `any` so they can be used in JSX without TypeScript errors.
const DragDropContextAny = DragDropContext as any;
const DroppableAny = Droppable as any;
const DraggableAny = Draggable as any;

// Helper function to sort documents by order
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
}

function SidebarItem({
  document,
  level,
  allDocuments,
  index,
  favorites,
  onToggleFavorite,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  const children = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = children.length > 0;
  const isActive = currentId === document._id;
  const isFavorite = favorites.includes(document._id || "");

  const updateIconMutation = useMutation({
    mutationFn: (icon: string) => {
      console.log("Updating icon to:", icon, "for document:", document._id);
      return api.updateDocument(document._id!, { icon });
    },
    onSuccess: () => {
      console.log("Icon update successful");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document", document._id] });
    },
    onError: (error) => {
      console.error("Icon update failed:", error);
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

  const createChildMutation = useMutation({
    mutationFn: (title: string) =>
      api.createDocument({
        title,
        authorId: "demo-user",
        parentId: document._id,
        icon: "📄",
      }),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsCreatingChild(false);
      setChildTitle("");
      setIsExpanded(true);
      navigate(`/document/${newDoc._id}`);
    },
  });

  const handleCreateChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (childTitle.trim()) {
      createChildMutation.mutate(childTitle);
    }
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
                  className={`
                  relative flex items-center gap-1 px-2 py-1 rounded cursor-pointer group
                  hover:bg-gray-800/50 transition-colors
                  ${isActive ? "bg-gray-800" : ""}
                `}
                  style={{ paddingLeft: `${level * 12 + 8}px` }}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onClick={() => navigate(`/document/${document._id}`)}
                >
                  {/* Drag handle */}
                  <div {...provided.dragHandleProps} className="flex-shrink-0">
                    <div className="w-4 h-4 flex items-center justify-center text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100">
                      ⋮⋮
                    </div>
                  </div>

                  {/* Expand/collapse arrow */}
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

                  {/* Icon */}
                  <button
                    ref={iconButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowIconPicker(true);
                    }}
                    className="text-lg hover:scale-110 transition-transform flex-shrink-0"
                  >
                    {document.icon || "📄"}
                  </button>

                  {showIconPicker && (
                    <IconPicker
                      currentIcon={document.icon || "📄"}
                      onSelect={(icon) => updateIconMutation.mutate(icon)}
                      onClose={() => setShowIconPicker(false)}
                      triggerRef={iconButtonRef.current}
                    />
                  )}

                  {/* Title */}
                  <span className="text-sm text-gray-200 truncate flex-1 min-w-0">
                    {document.title || "Untitled"}
                  </span>

                  {/* Favorite star */}
                  {isHovered && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(document._id!);
                      }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-gray-700 rounded flex-shrink-0"
                    >
                      <span
                        className={
                          isFavorite ? "text-yellow-400" : "text-gray-600"
                        }
                      >
                        {isFavorite ? "★" : "☆"}
                      </span>
                    </button>
                  )}

                  {/* Options button */}
                  {isHovered && (
                    <button
                      ref={optionsButtonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOptions(true);
                      }}
                      className="w-6 h-6 flex items-center justify-center hover:bg-gray-700 rounded flex-shrink-0"
                    >
                      <span className="text-gray-400">⋯</span>
                    </button>
                  )}

                  {showOptions && (
                    <PageOptionsMenu
                      onAddChild={() => setIsCreatingChild(true)}
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

          {/* Create child form */}
          {isCreatingChild && (
            <form
              onSubmit={handleCreateChild}
              style={{ paddingLeft: `${(level + 1) * 12 + 32}px` }}
              className="px-2 py-1"
            >
              <input
                type="text"
                value={childTitle}
                onChange={(e) => setChildTitle(e.target.value)}
                onBlur={() => {
                  if (!childTitle.trim()) setIsCreatingChild(false);
                }}
                placeholder="Page title..."
                autoFocus
                className="w-full px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-700 focus:outline-none focus:border-blue-500"
              />
            </form>
          )}

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
                      favorites={favorites}
                      onToggleFavorite={onToggleFavorite}
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

export function Sidebar({ favorites, setFavorites }: SidebarProps) {
  const navigate = useNavigate();
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

  const toggleFavorite = (id: string) => {
    setFavorites(
      favorites.includes(id)
        ? favorites.filter((fav) => fav !== id)
        : [...favorites, id]
    );
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
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
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
    </DragDropContextAny>
  );
}
