import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState } from "react";

export function DocumentsList() {
  const queryClient = useQueryClient();
  const [newDocTitle, setNewDocTitle] = useState("");

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });

  // Create document mutation
  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api.createDocument({
        title,
        authorId: "demo-user",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setNewDocTitle("");
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDocTitle.trim()) {
      createMutation.mutate(newDocTitle);
    }
  };

  if (isLoading) {
    return <div className="text-white">Loading documents...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold text-white mb-8">
        Enfield World Builder
      </h1>

      <form onSubmit={handleCreate} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="New document title..."
            className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {documents && documents.length === 0 && (
          <p className="text-gray-400 text-center py-8">
            No documents yet. Create your first world!
          </p>
        )}

        {documents?.map((doc) => (
          <div
            key={doc._id}
            className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {doc.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  Created: {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => doc._id && deleteMutation.mutate(doc._id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
