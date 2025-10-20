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

        if (!Array.isArray(documentIds) || documentIds.length === 0) {
          return reply
            .status(400)
            .send({ error: "No documents provided for export" });
        }

        const allDocuments = await documentService.getAllDocuments();
        const documentsById = new Map(
          allDocuments.map((doc) => [doc._id!, doc])
        );

        const orderedDocuments: Document[] = documentIds
          .map((docId) => documentsById.get(docId))
          .filter((doc): doc is Document => Boolean(doc));

        if (orderedDocuments.length === 0) {
          return reply
            .status(404)
            .send({ error: "Selected documents were not found" });
        }

        const html = generateCombinedHTML(orderedDocuments);

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
        const filename =
          orderedDocuments.length === 1
            ? `${sanitizeFilename(orderedDocuments[0].title || "document")}.pdf`
            : "documents-export.pdf";

        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        return reply.send(pdf);
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Failed to generate PDF" });
      }
    });

    function generateCombinedHTML(documents: Document[]): string {
      const sections = documents
        .map((doc, index) => {
          const rawContent = doc.content as any;
          const nodes = Array.isArray(rawContent)
            ? rawContent
            : Array.isArray(rawContent?.content)
            ? rawContent.content
            : [];
          const sectionBody = convertContent(nodes);
          const headingLevel = 1;
          const heading = `<h${headingLevel}>${escapeHtml(
            doc.title || "Untitled"
          )}</h${headingLevel}>`;
          const pageBreak =
            index < documents.length - 1 ? '<div class="page-break"></div>' : "";

          return `
            <article class="document-section">
              ${heading}
              ${sectionBody}
            </article>
            ${pageBreak}
          `;
        })
        .join("\n");

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.7;
              color: #111827;
              margin: 0;
              padding: 48px;
              background: #ffffff;
            }
            h1, h2, h3, h4, h5, h6 {
              font-weight: 600;
              color: #0f172a;
              margin-top: 1.6em;
              margin-bottom: 0.6em;
            }
            h1 { font-size: 2.4rem; }
            h2 { font-size: 2rem; }
            h3 { font-size: 1.6rem; }
            p { margin: 1em 0; font-size: 1rem; }
            ul, ol { margin: 1em 0; padding-left: 1.6em; }
            li { margin: 0.4em 0; }
            strong { font-weight: 600; }
            em { font-style: italic; }
            code {
              background: #f1f5f9;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: 'Source Code Pro', 'Courier New', monospace;
            }
            pre {
              background: #0f172a;
              color: #e2e8f0;
              padding: 16px;
              border-radius: 8px;
              overflow: auto;
              font-family: 'Source Code Pro', 'Courier New', monospace;
            }
            blockquote {
              border-left: 4px solid #93c5fd;
              padding-left: 16px;
              margin: 1.5em 0;
              color: #475569;
              font-style: italic;
            }
            .page-break {
              page-break-after: always;
              margin: 48px 0;
              height: 1px;
            }
            .document-section {
              max-width: 740px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          ${sections}
        </body>
        </html>
      `;
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
          let text = escapeHtml(node.text || "");
          if (node.marks) {
            node.marks.forEach((mark: any) => {
              if (mark.type === "bold") text = `<strong>${text}</strong>`;
              if (mark.type === "italic") text = `<em>${text}</em>`;
              if (mark.type === "code") text = `<code>${text}</code>`;
            });
          }
          return text;
        case "hardBreak":
          return "<br>";
        default:
          return convertContent(node.content);
      }
    }

    function convertContent(content: any[]): string {
      if (!content) return "";
      return content.map(convertNode).join("");
    }

    function escapeHtml(str: string): string {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function sanitizeFilename(str: string): string {
      return str.replace(/[^a-z0-9-_\s]/gi, "").trim().replace(/\s+/g, "-") || "document";
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
