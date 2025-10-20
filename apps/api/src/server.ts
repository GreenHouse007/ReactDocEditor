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
      Body: { title: string; content: any; icon?: string };
    }>("/api/export-pdf", async (request, reply) => {
      try {
        const { title, content, icon } = request.body;

        // Generate HTML from Tiptap JSON
        const html = generateHTMLFromTiptap(title, content, icon);

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
          `attachment; filename="${title || "document"}.pdf"`
        );
        return reply.send(pdf);
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Failed to generate PDF" });
      }
    });

    // Helper function to convert Tiptap JSON to HTML
    function generateHTMLFromTiptap(
      title: string,
      content: any,
      icon?: string
    ): string {
      // Basic conversion - you can enhance this
      let htmlContent = "";

      if (content && content.content) {
        content.content.forEach((node: any) => {
          htmlContent += convertNode(node);
        });
      }

      return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px;
        }
        h1 {
          font-size: 2.5em;
          margin-bottom: 0.5em;
          font-weight: 700;
        }
        h2 { font-size: 2em; margin-top: 1.5em; }
        h3 { font-size: 1.5em; margin-top: 1.2em; }
        p { margin: 1em 0; }
        ul, ol { margin: 1em 0; padding-left: 2em; }
        li { margin: 0.5em 0; }
        strong { font-weight: 600; }
        em { font-style: italic; }
        code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }
        .icon { font-size: 1.5em; margin-right: 0.3em; }
      </style>
    </head>
    <body>
      <h1>
        ${icon ? `<span class="icon">${icon}</span>` : ""}
        ${title || "Untitled"}
      </h1>
      ${htmlContent}
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
