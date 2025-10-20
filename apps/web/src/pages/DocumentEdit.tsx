import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import { ExportDocumentsModal } from "../components/ExportDocumentsModal";
import { useState, useEffect, useRef } from "react";
import { buildDocumentTree, flattenTree } from "../lib/documentTree";

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSelection, setExportSelection] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

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

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
    }
  }, [document]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("enfield-export-selection");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setExportSelection(parsed);
        }
      }
    } catch (error) {
      console.warn("Failed to restore export selection", error);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setExportSelection((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length === 0) return [id];
      return [...prev, id];
    });
  }, [id]);

  useEffect(() => {
    if (!allDocuments.length) return;
    setExportSelection((prev) =>
      prev.filter((selectedId) =>
        allDocuments.some((doc) => doc._id === selectedId)
      )
    );
  }, [allDocuments]);

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

  const handleConfirmExport = async () => {
    const availableIds = exportSelection.filter((selectedId) =>
      allDocuments.some((doc) => doc._id === selectedId)
    );

    if (availableIds.length === 0) {
      alert("Select at least one document to export.");
      return;
    }

    const orderedIds = flattenTree(buildDocumentTree(allDocuments))
      .map((node) => node._id)
      .filter((nodeId): nodeId is string => Boolean(nodeId))
      .filter((nodeId) => availableIds.includes(nodeId));

    if (orderedIds.length === 0) {
      alert("Unable to resolve the selected documents.");
      return;
    }

    setIsExporting(true);

    try {
      const blob = await api.exportPDF(orderedIds);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "enfield-export-selection",
          JSON.stringify(orderedIds)
        );
      }

      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${title || "documents"}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setExportSelection(orderedIds);
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="absolute top-4 right-8 flex items-center gap-4">
        <button
          onClick={() => setIsExportModalOpen(true)}
          disabled={isExporting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? "Exporting..." : "📄 Export PDF"}
        </button>
        <div className="text-sm text-gray-400">
          {isSaving
            ? "Saving..."
            : updateMutation.isPending
            ? "Saving..."
            : "All changes saved"}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 pt-16">
        <input
          type="text"
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Untitled"
          className="w-full text-5xl font-bold bg-transparent border-none focus:outline-none mb-4"
        />
      </div>

      <div className="max-w-4xl mx-auto px-8 pb-16">
        <Editor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your world..."
        />
      </div>

      <ExportDocumentsModal
        isOpen={isExportModalOpen}
        documents={allDocuments}
        selectedIds={exportSelection}
        onChangeSelection={setExportSelection}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleConfirmExport}
      />
    </div>
  );
}
