import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import { ExportModal } from "../components/ExportModal";
import { useState, useEffect, useRef } from "react";

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Timers for debouncing
  const titleTimerRef = useRef<NodeJS.Timeout>();
  const contentTimerRef = useRef<NodeJS.Timeout>();

  // Fetch document
  const { data: document, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
  });

  // Fetch all documents for export modal
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

  const handleExportPDF = async (
    selectedIds: string[],
    includePageNumbers: boolean
  ) => {
    try {
      // Get selected documents in order
      const docsToExport = selectedIds
        .map((id) => allDocuments.find((d) => d._id === id))
        .filter((d) => d !== undefined)
        .map((d) => ({
          title: d!.title,
          content: d!.content,
        }));

      const blob = await api.exportPDF(docsToExport, includePageNumbers);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `enfield_export.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setShowExportModal(false);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Save indicator and Export */}
      <div className="absolute top-4 right-8 flex items-center gap-4">
        <button
          onClick={() => setShowExportModal(true)} // CHANGE THIS
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

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        documents={allDocuments}
        onExport={handleExportPDF}
      />
    </div>
  );
}
