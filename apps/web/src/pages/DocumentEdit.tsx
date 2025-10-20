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
  type ChangeEvent,
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

  const titleTimerRef = useRef<NodeJS.Timeout>();
  const contentTimerRef = useRef<NodeJS.Timeout>();

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

  const handleIndexChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextIndexId = event.target.value;
    if (!nextIndexId || nextIndexId === currentIndexId) {
      return;
    }
    setSelectedIndexId(nextIndexId);
    navigate(`/document/${nextIndexId}`);
  };

  const saveStatus =
    isSaving || updateMutation.isPending ? "Saving..." : "All changes saved";

  const currentIndexTitle = currentIndex?.title || "Untitled Index";

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex justify-end gap-4 px-8 pt-6 text-sm text-gray-400">
        <button
          onClick={handleExportPDF}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500"
        >
          Export PDF
        </button>
        <div>{saveStatus}</div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-8 pt-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span className="uppercase text-xs tracking-wide text-gray-500">Index</span>
          <h2 className="text-lg font-semibold text-white">{currentIndexTitle}</h2>
          {indexes.length > 0 && (
            <select
              value={currentIndexId ?? ""}
              onChange={handleIndexChange}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {indexes.map((indexDoc) => (
                <option key={indexDoc._id} value={indexDoc._id}>
                  {indexDoc.title || "Untitled Index"}
                </option>
              ))}
            </select>
          )}
        </div>

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
