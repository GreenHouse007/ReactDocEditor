# Enfield World Builder

A Notion-like world-building application for creative writers, game designers, and storytellers to organize and manage their fictional worlds, characters, locations, and lore.

## Tech Stack

### Frontend

- **Vite** - Fast build tool and dev server
- **React 18** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 3.4** - Utility-first styling
- **React Router 6** - Client-side routing
- **Tiptap 2** - Rich text editor (Notion-like blocks)
- **Zustand** - Lightweight state management
- **TanStack Query v5** - Server state management
- **React Hook Form + Zod** - Form handling and validation

### Backend

- **Fastify 5** - Fast Node.js web framework
- **MongoDB 6** - NoSQL database
- **MongoDB Native Driver** - Direct database access
- **Firebase Auth** - User authentication
- **Puppeteer** - PDF export generation
- **Sharp** - Image processing and optimization

### Infrastructure

- **Turborepo** - Monorepo build system
- **TypeScript** - Shared types between frontend/backend
- **ESLint + Prettier** - Code quality and formatting
- **GitHub** - Version control

## Project Structure

```
enfield-world-builder/
├── apps/
│   ├── web/              # React frontend (Vite)
│   │   ├── src/
│   │   └── package.json
│   └── api/              # Fastify backend
│       ├── src/
│       └── package.json
├── packages/
│   └── types/            # Shared TypeScript types
│       └── index.ts
├── turbo.json            # Turborepo configuration
├── package.json          # Root workspace config
└── README.md
```

## Getting Started

### Prerequisites

- Node.js v18+
- npm or pnpm
- MongoDB (local or Atlas)

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd enfield-world-builder
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create `apps/api/.env`:

```
MONGODB_URI=mongodb://localhost:27017/enfield
PORT=3000
```

Create `apps/web/.env`:

```
VITE_API_URL=http://localhost:3000
```

### Development

Run both frontend and backend:

```bash
npm run dev
```

Or run separately:

**Backend** (Terminal 1):

```bash
cd apps/api
npm run dev
```

**Frontend** (Terminal 2):

```bash
cd apps/web
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Features (Planned)

- 📝 Rich text editor with blocks (like Notion)
- 🖼️ Image upload and embedding
- 📄 PDF export of documents
- 👥 Multi-user authentication
- 🗂️ Hierarchical document organization
- 🔍 Full-text search
- 🎨 Customizable templates for characters, locations, etc.
- 🔗 Linking between documents
- 📱 Responsive design

## Development Roadmap

1. ✅ Project setup and architecture
2. ✅ MongoDB integration
3. ⏳ Firebase authentication
4. ✅ Rich text editor with Tiptap
5. ✅ Document CRUD operations
6. ⏳ Image upload and storage
7. ⏳ PDF export functionality
8. ✅ Search and filtering
9. ⏳ User profiles and permissions
10. ⏳ Deployment

## License

ISC

## Author

Alex - Building Enfield World Builder
