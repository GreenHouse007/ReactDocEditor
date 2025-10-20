import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { connectDatabase } from "./services/database.js";
import { documentRoutes } from "./routes/documents.js";
import puppeteer from "puppeteer";
import * as documentService from "./services/documents.js";
import type { Document } from "@enfield/types";

// Load environment variables
dotenv.config();

const fastify = Fastify({
  logger: true,
});

const start = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Register CORS
    await fastify.register(cors, {
      origin: "http://localhost:5173",
    });

    // Health check route
    fastify.get("/health", async () => {
      return { status: "ok", database: "connected" };
    });

    // Register document routes
    await fastify.register(documentRoutes, { prefix: "/api" });

    // PDF Export route
    fastify.post<{
      Body: { documentIds: string[] };
    }>("/api/export-pdf", async (request, reply) => {
      try {
        const { documentIds } = request.body;

        if (!documentIds || documentIds.length === 0) {
          return reply
            .status(400)
            .send({ error: "No documents selected for export" });
        }

        const documents = await documentService.getDocumentsByIds(documentIds);
        const byId = new Map(documents.map((doc) => [doc._id!, doc]));
        const orderedDocuments = documentIds
          .map((id) => byId.get(id))
          .filter((doc): doc is Document => Boolean(doc));

        if (orderedDocuments.length === 0) {
          return reply
            .status(404)
            .send({ error: "Selected documents were not found" });
        }

        // Generate HTML from Tiptap JSON
        const html = generateHTMLForDocuments(orderedDocuments);

        // Launch Puppeteer
        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

        // Generate PDF
        const pdf = await page.pdf({
          format: "A4",
          margin: {
            top: "20mm",
            right: "20mm",
            bottom: "20mm",
            left: "20mm",
          },
          printBackground: true,
        });

        await browser.close();

        // Send PDF
        reply.type("application/pdf");
        reply.header(
          "Content-Disposition",
          `attachment; filename="Enfield-export.pdf"`
        );
        return reply.send(pdf);
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Failed to generate PDF" });
      }
    });

    // Helper function to convert Tiptap JSON to HTML
    function generateHTMLForDocuments(documents: Document[]): string {
      const tableOfContents = documents
        .map(
          (doc, index) => `
            <li class="toc-item">
              <span class="toc-index">${index + 1}.</span>
              <span class="toc-title">${doc.title || "Untitled"}</span>
            </li>
          `
        )
        .join("");

      const sections = documents
        .map((doc, index) => {
          const contentHTML = convertDocumentContent(doc.content);
          const includeIcon = doc.icon && doc.icon.trim() !== "";
          const anchor = `section-${index + 1}`;

          return `
            <section class="document-section ${
              index < documents.length - 1 ? "page-break" : ""
            }">
              <header class="document-header" id="${anchor}">
                ${includeIcon ? `<span class="document-icon">${doc.icon}</span>` : ""}
                <div>
                  <h1>${doc.title || "Untitled"}</h1>
                  <p class="document-subtitle">Chapter ${index + 1}</p>
                </div>
              </header>
              ${contentHTML}
            </section>
          `;
        })
        .join("");

      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              @page {
                margin: 25mm 20mm;
              }

              body {
                font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                line-height: 1.7;
                color: #13161a;
                background: linear-gradient(135deg, #f9fbff 0%, #f0f4ff 100%);
                padding: 24px 32px 48px;
              }

              main {
                max-width: 760px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.92);
                border-radius: 24px;
                box-shadow: 0 30px 60px rgba(15, 23, 42, 0.08);
                border: 1px solid rgba(148, 163, 184, 0.2);
                backdrop-filter: blur(14px);
                padding: 56px 72px;
              }

              .toc-wrapper {
                margin-bottom: 48px;
                padding: 32px;
                border-radius: 20px;
                background: rgba(226, 232, 240, 0.4);
                border: 1px solid rgba(148, 163, 184, 0.18);
              }

              .toc-title {
                font-size: 18px;
                font-weight: 600;
                color: #0f172a;
                letter-spacing: 0.04em;
                text-transform: uppercase;
              }

              .toc-list {
                list-style: none;
                margin: 16px 0 0;
                padding: 0;
                display: grid;
                gap: 12px;
              }

              .toc-item {
                display: flex;
                gap: 12px;
                align-items: baseline;
                font-size: 15px;
                color: #334155;
              }

              .toc-index {
                font-weight: 600;
                color: #1d4ed8;
              }

              .document-section {
                margin-bottom: 48px;
                padding: 32px;
                border-radius: 22px;
                background: rgba(255, 255, 255, 0.88);
                border: 1px solid rgba(148, 163, 184, 0.16);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 20px 45px rgba(15, 23, 42, 0.08);
              }

              .page-break {
                page-break-after: always;
              }

              .document-header {
                display: flex;
                gap: 18px;
                align-items: center;
                margin-bottom: 24px;
              }

              .document-icon {
                font-size: 40px;
                filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.08));
              }

              h1 {
                font-size: 30px;
                margin: 0;
                color: #0f172a;
                letter-spacing: -0.02em;
              }

              .document-subtitle {
                margin: 4px 0 0;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.16em;
                color: #64748b;
              }

              h2 {
                font-size: 24px;
                margin-top: 32px;
                margin-bottom: 16px;
                color: #1e293b;
              }

              h3 {
                font-size: 20px;
                margin-top: 24px;
                margin-bottom: 12px;
                color: #1e293b;
              }

              p {
                margin: 16px 0;
                color: #334155;
                font-size: 16px;
              }

              ul, ol {
                margin: 16px 0;
                padding-left: 28px;
                color: #334155;
              }

              li {
                margin: 8px 0;
              }

              strong {
                font-weight: 600;
                color: #0f172a;
              }

              em {
                font-style: italic;
              }

              code {
                background: rgba(226, 232, 240, 0.8);
                padding: 4px 8px;
                border-radius: 8px;
                font-family: 'JetBrains Mono', 'Courier New', monospace;
                font-size: 14px;
                color: #1e293b;
              }

              blockquote {
                border-left: 4px solid rgba(59, 130, 246, 0.5);
                padding-left: 16px;
                margin: 20px 0;
                color: #0f172a;
                font-style: italic;
                background: rgba(191, 219, 254, 0.25);
                border-radius: 0 16px 16px 0;
              }

              hr {
                border: none;
                border-bottom: 1px solid rgba(148, 163, 184, 0.4);
                margin: 32px 0;
              }

              .empty-state {
                color: #94a3b8;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <main>
              <div class="toc-wrapper">
                <div class="toc-title">Document Collection</div>
                <ul class="toc-list">
                  ${tableOfContents}
                </ul>
              </div>
              ${sections}
            </main>
          </body>
        </html>
      `;
    }

    function convertDocumentContent(content: any): string {
      if (!content || !content.content) {
        return '<p class="empty-state">No content available.</p>';
      }

      return content.content.map(convertNode).join("");
    }

    function convertNode(node: any): string {
      switch (node.type) {
        case "paragraph":
          return `<p>${convertContent(node.content)}</p>`;
        case "heading":
          const level = node.attrs?.level || 1;
          return `<h${level}>${convertContent(node.content)}</h${level}>`;
        case "bulletList":
          return `<ul>${convertContent(node.content)}</ul>`;
        case "orderedList":
          return `<ol>${convertContent(node.content)}</ol>`;
        case "listItem":
          return `<li>${convertContent(node.content)}</li>`;
        case "text":
          let text = node.text || "";
          if (node.marks) {
            node.marks.forEach((mark: any) => {
              if (mark.type === "bold") text = `<strong>${text}</strong>`;
              if (mark.type === "italic") text = `<em>${text}</em>`;
              if (mark.type === "code") text = `<code>${text}</code>`;
              if (mark.type === "strike") {
                text = `<span style="text-decoration: line-through;">${text}</span>`;
              }
            });
          }
          return text;
        case "hardBreak":
          return "<br>";
        case "blockquote":
          return `<blockquote>${convertContent(node.content)}</blockquote>`;
        case "horizontalRule":
          return "<hr />";
        default:
          return convertContent(node.content);
      }
    }

    function convertContent(content: any[]): string {
      if (!content) return "";
      return content.map(convertNode).join("");
    }

    // Start server
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("🚀 Server running on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
