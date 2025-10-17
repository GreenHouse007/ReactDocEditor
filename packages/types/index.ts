export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface Document {
  id: string;
  title: string;
  content: any; // Tiptap JSON
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}
