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

    // PDF Export route - Multi-document support
    fastify.post<{
      Body: {
        documents: Array<{ title: string; content: any; icon?: string }>;
        includePageNumbers: boolean;
      };
    }>("/api/export-pdf", async (request, reply) => {
      try {
        const { documents: docs, includePageNumbers } = request.body;

        if (!docs || docs.length === 0) {
          return reply.status(400).send({ error: "No documents provided" });
        }

        // Generate combined HTML
        const html = generateCombinedHTMLFromTiptap(docs, includePageNumbers);

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
          displayHeaderFooter: includePageNumbers,
          headerTemplate: "<div></div>",
          footerTemplate: includePageNumbers
            ? '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
            : "<div></div>",
        });

        await browser.close();

        // Sanitize filename
        const sanitizedTitle =
          docs.length === 1
            ? (docs[0].title || "document")
                .replace(/[^a-z0-9]/gi, "_")
                .substring(0, 50)
            : "enfield_export";

        // Send PDF
        reply
          .header("Content-Type", "application/pdf")
          .header(
            "Content-Disposition",
            `attachment; filename="${sanitizedTitle}.pdf"`
          )
          .send(Buffer.from(pdf));
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Failed to generate PDF" });
      }
    });

    // Helper function to convert multiple documents to combined HTML
    function generateCombinedHTMLFromTiptap(
      docs: Array<{ title: string; content: any; icon?: string }>,
      includePageNumbers: boolean
    ): string {
      let combinedContent = "";

      docs.forEach((doc, index) => {
        // Add page break before each document except the first
        if (index > 0) {
          combinedContent += '<div style="page-break-before: always;"></div>';
        }

        // Add document title (without icon)
        combinedContent += `<h1>${doc.title || "Untitled"}</h1>`;

        // Add document content
        if (doc.content && doc.content.content) {
          doc.content.content.forEach((node: any) => {
            combinedContent += convertNode(node);
          });
        }
      });

      return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 20mm;
          ${
            includePageNumbers
              ? `
            @bottom-center {
              content: counter(page) " / " counter(pages);
            }
          `
              : ""
          }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          max-width: 100%;
          margin: 0;
          padding: 0;
        }
        h1 {
          font-size: 2.5em;
          margin-bottom: 0.5em;
          margin-top: 0;
          font-weight: 700;
          color: #000;
        }
        h2 { 
          font-size: 2em; 
          margin-top: 1.5em; 
          color: #000;
        }
        h3 { 
          font-size: 1.5em; 
          margin-top: 1.2em; 
          color: #000;
        }
        p { 
          margin: 1em 0; 
        }
        ul, ol { 
          margin: 1em 0; 
          padding-left: 2em; 
        }
        li { 
          margin: 0.5em 0; 
        }
        strong { 
          font-weight: 600; 
        }
        em { 
          font-style: italic; 
        }
        code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
      </style>
    </head>
    <body>
      ${combinedContent}
    </body>
    </html>
  `;
    }

    // Keep the same convertNode and convertContent functions from before
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

    // Start server
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log("🚀 Server running on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
