import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Editor } from "../components/Editor";
import { useState, useEffect, useRef } from "react";

export function DocumentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Timers for debouncing
  const titleTimerRef = useRef<NodeJS.Timeout>();
  const contentTimerRef = useRef<NodeJS.Timeout>();

  // Fetch document
  const { data: document, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => api.getDocument(id!),
    enabled: !!id,
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

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Save indicator */}
      <div className="absolute top-4 right-8 text-sm text-gray-400">
        {isSaving
          ? "Saving..."
          : updateMutation.isPending
          ? "Saving..."
          : "All changes saved"}
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
    </div>
  );
}
