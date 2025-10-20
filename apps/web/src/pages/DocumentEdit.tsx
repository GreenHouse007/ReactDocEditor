import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type FormEvent,
} from "react";
import { useIndexContext } from "../contexts/IndexContext";
import type { Document } from "@enfield/types";

function sortIndexes(documents: Document[]): Document[] {
  return [...documents]
    .filter((doc) => !doc.parentId)
    .sort((a, b) => {
      const orderA = a.order ?? 999999;
      const orderB = b.order ?? 999999;
      return orderA - orderB;
    });
}

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedIndexId, setSelectedIndexId } = useIndexContext();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceTitle, setNewWorkspaceTitle] = useState("");

  const titleTimerRef = useRef<NodeJS.Timeout>();
  const contentTimerRef = useRef<NodeJS.Timeout>();
  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const closeWorkspaceMenu = useCallback(() => {
    setIsWorkspaceMenuOpen(false);
    setIsCreatingWorkspace(false);
    setNewWorkspaceTitle("");
  }, []);

  const { data: document, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  const { data: allDocuments = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });

  const documentMap = useMemo(() => {
    const map = new Map<string, Document>();
    allDocuments.forEach((doc) => {
      if (doc._id) {
        map.set(doc._id, doc);
      }
    });
    if (document?._id) {
      map.set(document._id, document);
    }
    return map;
  }, [allDocuments, document]);

  const resolveRootId = useCallback(
    (docId: string | undefined): string | null => {
      if (!docId) {
        return null;
      }

      let currentId: string | null = docId;
      const visited = new Set<string>();

      while (currentId) {
        if (visited.has(currentId)) {
          break;
        }
        visited.add(currentId);

        const currentDoc = currentId === document?._id
          ? document
          : documentMap.get(currentId);

        if (!currentDoc) {
          break;
        }

        if (!currentDoc.parentId) {
          return currentDoc._id ?? null;
        }

        currentId = currentDoc.parentId ?? null;
      }

      return currentId;
    },
    [document, documentMap]
  );

  const indexes = useMemo(() => sortIndexes(allDocuments), [allDocuments]);

  const currentIndexId = useMemo(() => {
    if (!document?._id) {
      return null;
    }
    return resolveRootId(document._id);
  }, [document, resolveRootId]);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
    }
  }, [document]);

  useEffect(() => {
    if (currentIndexId && currentIndexId !== selectedIndexId) {
      setSelectedIndexId(currentIndexId);
    }
  }, [currentIndexId, selectedIndexId, setSelectedIndexId]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(event.target as Node)
      ) {
        closeWorkspaceMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWorkspaceMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeWorkspaceMenu, isWorkspaceMenuOpen]);

  const currentIndex = useMemo(() => {
    if (!currentIndexId) {
      return null;
    }
    return (
      indexes.find((indexDoc) => indexDoc._id === currentIndexId) ||
      documentMap.get(currentIndexId) ||
      null
    );
  }, [indexes, currentIndexId, documentMap]);

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; content?: any }) =>
      api.updateDocument(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsSaving(false);
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: (workspaceTitle: string) =>
      api.createDocument({
        title: workspaceTitle,
        authorId: "demo-user",
      }),
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      closeWorkspaceMenu();
      if (newWorkspace?._id) {
        setSelectedIndexId(newWorkspace._id);
        navigate(`/document/${newWorkspace._id}`);
      }
    },
    onError: (error) => {
      console.error("Failed to create workspace:", error);
      alert("Unable to create workspace. Please try again.");
    },
  });

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsSaving(true);

    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
    }

    titleTimerRef.current = setTimeout(() => {
      updateMutation.mutate({ title: newTitle });
    }, 3000);
  };

  const handleContentChange = (newContent: any) => {
    setContent(newContent);
    setIsSaving(true);

    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    contentTimerRef.current = setTimeout(() => {
      updateMutation.mutate({ content: newContent });
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Document not found</p>
      </div>
    );
  }

  const handleExportPDF = async () => {
    try {
      const blob = await api.exportPDF(title, content, document.icon);
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${title || "document"}.pdf`;
      window.document.body.appendChild(anchor);
      anchor.click();
      window.document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    }
  };

  const handleWorkspaceSelect = (workspaceId: string | null | undefined) => {
    if (!workspaceId) {
      return;
    }

    if (workspaceId === currentIndexId) {
      closeWorkspaceMenu();
      return;
    }

    setSelectedIndexId(workspaceId);
    closeWorkspaceMenu();
    navigate(`/document/${workspaceId}`);
  };

  const handleCreateWorkspaceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newWorkspaceTitle.trim()) {
      return;
    }

    createWorkspaceMutation.mutate(newWorkspaceTitle.trim());
  };

  const saveStatus =
    isSaving || updateMutation.isPending ? "Saving..." : "All changes saved";

  const currentIndexTitle = currentIndex?.title || "No workspace selected";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-8 pt-6">
        <div className="relative" ref={workspaceMenuRef}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (isWorkspaceMenuOpen) {
                  closeWorkspaceMenu();
                } else {
                  setIsCreatingWorkspace(false);
                  setNewWorkspaceTitle("");
                  setIsWorkspaceMenuOpen(true);
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-800 text-xl text-gray-200 transition-colors hover:bg-gray-700"
              aria-haspopup="true"
              aria-expanded={isWorkspaceMenuOpen}
              aria-label="Choose workspace"
              type="button"
            >
              ☰
            </button>
            <h2 className="text-lg font-semibold text-white">{currentIndexTitle}</h2>
          </div>

          {isWorkspaceMenuOpen && (
            <div className="absolute left-0 z-20 mt-3 w-72 rounded-lg border border-gray-700 bg-gray-800 shadow-xl">
              <div className="border-b border-gray-700 px-4 py-3">
                <span className="text-xs font-semibold uppercase text-gray-400">
                  Workspaces
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto px-3 py-2">
                {indexes.length > 0 ? (
                  <ul className="space-y-1">
                    {indexes.map((indexDoc) => (
                      <li key={indexDoc._id}>
                        <button
                          type="button"
                          onClick={() => handleWorkspaceSelect(indexDoc._id)}
                          className={`w-full rounded px-2 py-2 text-left text-sm transition-colors ${
                            currentIndexId === indexDoc._id
                              ? "bg-blue-600 text-white"
                              : "text-gray-200 hover:bg-gray-700"
                          }`}
                        >
                          {indexDoc.title || "Untitled Workspace"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-6 text-sm text-gray-400">
                    No workspaces yet.
                  </div>
                )}
              </div>
              <div className="border-t border-gray-700 p-4">
                {isCreatingWorkspace ? (
                  <form
                    onSubmit={handleCreateWorkspaceSubmit}
                    className="space-y-3"
                  >
                    <input
                      type="text"
                      value={newWorkspaceTitle}
                      onChange={(event) => setNewWorkspaceTitle(event.target.value)}
                      placeholder="Workspace title..."
                      autoFocus
                      className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingWorkspace(false);
                          setNewWorkspaceTitle("");
                        }}
                        className="rounded px-3 py-1 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createWorkspaceMutation.isPending}
                        className="rounded bg-blue-600 px-3 py-1 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingWorkspace(true);
                      setNewWorkspaceTitle("");
                    }}
                    className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
                  >
                    + New workspace
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-400">
          <button
            onClick={handleExportPDF}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500"
            type="button"
          >
            Export PDF
          </button>
          <div>{saveStatus}</div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-8 pt-10">
        <input
          type="text"
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Untitled"
          className="w-full border-none bg-transparent text-5xl font-bold focus:outline-none"
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-8 pb-16">
        <Editor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your world..."
        />
      </div>
    </div>
  );
}
