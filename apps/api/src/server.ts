import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { connectDatabase } from "./services/database.js";
import { documentRoutes } from "./routes/documents.js";
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
      Body: {
        documents: Array<{
          title: string;
          content: any;
          icon?: string;
        }>;
      };
    }>("/api/export-pdf", async (request, reply) => {
      try {
        const { documents } = request.body;

        if (!documents || documents.length === 0) {
          return reply
            .status(400)
            .send({ error: "No documents provided for export" });
        }

        const html = generateCombinedHtml(documents);

        const browser = await puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        try {
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

          const fileName = sanitizeFileName(
            documents.length === 1
              ? documents[0].title || "document"
              : "documents"
          );

          reply.type("application/pdf");
          reply.header(
            "Content-Disposition",
            `attachment; filename="${fileName}.pdf"`
          );
          return reply.send(pdf);
        } finally {
          await browser.close();
        }
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Failed to generate PDF" });
      }
    });

    type ExportableDocument = {
      title: string;
      content: any;
      icon?: string;
    };

    function generateCombinedHtml(documents: ExportableDocument[]): string {
      const sections = documents
        .map((doc, index) => {
          const heading = escapeHtml(doc.title || "Untitled");
          const body = renderContent(doc.content?.content ?? []);
          const section = `
          <article class="document-section">
            <header class="document-header">
              <h1>${heading}</h1>
            </header>
            <div class="document-body">
              ${body}
            </div>
          </article>`;

          if (index < documents.length - 1) {
            return `${section}<div class="page-break"></div>`;
          }

          return section;
        })
        .join("");

      return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        :root {
          color-scheme: light;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.7;
          color: #0f172a;
          max-width: 800px;
          margin: 0 auto;
          padding: 48px 32px;
          background: #ffffff;
        }
        h1, h2, h3, h4, h5, h6 {
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }
        h1 {
          font-size: 30px;
          margin-bottom: 16px;
        }
        h2 {
          font-size: 24px;
          margin: 32px 0 12px;
        }
        h3 {
          font-size: 20px;
          margin: 24px 0 10px;
        }
        p {
          margin: 12px 0;
        }
        ul, ol {
          margin: 12px 0 12px 24px;
          padding: 0;
        }
        li {
          margin: 6px 0;
        }
        strong {
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        code {
          font-family: 'Fira Mono', 'Courier New', monospace;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
        }
        pre {
          font-family: 'Fira Mono', 'Courier New', monospace;
          background: #0f172a0a;
          padding: 12px 16px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 16px 0;
        }
        blockquote {
          border-left: 3px solid #94a3b8;
          margin: 16px 0;
          padding: 8px 16px;
          color: #475569;
          background: #f8fafc;
        }
        .page-break {
          page-break-after: always;
          height: 24px;
        }
        .document-section:last-child + .page-break {
          display: none;
        }
      </style>
    </head>
    <body>
      ${sections}
    </body>
    </html>`;
    }

    function renderContent(content: any[]): string {
      if (!content || !Array.isArray(content)) {
        return "";
      }

      return content.map(renderNode).join("");
    }

    function renderNode(node: any): string {
      if (!node) {
        return "";
      }

      switch (node.type) {
        case "paragraph":
          return `<p>${renderContent(node.content)}</p>`;
        case "heading": {
          const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
          return `<h${level}>${renderContent(node.content)}</h${level}>`;
        }
        case "bulletList":
          return `<ul>${renderContent(node.content)}</ul>`;
        case "orderedList":
          return `<ol>${renderContent(node.content)}</ol>`;
        case "listItem":
          return `<li>${renderContent(node.content)}</li>`;
        case "blockquote":
          return `<blockquote>${renderContent(node.content)}</blockquote>`;
        case "codeBlock": {
          const textContent = node.content?.map((child: any) => child.text).join("\n") ?? "";
          return `<pre><code>${escapeHtml(textContent)}</code></pre>`;
        }
        case "horizontalRule":
          return "<hr />";
        case "text": {
          let text = escapeHtml(node.text || "");
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
          return "<br />";
        default:
          return renderContent(node.content);
      }
    }

    function escapeHtml(value: string): string {
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function sanitizeFileName(value: string): string {
      const cleaned = value.replace(/[\\/:*?"<>|]+/g, "").trim();
      return cleaned || "document";
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
