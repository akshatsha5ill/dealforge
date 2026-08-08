import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KBDocument, KBChunk } from '../types';

const { docStore, chunkStore } = vi.hoisted(() => ({
  docStore: new Map<string, KBDocument>(),
  chunkStore: new Map<string, KBChunk>(),
}));

vi.mock('./local-db/db', () => ({
  db: {
    kb_documents: {
      put: vi.fn(async (doc: KBDocument) => {
        docStore.set(doc.id, doc);
      }),
      delete: vi.fn(async (id: string) => {
        docStore.delete(id);
      }),
      orderBy: vi.fn(() => ({
        reverse: () => ({
          toArray: async () =>
            [...docStore.values()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
        }),
      })),
    },
    kb_chunks: {
      bulkPut: vi.fn(async (rows: KBChunk[]) => {
        rows.forEach((c) => chunkStore.set(c.id, c));
      }),
      toArray: vi.fn(async () => [...chunkStore.values()]),
      where: vi.fn((field: string) => ({
        equals: (value: string) => ({
          delete: vi.fn(async () => {
            for (const [key, c] of chunkStore) {
              if ((c as unknown as Record<string, unknown>)[field] === value) chunkStore.delete(key);
            }
          }),
          toArray: async () =>
            [...chunkStore.values()].filter(
              (c) => (c as unknown as Record<string, unknown>)[field] === value
            ),
        }),
        anyOf: (values: string[]) => ({
          toArray: async () =>
            [...chunkStore.values()].filter((c) =>
              values.includes((c as unknown as Record<string, unknown>)[field] as string)
            ),
        }),
      })),
    },
    transaction: vi.fn(async (_mode: string, _t1: unknown, _t2: unknown, fn: () => Promise<void>) => {
      await fn();
    }),
  },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [] }) }),
    }),
  })),
}));

import {
  chunkText,
  cosineSimilarity,
  generateEmbedding,
  uploadDocument,
  searchKnowledge,
  deleteDocument,
  getAllDocuments,
  exportChunksForMeeting,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OVERLAP,
} from './knowledge-base';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  docStore.clear();
  chunkStore.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function errorResponse(status: number, message: string) {
  return { ok: false, status, json: async () => ({ error: { message } }) };
}

function embedBatchResponder() {
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { input: string[] };
    return okResponse({
      data: body.input.map((t) => ({ embedding: hashEmbedding(t) })),
    });
  });
}

function hashEmbedding(text: string): number[] {
  const vec = new Array(8).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 8] += text.charCodeAt(i);
  }
  return vec;
}

function expectChunksCover(
  text: string,
  chunks: string[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  overlap: number = DEFAULT_OVERLAP
) {
  const chunkChars = Math.max(1, Math.floor(maxTokens * 4));
  const overlapChars = Math.max(0, Math.min(Math.floor(overlap * 4), chunkChars - 1));
  const step = chunkChars - overlapChars;
  expect(chunks).toHaveLength(Math.ceil(text.length / step));
  chunks.forEach((chunk, i) => {
    const start = i * step;
    const end = Math.min(start + chunkChars, text.length);
    expect(chunk).toBe(text.slice(start, end));
  });
}

describe('chunkText', () => {
  it('returns [] for empty and whitespace-only text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\t  ')).toEqual([]);
  });

  it('returns the whole text when it fits in one chunk', () => {
    const text = 'Short document.';
    expect(chunkText(text)).toEqual([text]);
  });

  it('returns a single chunk when text length equals the chunk size', () => {
    const text = 'x'.repeat(DEFAULT_MAX_TOKENS * 4);
    expect(chunkText(text)).toEqual([text]);
  });

  it('splits long text into verbatim slices covering the whole text', () => {
    const words = Array.from({ length: 5000 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expectChunksCover(text, chunks);
  });

  it('never produces a chunk larger than the char budget', () => {
    const text = 'a'.repeat(100_000);
    const chunks = chunkText(text);
    const maxChars = DEFAULT_MAX_TOKENS * 4;
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(maxChars);
    }
  });

  it('overlaps consecutive chunks by the configured overlap', () => {
    const text = 'b'.repeat(10_000);
    const chunks = chunkText(text);
    const overlapChars = DEFAULT_OVERLAP * 4;
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const next = chunks[i];
      const shared = prev.slice(prev.length - overlapChars);
      expect(next.slice(0, overlapChars)).toBe(shared);
    }
  });

  it('honors custom maxTokens and overlap', () => {
    const text = 'c'.repeat(2_000);
    const chunks = chunkText(text, 100, 10);
    expectChunksCover(text, chunks, 100, 10);
    const overlapChars = 10 * 4;
    const prev = chunks[0];
    expect(chunks[1].slice(0, overlapChars)).toBe(prev.slice(prev.length - overlapChars));
  });

  it('preserves unicode, emoji, quotes, and newlines exactly', () => {
    const text = 'Hello 😀 "quoted" — déjà vu\n新機能です\r\n'.repeat(300);
    const chunks = chunkText(text);
    expectChunksCover(text, chunks);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('returns 0 when either vector has zero norm', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1, 1], [0, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it('is scale-invariant', () => {
    expect(cosineSimilarity([1, 0, 0], [5, 0, 0])).toBe(1);
  });
});

describe('generateEmbedding', () => {
  it('posts to the OpenAI embeddings endpoint and parses data[0].embedding', async () => {
    const embedding = [0.1, 0.2, 0.3];
    fetchMock.mockResolvedValueOnce(okResponse({ data: [{ embedding }] }));

    const result = await generateEmbedding('hello world', 'sk-test');

    expect(result).toEqual(embedding);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('text-embedding-3-small');
    expect(body.input).toEqual(['hello world']);
  });

  it('mentions the API key on a 401 response', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401, 'Incorrect API key provided'));
    await expect(generateEmbedding('x', 'bad')).rejects.toThrow(/API key/i);
  });

  it('includes the server message on other HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'server exploded'));
    await expect(generateEmbedding('x', 'k')).rejects.toThrow(/server exploded/);
  });

  it('throws a clear message when the network fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(generateEmbedding('x', 'k')).rejects.toThrow(/Failed to reach the embeddings API/);
  });
});

describe('uploadDocument', () => {
  it('stores a paste document with default name, one batched embedding call', async () => {
    embedBatchResponder();
    const text = 'p'.repeat(3_000);

    const doc = await uploadDocument(text, 'sk-test');

    expect(doc.type).toBe('paste');
    expect(doc.name).toBe('Pasted text');
    expect(doc.chunkCount).toBe(chunkText(text).length);
    expect(docStore.get(doc.id)).toEqual(doc);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(Array.isArray(body.input)).toBe(true);
    expect(body.input).toHaveLength(doc.chunkCount);
    expect(docStore.size).toBe(1);
    expect(chunkStore.size).toBe(doc.chunkCount);
  });

  it('assigns unique chunk ids prefixed with the doc id and stores embeddings', async () => {
    embedBatchResponder();
    const text = 'q'.repeat(3_000);

    const doc = await uploadDocument(text, 'sk-test');

    const ids = [...chunkStore.keys()];
    expect(ids.length).toBe(doc.chunkCount);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith(`${doc.id}-`)).toBe(true);
    }
    for (const chunk of chunkStore.values()) {
      expect(chunk.embedding.length).toBe(8);
      expect(chunk.embedding).toEqual(hashEmbedding(chunk.text));
      expect(chunk.docId).toBe(doc.id);
    }
  });

  it('accepts a custom name for pasted text', async () => {
    embedBatchResponder();
    const doc = await uploadDocument('short text', 'sk-test', 'My Notes');
    expect(doc.name).toBe('My Notes');
  });

  it('uploads a .txt file with its file name and txt type', async () => {
    embedBatchResponder();
    const file = new File(['file content here'], 'notes.txt', { type: 'text/plain' });

    const doc = await uploadDocument(file, 'sk-test');

    expect(doc.type).toBe('txt');
    expect(doc.name).toBe('notes.txt');
    expect(doc.sizeBytes).toBe(file.size);
    expect(doc.chunkCount).toBe(1);
  });

  it('uploads a .md file as md type', async () => {
    embedBatchResponder();
    const file = new File(['# Title\nSome markdown'], 'README.md', { type: 'text/markdown' });

    const doc = await uploadDocument(file, 'sk-test');

    expect(doc.type).toBe('md');
  });

  it('throws when the text is empty', async () => {
    await expect(uploadDocument('   ', 'sk-test')).rejects.toThrow(/No readable text/);
    await expect(uploadDocument('', 'sk-test')).rejects.toThrow(/No readable text/);
  });

  it('splits large uploads into multiple bounded embedding requests', async () => {
    embedBatchResponder();
    const text = 'z'.repeat(233_000);

    const doc = await uploadDocument(text, 'sk-test');

    expect(doc.chunkCount).toBeGreaterThan(128);
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls.length).toBeGreaterThan(1);
    let totalInputs = 0;
    for (const [, init] of calls) {
      const body = JSON.parse(String(init.body));
      expect(Array.isArray(body.input)).toBe(true);
      expect(body.input.length).toBeLessThanOrEqual(128);
      totalInputs += body.input.length;
    }
    expect(totalInputs).toBe(doc.chunkCount);
    expect(chunkStore.size).toBe(doc.chunkCount);
    for (const chunk of chunkStore.values()) {
      expect(chunk.embedding.length).toBe(8);
    }
  });
});

describe('searchKnowledge', () => {
  it('returns top-K chunks sorted by cosine similarity descending', async () => {
    const queryEmbedding = [1, 0, 0];
    fetchMock.mockResolvedValueOnce(okResponse({ data: [{ embedding: queryEmbedding }] }));

    chunkStore.set('c1', { id: 'c1', docId: 'd1', text: 'exact match', embedding: [1, 0, 0], index: 0 });
    chunkStore.set('c2', { id: 'c2', docId: 'd1', text: 'unrelated', embedding: [0, 1, 0], index: 1 });
    chunkStore.set('c3', { id: 'c3', docId: 'd1', text: 'close match', embedding: [0.9, 0.1, 0], index: 2 });

    const results = await searchKnowledge('pricing', 'sk-test', 2);

    expect(results.map((r) => r.chunk.id)).toEqual(['c1', 'c3']);
    expect(results[0].score).toBe(1);
    expect(results[1].score).toBeGreaterThan(0.99);
    expect(results[1].score).toBeLessThan(1);
  });

  it('defaults topK to 5 and survives zero-norm chunks', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ data: [{ embedding: [1, 0, 0] }] }));
    for (let i = 0; i < 7; i++) {
      chunkStore.set(`c${i}`, {
        id: `c${i}`,
        docId: 'd1',
        text: `chunk ${i}`,
        embedding: i === 6 ? [0, 0, 0] : [1 - i * 0.1, i * 0.1, 0],
        index: i,
      });
    }

    const results = await searchKnowledge('query', 'sk-test');

    expect(results).toHaveLength(5);
    expect(results[0].score).toBe(1);
    expect(results.every((r) => r.score >= 0)).toBe(true);
  });
});

describe('CRUD and export', () => {
  it('getAllDocuments returns documents sorted by uploadedAt desc', async () => {
    docStore.set('a', { id: 'a', name: 'older', type: 'txt', uploadedAt: '2026-01-01T00:00:00Z', chunkCount: 1, sizeBytes: 10 });
    docStore.set('b', { id: 'b', name: 'newer', type: 'md', uploadedAt: '2026-03-01T00:00:00Z', chunkCount: 2, sizeBytes: 20 });
    docStore.set('c', { id: 'c', name: 'middle', type: 'paste', uploadedAt: '2026-02-01T00:00:00Z', chunkCount: 3, sizeBytes: 30 });

    const docs = await getAllDocuments();

    expect(docs.map((d) => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('deleteDocument removes the document and all its chunks', async () => {
    docStore.set('d1', { id: 'd1', name: 'doc', type: 'txt', uploadedAt: 't', chunkCount: 2, sizeBytes: 1 });
    chunkStore.set('d1-0', { id: 'd1-0', docId: 'd1', text: 'a', embedding: [1], index: 0 });
    chunkStore.set('d1-1', { id: 'd1-1', docId: 'd1', text: 'b', embedding: [1], index: 1 });
    chunkStore.set('d2-0', { id: 'd2-0', docId: 'd2', text: 'c', embedding: [1], index: 0 });

    await deleteDocument('d1');

    expect(docStore.has('d1')).toBe(false);
    expect(chunkStore.has('d1-0')).toBe(false);
    expect(chunkStore.has('d1-1')).toBe(false);
    expect(chunkStore.has('d2-0')).toBe(true);
  });

  it('exportChunksForMeeting returns all chunks ordered by doc then index', async () => {
    chunkStore.set('b-1', { id: 'b-1', docId: 'b', text: 'b1', embedding: [2], index: 1 });
    chunkStore.set('a-0', { id: 'a-0', docId: 'a', text: 'a0', embedding: [1], index: 0 });
    chunkStore.set('b-0', { id: 'b-0', docId: 'b', text: 'b0', embedding: [0], index: 0 });

    const all = await exportChunksForMeeting();

    expect(all.map((c) => c.text)).toEqual(['a0', 'b0', 'b1']);
    expect(all[1].embedding).toEqual([0]);
  });

  it('exportChunksForMeeting filters by docIds when provided', async () => {
    chunkStore.set('b-0', { id: 'b-0', docId: 'b', text: 'b0', embedding: [2], index: 0 });
    chunkStore.set('a-0', { id: 'a-0', docId: 'a', text: 'a0', embedding: [1], index: 0 });

    const filtered = await exportChunksForMeeting(['b']);

    expect(filtered.map((c) => c.text)).toEqual(['b0']);
    const empty = await exportChunksForMeeting([]);
    expect(empty).toEqual([]);
  });
});
