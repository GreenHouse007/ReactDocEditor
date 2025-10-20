import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import { useState, useEffect, useRef } from "react";
import { ExportPdfModal } from "../components/modals/ExportPdfModal";
import { getOrderedDocumentIds } from "../utils/documentTree";

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    new Set<string>()
  );
  const [isExporting, setIsExporting] = useState(false);

  // Timers for debouncing
  const titleTimerRef = useRef<NodeJS.Timeout>();
  const contentTimerRef = useRef<NodeJS.Timeout>();

  // Fetch document
  const { data: document, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  const { data: allDocuments = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });

  // Update local state when document loads
  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
    }
  }, [document]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; content?: any }) =>
      api.updateDocument(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setIsSaving(false);
    },
  });

  // Debounced title save (3 seconds)
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setIsSaving(true);

    // Clear existing timer
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
    }

    // Set new timer
    titleTimerRef.current = setTimeout(() => {
      updateMutation.mutate({ title: newTitle });
    }, 3000);
  };

  // Debounced content save (3 seconds)
  const handleContentChange = (newContent: any) => {
    setContent(newContent);
    setIsSaving(true);

    // Clear existing timer
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    // Set new timer
    contentTimerRef.current = setTimeout(() => {
      updateMutation.mutate({ content: newContent });
    }, 3000);
  };

  // Cleanup timers on unmount
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

  const openExportModal = () => {
    const nextSelection = new Set<string>();
    if (id) {
      nextSelection.add(id);
    }
    setSelectedDocumentIds(nextSelection);
    setIsExportModalOpen(true);
  };

  const toggleSelectedDocument = (docId: string) => {
    if (!docId) return;
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const selectOnlyDocuments = (ids: string[]) => {
    const filtered = ids.filter(Boolean);
    setSelectedDocumentIds(new Set(filtered));
  };

  const handleExportSelected = async () => {
    if (selectedDocumentIds.size === 0) return;
    setIsExporting(true);
    try {
      const orderedIds = getOrderedDocumentIds(allDocuments, selectedDocumentIds);

      if (orderedIds.length === 0) {
        throw new Error("No valid documents selected for export.");
      }

      const blob = await api.exportDocuments(orderedIds);
      const url = window.URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;

      const fileName =
        orderedIds.length === 1 && document
          ? `${document.title || "document"}.pdf`
          : "documents-export.pdf";

      anchor.download = fileName;
      window.document.body.appendChild(anchor);
      anchor.click();
      window.document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

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
      {/* Save indicator and Export */}
      <div className="absolute top-4 right-8 flex items-center gap-4">
        <button
          onClick={openExportModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
        >
          📄 Export PDF
        </button>
        <div className="text-sm text-gray-400">
          {isSaving
            ? "Saving..."
            : updateMutation.isPending
            ? "Saving..."
            : "All changes saved"}
        </div>
      </div>

      {/* Title */}
      <div className="max-w-4xl mx-auto px-8 pt-16">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full text-5xl font-bold bg-transparent border-none focus:outline-none mb-4"
        />
      </div>

      {/* Editor */}
      <div className="max-w-4xl mx-auto px-8 pb-16">
        <Editor
          content={content}
          onChange={handleContentChange}
          placeholder="Start writing your world..."
        />
      </div>

      <ExportPdfModal
        isOpen={isExportModalOpen}
        documents={allDocuments}
        selectedIds={selectedDocumentIds}
        onToggle={toggleSelectedDocument}
        onSelectOnly={selectOnlyDocuments}
        onClose={() => {
          if (!isExporting) {
            setIsExportModalOpen(false);
          }
        }}
        onConfirm={handleExportSelected}
        isExporting={isExporting}
      />
    </div>
  );
}
