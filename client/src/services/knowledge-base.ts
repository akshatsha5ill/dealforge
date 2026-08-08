import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db } from './local-db/db';
import { KBDocument, KBChunk } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBED_BATCH_SIZE = 128;

export const DEFAULT_MAX_TOKENS = 500;
export const DEFAULT_OVERLAP = 50;

function estimateSizes(maxTokens: number, overlapTokens: number): { chunkChars: number; overlapChars: number } {
  const chunkChars = Math.max(1, Math.floor(maxTokens * 4));
  const overlapChars = Math.max(0, Math.min(Math.floor(overlapTokens * 4), chunkChars - 1));
  return { chunkChars, overlapChars };
}

export function chunkText(text: string, maxTokens = DEFAULT_MAX_TOKENS, overlap = DEFAULT_OVERLAP): string[] {
  if (!text || text.trim().length === 0) return [];
  const { chunkChars, overlapChars } = estimateSizes(maxTokens, overlap);
  if (text.length <= chunkChars) return [text];
  const step = chunkChars - overlapChars;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += step) {
    chunks.push(text.slice(i, i + chunkChars));
  }
  return chunks;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    let res: Response;
    try {
      res = await fetch(EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
      });
    } catch (err) {
      throw new Error(`Failed to reach the embeddings API: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.error?.message ?? '';
      } catch {
        // response body is not JSON; fall back to the generic message
      }
      const statusText = res.statusText ? ` ${res.statusText}` : '';
      const base = detail ? `${detail} (HTTP ${res.status})` : `HTTP ${res.status}${statusText}`;
      if (res.status === 401) {
        throw new Error(`Embeddings API rejected your API key: ${base}. Check the OpenAI API key in Settings.`);
      }
      throw new Error(`Embeddings API request failed: ${base}`);
    }
    const body = await res.json();
    if (!Array.isArray(body?.data)) {
      throw new Error('Embeddings API returned an unexpected response shape.');
    }
    results.push(...body.data.map((d: { embedding?: number[] }) => d?.embedding ?? []));
  }
  return results;
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const [embedding] = await embedBatch([text], apiKey);
  return embedding;
}

async function extractPdfText(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    text += `${pageText}\n`;
  }
  return text.trim();
}

function inferDocumentType(name: string, mime: string): 'pdf' | 'txt' | 'md' {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown' || mime === 'text/markdown') return 'md';
  return 'txt';
}

export async function uploadDocument(input: File | string, apiKey: string, name?: string): Promise<KBDocument> {
  let text: string;
  let type: KBDocument['type'];
  let docName: string;
  let sizeBytes: number;

  if (typeof input === 'string') {
    text = input;
    type = 'paste';
    docName = name?.trim() || 'Pasted text';
    sizeBytes = new TextEncoder().encode(text).length;
  } else {
    docName = name?.trim() || input.name || 'document';
    type = inferDocumentType(input.name || '', input.type || '');
    text = type === 'pdf' ? await extractPdfText(input) : await input.text();
    sizeBytes = input.size;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('No readable text found in this document.');
  }

  const chunks = chunkText(trimmed);
  const embeddings = await embedBatch(chunks, apiKey);

  const docId = crypto.randomUUID();
  const doc: KBDocument = {
    id: docId,
    name: docName,
    type,
    uploadedAt: new Date().toISOString(),
    chunkCount: chunks.length,
    sizeBytes,
  };
  const rows: KBChunk[] = chunks.map((chunkText, index) => ({
    id: `${docId}-${index}`,
    docId,
    text: chunkText,
    embedding: embeddings[index] ?? [],
    index,
  }));

  await db.transaction('rw', db.kb_documents, db.kb_chunks, async () => {
    await db.kb_documents.put(doc);
    await db.kb_chunks.bulkPut(rows);
  });

  return doc;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dot / magnitude;
}

export async function searchKnowledge(
  query: string,
  apiKey: string,
  topK = 5
): Promise<{ chunk: KBChunk; score: number }[]> {
  const queryEmbedding = await generateEmbedding(query, apiKey);
  const chunks = await db.kb_chunks.toArray();
  return chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function deleteDocument(docId: string): Promise<void> {
  await db.transaction('rw', db.kb_documents, db.kb_chunks, async () => {
    await db.kb_chunks.where('docId').equals(docId).delete();
    await db.kb_documents.delete(docId);
  });
}

export async function getAllDocuments(): Promise<KBDocument[]> {
  return db.kb_documents.orderBy('uploadedAt').reverse().toArray();
}

export async function exportChunksForMeeting(docIds?: string[]): Promise<{ text: string; embedding: number[] }[]> {
  let chunks: KBChunk[];
  if (docIds && docIds.length > 0) {
    chunks = await db.kb_chunks.where('docId').anyOf(docIds).toArray();
  } else if (docIds) {
    chunks = [];
  } else {
    chunks = await db.kb_chunks.toArray();
  }
  return chunks
    .slice()
    .sort((a, b) => (a.docId === b.docId ? a.index - b.index : a.docId.localeCompare(b.docId)))
    .map((chunk) => ({ text: chunk.text, embedding: chunk.embedding }));
}
