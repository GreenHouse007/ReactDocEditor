import { FastifyInstance } from "fastify";
import * as documentService from "../services/documents.js";

export async function documentRoutes(fastify: FastifyInstance) {
  // Get all documents
  fastify.get("/documents", async (request, reply) => {
    try {
      const documents = await documentService.getAllDocuments();
      return { documents };
    } catch (error) {
      reply.status(500).send({ error: "Failed to fetch documents" });
    }
  });

  // Get single document
  fastify.get("/documents/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const document = await documentService.getDocumentById(id);

      if (!document) {
        return reply.status(404).send({ error: "Document not found" });
      }

      return { document };
    } catch (error) {
      reply.status(500).send({ error: "Failed to fetch document" });
    }
  });

  // Create document
  fastify.post("/documents", async (request, reply) => {
    try {
      const data = request.body as any;

      if (!data.title || !data.authorId) {
        return reply
          .status(400)
          .send({ error: "Title and authorId are required" });
      }

      const document = await documentService.createDocument(data);
      return reply.status(201).send({ document });
    } catch (error) {
      reply.status(500).send({ error: "Failed to create document" });
    }
  });

  // Update document
  fastify.patch("/documents/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as any;

      const document = await documentService.updateDocument(id, data);

      if (!document) {
        return reply.status(404).send({ error: "Document not found" });
      }

      return { document };
    } catch (error) {
      reply.status(500).send({ error: "Failed to update document" });
    }
  });

  // Delete document
  fastify.delete("/documents/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await documentService.deleteDocument(id);

      if (!deleted) {
        return reply.status(404).send({ error: "Document not found" });
      }

      return { message: "Document deleted successfully" };
    } catch (error) {
      reply.status(500).send({ error: "Failed to delete document" });
    }
  });
}
