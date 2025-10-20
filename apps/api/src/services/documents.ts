import { ObjectId } from "mongodb";
import { getDatabase } from "./database.js";
import type {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
} from "@enfield/types";

const COLLECTION = "documents";

export async function createDocument(
  data: CreateDocumentDto
): Promise<Document> {
  const db = getDatabase();
  const now = new Date();

  const document = {
    title: data.title,
    content: data.content || { type: "doc", content: [] },
    authorId: data.authorId,
    parentId: data.parentId || null,
    icon: data.icon || "📄",
    order: data.order ?? 0, // ADD THIS
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection(COLLECTION).insertOne(document);

  return {
    _id: result.insertedId.toString(),
    ...document,
  };
}

export async function getAllDocuments(): Promise<Document[]> {
  const db = getDatabase();
  const documents = await db.collection(COLLECTION).find().toArray();

  return documents.map((doc) => ({
    _id: doc._id.toString(),
    title: doc.title,
    content: doc.content,
    authorId: doc.authorId,
    parentId: doc.parentId || null,
    icon: doc.icon || "📄",
    order: doc.order ?? 0, // ADD THIS
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const db = getDatabase();
  const document = await db
    .collection(COLLECTION)
    .findOne({ _id: new ObjectId(id) });

  if (!document) return null;

  return {
    _id: document._id.toString(),
    title: document.title,
    content: document.content,
    authorId: document.authorId,
    parentId: document.parentId || null,
    icon: document.icon || "📄",
    order: document.order ?? 0, // ADD THIS
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export async function updateDocument(
  id: string,
  data: UpdateDocumentDto
): Promise<Document | null> {
  const db = getDatabase();

  // Build update object only with provided fields
  const updateFields: any = {
    updatedAt: new Date(),
  };

  if (data.title !== undefined) updateFields.title = data.title;
  if (data.content !== undefined) updateFields.content = data.content;
  if (data.parentId !== undefined) updateFields.parentId = data.parentId;
  if (data.icon !== undefined) updateFields.icon = data.icon;
  if (data.order !== undefined) updateFields.order = data.order; // ADD THIS

  const result = await db
    .collection(COLLECTION)
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: "after" }
    );

  if (!result) return null;

  return {
    _id: result._id.toString(),
    title: result.title,
    content: result.content,
    authorId: result.authorId,
    parentId: result.parentId || null,
    icon: result.icon || "📄",
    order: result.order ?? 0, // ADD THIS
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export async function deleteDocument(id: string): Promise<boolean> {
  const db = getDatabase();
  const result = await db
    .collection(COLLECTION)
    .deleteOne({ _id: new ObjectId(id) });

  return result.deletedCount > 0;
}
