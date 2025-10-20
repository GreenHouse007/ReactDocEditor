import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { connectDatabase } from "./services/database.js";
import { documentRoutes } from "./routes/documents.js";
import { getDocumentsByIds } from "./services/documents.js";
import type { Document } from "@enfield/types";
import puppeteer from "puppeteer";

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
          reply.status(400).send({ error: "No documents selected" });
          return;
        }

        const documents = await getDocumentsByIds(documentIds);
        const documentMap = new Map<string, Document>();
        documents.forEach((doc) => {
          if (doc._id) {
            documentMap.set(doc._id, doc);
          }
        });

        const orderedDocuments = documentIds
          .map((docId) => documentMap.get(docId))
          .filter((doc): doc is Document => Boolean(doc));

        if (!orderedDocuments.length) {
          reply.status(404).send({ error: "Documents not found" });
          return;
        }

        const exportTitle =
          orderedDocuments.length === 1
            ? orderedDocuments[0].title || "document"
            : "documents";

        const html = generateHTMLForDocuments(orderedDocuments);

        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

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

        reply.type("application/pdf");
        reply.header(
          "Content-Disposition",
          `attachment; filename="${exportTitle}.pdf"`
        );
        return reply.send(pdf);
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Failed to generate PDF" });
      }
    });

    function generateHTMLForDocuments(documents: Document[]): string {
      const sections = documents
        .map((doc, index) => {
          const body = doc.content?.content
            ? doc.content.content.map((node: any) => convertNode(node)).join("")
            : "";

          return `
            <section class="doc-section">
              <header class="doc-header">
                ${doc.icon ? `<span class="doc-icon">${doc.icon}</span>` : ""}
                <div>
                  <h1>${doc.title || "Untitled"}</h1>
                  <p class="doc-meta">Section ${index + 1}</p>
                </div>
              </header>
              <div class="doc-content">${body}</div>
            </section>
          `;
        })
        .join('<div class="page-break"></div>');

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.65;
              color: #121212;
              margin: 0;
              padding: 48px 64px;
              background: #f4f6fb;
            }
            .doc-section {
              background: rgba(255, 255, 255, 0.9);
              border-radius: 18px;
              border: 1px solid rgba(15, 23, 42, 0.08);
              padding: 32px 36px;
              margin-bottom: 32px;
              box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
              backdrop-filter: blur(12px);
            }
            .doc-header {
              display: flex;
              align-items: center;
              gap: 16px;
              margin-bottom: 24px;
            }
            .doc-icon {
              font-size: 36px;
              filter: drop-shadow(0 12px 20px rgba(59, 130, 246, 0.25));
            }
            h1 {
              font-size: 28px;
              margin: 0;
              color: #0f172a;
              letter-spacing: -0.02em;
            }
            .doc-meta {
              margin: 4px 0 0;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.24em;
              color: rgba(15, 23, 42, 0.45);
            }
            .doc-content p {
              margin: 1em 0;
              font-size: 15px;
              color: #1f2937;
            }
            .doc-content h2 {
              font-size: 22px;
              margin-top: 1.8em;
              margin-bottom: 0.6em;
              color: #1e3a8a;
            }
            .doc-content h3 {
              font-size: 18px;
              margin-top: 1.2em;
              margin-bottom: 0.5em;
              color: #1d4ed8;
            }
            .doc-content ul,
            .doc-content ol {
              margin: 1.2em 0;
              padding-left: 1.5em;
            }
            .doc-content li {
              margin: 0.4em 0;
            }
            .doc-content strong { font-weight: 600; }
            .doc-content em { font-style: italic; }
            .doc-content code {
              background: rgba(15, 23, 42, 0.08);
              padding: 3px 8px;
              border-radius: 6px;
              font-family: 'JetBrains Mono', 'Courier New', monospace;
              font-size: 13px;
            }
            .page-break {
              page-break-after: always;
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
      switch (node?.type) {
        case "paragraph":
          return `<p>${convertContent(node.content)}</p>`;
        case "heading": {
          const level = node.attrs?.level || 1;
          return `<h${level}>${convertContent(node.content)}</h${level}>`;
        }
        case "bulletList":
          return `<ul>${convertContent(node.content)}</ul>`;
        case "orderedList":
          return `<ol>${convertContent(node.content)}</ol>`;
        case "listItem":
          return `<li>${convertContent(node.content)}</li>`;
        case "text": {
          let text = node.text || "";
          if (node.marks) {
            node.marks.forEach((mark: any) => {
              if (mark.type === "bold") text = `<strong>${text}</strong>`;
              if (mark.type === "italic") text = `<em>${text}</em>`;
              if (mark.type === "code") text = `<code>${text}</code>`;
            });
          }
          return text;
        }
        case "hardBreak":
          return "<br>";
        default:
          return convertContent(node?.content);
      }
    }

    function convertContent(content: any[]): string {
      if (!content) return "";
      return content.map((node) => convertNode(node)).join("");
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
