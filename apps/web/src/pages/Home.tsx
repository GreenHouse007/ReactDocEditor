import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

export function Home() {
  const navigate = useNavigate();

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: api.getDocuments,
  });
  const recentDocuments = [...documents]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">
          Welcome to Enfield World Builder
        </h1>
        <p className="text-gray-400 text-lg mb-12">
          Create and organize your fictional worlds, characters, and stories.
        </p>

        {/* Recent Documents */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">Recent Pages</h2>
          <div className="grid grid-cols-3 gap-4">
            {recentDocuments.map((doc) => (
              <div
                key={doc._id}
                onClick={() => navigate(`/document/${doc._id}`)}
                className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{doc.icon || "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{doc.title}</h3>
                    <p className="text-xs text-gray-400">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Getting Started */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl mb-2">📝</div>
              <h3 className="text-lg font-semibold mb-2">Start Writing</h3>
              <p className="text-gray-400 text-sm">
                Click the + button in the sidebar to create your first page.
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl mb-2">🗂️</div>
              <h3 className="text-lg font-semibold mb-2">Organize</h3>
              <p className="text-gray-400 text-sm">
                Drag pages or use the ⋯ menu to restructure your folders in
                seconds.
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl mb-2">🪄</div>
              <h3 className="text-lg font-semibold mb-2">Nest</h3>
              <p className="text-gray-400 text-sm">
                Drop a page onto another page to create hierarchies and keep
                related ideas grouped.
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl mb-2">📄</div>
              <h3 className="text-lg font-semibold mb-2">Export</h3>
              <p className="text-gray-400 text-sm">
                Use the PDF export dialog to bundle exactly the pages you need
                into a polished document.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
