import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Document, UpdateDocumentDto } from "@enfield/types";
import { IconPicker } from "./IconPicker";
import { PageOptionsMenu } from "./PageOptionsMenu";

// Helper function to sort documents by order
function sortDocuments(docs: Document[]): Document[] {
  return [...docs].sort((a, b) => {
    const orderA = a.order ?? 999999;
    const orderB = b.order ?? 999999;
    return orderA - orderB;
  });
}

interface DragState {
  draggedId: string | null;
  overId: string | null;
  dropPosition: "before" | "after" | "inside" | null;
}

interface SidebarItemProps {
  document: Document;
  level: number;
  allDocuments: Document[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: "before" | "after" | "inside") => void;
  onDragEnd: () => void;
  onDrop: (
    draggedId: string,
    targetId: string,
    position: "before" | "after" | "inside"
  ) => void;
}

function SidebarItem({
  document,
  level,
  allDocuments,
  favorites,
  onToggleFavorite,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
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
  const [dragOverZone, setDragOverZone] = useState<
    "top" | "middle" | "bottom" | null
  >(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const children = sortDocuments(
    allDocuments.filter((doc) => doc.parentId === document._id)
  );
  const hasChildren = children.length > 0;
  const isActive = currentId === document._id;
  const isFavorite = favorites.includes(document._id || "");
  const isDragging = dragState.draggedId === document._id;
  const isDropTarget = dragState.overId === document._id;

  const updateIconMutation = useMutation({
    mutationFn: (icon: string) => api.updateDocument(document._id!, { icon }),
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

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    onDragStart(document._id!);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", document._id!);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!itemRef.current || dragState.draggedId === document._id) return;

    const rect = itemRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Divide into 3 zones: top 25%, middle 50%, bottom 25%
    if (y < height * 0.25) {
      setDragOverZone("top");
      onDragOver(document._id!, "before");
    } else if (y > height * 0.75) {
      setDragOverZone("bottom");
      onDragOver(document._id!, "after");
    } else {
      setDragOverZone("middle");
      onDragOver(document._id!, "inside");
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === itemRef.current) {
      setDragOverZone(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragState.draggedId && dragState.dropPosition) {
      onDrop(dragState.draggedId, document._id!, dragState.dropPosition);
    }
    setDragOverZone(null);
  };

  return (
    <div className={isDragging ? "opacity-40" : ""}>
      <div
        ref={itemRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        className="relative"
      >
        {/* Drop indicator - BEFORE */}
        {isDropTarget && dragState.dropPosition === "before" && (
          <div
            className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 z-10"
            style={{ marginLeft: `${level * 12 + 8}px` }}
          />
        )}

        {/* Drop indicator - INSIDE (highlight whole item) */}
        {isDropTarget && dragState.dropPosition === "inside" && (
          <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 rounded z-0" />
        )}

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
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing">
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
                className={isFavorite ? "text-yellow-400" : "text-gray-600"}
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

        {/* Drop indicator - AFTER */}
        {isDropTarget && dragState.dropPosition === "after" && (
          <div
            className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 z-10"
            style={{ marginLeft: `${level * 12 + 8}px` }}
          />
        )}
      </div>

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
        <div>
          {children.map((child) => (
            <SidebarItem
              key={child._id}
              document={child}
              level={level + 1}
              allDocuments={allDocuments}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
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
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    overId: null,
    dropPosition: null,
  });

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

  const handleDragStart = (id: string) => {
    setDragState({
      draggedId: id,
      overId: null,
      dropPosition: null,
    });
  };

  const handleDragOver = (
    id: string,
    position: "before" | "after" | "inside"
  ) => {
    setDragState((prev) => ({
      ...prev,
      overId: id,
      dropPosition: position,
    }));
  };

  const handleDragEnd = () => {
    setDragState({
      draggedId: null,
      overId: null,
      dropPosition: null,
    });
  };

  const handleDrop = (
    draggedId: string,
    targetId: string,
    position: "before" | "after" | "inside"
  ) => {
    console.log("Drop:", { draggedId, targetId, position });

    const draggedDoc = documents.find((d) => d._id === draggedId);
    const targetDoc = documents.find((d) => d._id === targetId);

    if (!draggedDoc || !targetDoc) return;

    if (position === "inside") {
      // Nest as child
      const targetChildren = sortDocuments(
        documents.filter((d) => d.parentId === targetId)
      );
      const newOrder = targetChildren.length;

      updateMutation.mutate({
        id: draggedId,
        data: {
          parentId: targetId,
          order: newOrder,
        },
      });
    } else {
      // Place before or after (same parent as target)
      const newParentId = targetDoc.parentId || null;
      const siblings = sortDocuments(
        documents.filter((d) => (d.parentId || null) === newParentId)
      );

      const targetIndex = siblings.findIndex((d) => d._id === targetId);
      const newOrder = position === "before" ? targetIndex : targetIndex + 1;

      // Update dragged document
      updateMutation.mutate({
        id: draggedId,
        data: {
          parentId: newParentId,
          order: newOrder,
        },
      });

      // Reorder siblings
      siblings.forEach((doc, idx) => {
        if (doc._id === draggedId) return;

        let newIdx = idx;
        if (idx >= newOrder) {
          newIdx = idx + 1;
        }

        if (newIdx !== idx) {
          updateMutation.mutate({
            id: doc._id!,
            data: { order: newIdx },
          });
        }
      });
    }
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

        <div className="space-y-0">
          {filteredRootDocs.map((doc) => (
            <SidebarItem
              key={doc._id}
              document={doc}
              level={0}
              allDocuments={documents}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          ))}
        </div>

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
  );
}
