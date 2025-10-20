import type {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
} from "@enfield/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const api = {
  // Get all documents
  async getDocuments(): Promise<Document[]> {
    const response = await fetch(`${API_URL}/api/documents`);
    const data = await response.json();
    return data.documents;
  },

  // Get single document
  async getDocument(id: string): Promise<Document> {
    const response = await fetch(`${API_URL}/api/documents/${id}`);
    const data = await response.json();
    return data.document;
  },

  // Create document
  async createDocument(data: CreateDocumentDto): Promise<Document> {
    const response = await fetch(`${API_URL}/api/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.document;
  },

  // Update document
  async updateDocument(id: string, data: UpdateDocumentDto): Promise<Document> {
    const response = await fetch(`${API_URL}/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    return result.document;
  },

  // Delete document
  async deleteDocument(id: string): Promise<void> {
    await fetch(`${API_URL}/api/documents/${id}`, {
      method: "DELETE",
    });
  },

  // Export selected documents as a single PDF
  async exportDocuments(documentIds: string[]): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/export-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "PDF export failed");
    }

    return await response.blob();
  },
};
