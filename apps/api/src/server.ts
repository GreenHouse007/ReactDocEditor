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
          format: "Letter",
          margin: {
            top: "1in",
            right: "1in",
            bottom: "1in",
            left: "1in",
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
          const heading = `<h1>${escapeHtml(doc.title || "Untitled")}</h1>`;
          const pageBreak =
            index < documents.length - 1 ? '<div class="page-break"></div>' : "";

          return `
            <section class="document-block">
              ${heading}
              ${sectionBody}
            </section>
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
            @page {
              size: Letter;
              margin: 1in;
            }
            body {
              margin: 0;
              font-family: 'Times New Roman', Georgia, serif;
              color: #1f2933;
              font-size: 12pt;
              line-height: 1.6;
            }
            .document-block {
              margin-bottom: 2em;
              page-break-inside: avoid;
            }
            h1, h2, h3, h4, h5, h6 {
              font-family: 'Georgia', 'Times New Roman', serif;
              color: #1a202c;
              margin: 1.4em 0 0.6em;
              line-height: 1.3;
            }
            h1:first-child {
              margin-top: 0;
            }
            h1 { font-size: 24pt; }
            h2 { font-size: 20pt; }
            h3 { font-size: 16pt; }
            p {
              margin: 0 0 1em;
            }
            ul, ol {
              margin: 0 0 1em 1.4em;
            }
            li {
              margin: 0.25em 0;
            }
            strong {
              font-weight: 700;
            }
            em {
              font-style: italic;
            }
            code {
              background: #f3f4f6;
              padding: 0 0.35em;
              border-radius: 3px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11pt;
            }
            pre {
              background: #f3f4f6;
              border-radius: 4px;
              padding: 0.8em;
              overflow: auto;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11pt;
              margin: 0 0 1.2em;
            }
            blockquote {
              border-left: 3px solid #cbd5e0;
              margin: 1em 0;
              padding: 0.4em 1em;
              color: #4a5568;
              font-style: italic;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1em 0;
              font-size: 11pt;
            }
            th, td {
              border: 1px solid #cbd5e0;
              padding: 0.4em 0.6em;
            }
            hr {
              border: none;
              border-top: 1px solid #cbd5e0;
              margin: 2em 0;
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
        case "blockquote":
          return `<blockquote>${convertContent(node.content)}</blockquote>`;
        case "codeBlock":
          return `<pre>${convertContent(node.content)}</pre>`;
        case "horizontalRule":
          return "<hr />";
        case "table":
          return `<table>${convertContent(node.content)}</table>`;
        case "tableRow":
          return `<tr>${convertContent(node.content)}</tr>`;
        case "tableHeader":
          return `<th>${convertContent(node.content)}</th>`;
        case "tableCell":
          return `<td>${convertContent(node.content)}</td>`;
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
