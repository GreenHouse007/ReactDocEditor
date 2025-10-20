import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import { PdfExportDialog } from "../components/PdfExportDialog";
import { useEffect, useMemo, useRef, useState } from "react";

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [savedSelection, setSavedSelection] = useState<string[]>([]);

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
    const stored = window.localStorage.getItem("enfield:pdf-selection");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setSavedSelection(parsed.filter((item) => typeof item === "string"));
      }
    } catch (error) {
      console.warn("Failed to parse stored PDF selection", error);
    }
  }, []);

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
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <p>Document not found</p>
      </div>
    );
  }

  const defaultSelection = useMemo(() => {
    if (savedSelection.length > 0) {
      return savedSelection;
    }
    if (document._id) {
      return [document._id];
    }
    return [];
  }, [savedSelection, document._id]);

  const handleExportSelection = async (documentIds: string[]) => {
    if (documentIds.length === 0) {
      return;
    }

    try {
      setIsExporting(true);
      setIsExportOpen(false);
      const blob = await api.exportPDF(documentIds);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "enfield:pdf-selection",
          JSON.stringify(documentIds)
        );
      }
      setSavedSelection(documentIds);

      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = "enfield-export.pdf";
      window.document.body.appendChild(anchor);
      anchor.click();
      window.document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <PdfExportDialog
        isOpen={isExportOpen}
        documents={allDocuments}
        initialSelection={defaultSelection}
        onClose={() => setIsExportOpen(false)}
        onConfirm={handleExportSelection}
        currentDocumentId={document._id}
      />

      <div className="absolute right-8 top-4 flex items-center gap-4">
        <button
          onClick={() => setIsExportOpen(true)}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true" role="img">
            📄
          </span>
          {isExporting ? "Preparing PDF..." : "Export PDF"}
        </button>
        <div className="text-sm text-gray-400">
          {isSaving || updateMutation.isPending ? "Saving..." : "All changes saved"}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 pt-16">
        <input
          type="text"
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Untitled"
          className="mb-4 w-full border-none bg-transparent text-5xl font-bold focus:outline-none"
        />
      </div>

      <div className="mx-auto max-w-4xl px-8 pb-16">
        <Editor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your world..."
        />
      </div>
    </div>
  );
}

