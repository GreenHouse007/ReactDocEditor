export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export interface Document {
  _id?: string;
  title: string;
  content: any;
  authorId: string;
  parentId?: string | null;
  icon?: string;
  order?: number; // NEW: for drag-drop ordering
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentDto {
  title: string;
  content?: any;
  authorId: string;
  parentId?: string | null;
  icon?: string;
  order?: number;
}

export interface UpdateDocumentDto {
  title?: string;
  content?: any;
  parentId?: string | null;
  icon?: string;
  order?: number;
}
