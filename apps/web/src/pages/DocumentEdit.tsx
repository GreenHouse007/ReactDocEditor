import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import { useState, useEffect, useRef } from "react";

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
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

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
    }
  }, [document]);

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
      <div className="flex h-full items-center justify-center bg-gray-900 text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 text-white">
        <p>Document not found</p>
      </div>
    );
  }

  const handleExportPDF = async () => {
    if (!document) return;

    try {
      const blob = await api.exportPDF(title, content);
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

  const saveStatus =
    isSaving || updateMutation.isPending ? "Saving..." : "All changes saved";

  return (
    <div className="flex h-full min-h-full flex-col bg-gray-900 text-white">
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-800 px-10 py-6">
        <div className="min-w-[240px] flex-1">
          <input
            type="text"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-4xl font-bold text-white placeholder:text-gray-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div>{saveStatus}</div>
          <button
            onClick={handleExportPDF}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500"
          >
            Export PDF
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <Editor
            content={content}
            onChange={handleContentChange}
            placeholder="Start writing your world..."
          />
        </div>
      </div>
    </div>
  );
}
