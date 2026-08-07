import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, FileText, KeyRound, Loader2, Trash2, Upload } from 'lucide-react';
import { useStore } from '../../store';
import { toast } from '../../components/common/Toast';
import { deleteDocument, getAllDocuments, uploadDocument } from '../../services/knowledge-base';
import { KBDocument } from '../../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const openAiKey = useStore((s) => s.openAiKey);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setDocuments(await getAllDocuments());
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0 || !openAiKey) return;
    setUploading(true);
    try {
      for (let i = 0; i < list.length; i++) {
        const doc = await uploadDocument(list[i], openAiKey);
        toast.success(`Uploaded "${doc.name}" (${doc.chunkCount} chunks).`);
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handlePasteUpload = async () => {
    const text = pasteText.trim();
    if (!text) {
      toast.info('Paste some text first.');
      return;
    }
    if (!openAiKey) return;
    setUploading(true);
    try {
      const doc = await uploadDocument(text, openAiKey, pasteName.trim() || undefined);
      toast.success(`Uploaded "${doc.name}" (${doc.chunkCount} chunks).`);
      setPasteText('');
      setPasteName('');
      setShowPaste(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: KBDocument) => {
    try {
      await deleteDocument(doc.id);
      setPendingDeleteId(null);
      await refresh();
      toast.success(`Deleted "${doc.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);

  if (!openAiKey) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Knowledge Base</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Upload your product docs, FAQs, and pricing so the AI can reference them.
          </p>
        </div>
        <div className="ds-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <KeyRound size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Add an OpenAI API key to get started
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px', margin: '0 auto 24px' }}>
            Generating embeddings requires an OpenAI API key. Add one in Settings, then come back to
            upload your documents.
          </p>
          <Link
            to="/dashboard/settings"
            className="ds-btn-primary"
            style={{ display: 'inline-flex', padding: '12px 20px' }}
          >
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Knowledge Base</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Upload your product docs, FAQs, and pricing so the AI can reference them.
        </p>
      </div>

      <div className="ds-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'border-color 0.2s var(--ease), background-color 0.2s var(--ease)',
            backgroundColor: dragging ? 'rgba(99,102,241,0.06)' : 'transparent',
          }}
        >
          <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>
            Drop PDF, TXT, or MD files here
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>
            or click to browse, or paste text below
          </p>
          {uploading && (
            <p style={{ color: 'var(--primary)', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={14} className="spin" /> Uploading... generating embeddings
            </p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="ds-btn-ghost"
            onClick={() => setShowPaste((s) => !s)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            {showPaste ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showPaste ? 'Hide paste text' : 'Paste text'}
          </button>
          {showPaste && (
            <div style={{ marginTop: '12px' }}>
              <input
                type="text"
                className="ds-input"
                placeholder="Name (optional, defaults to Pasted text)"
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                style={{ marginBottom: '10px', fontSize: '14px' }}
              />
              <textarea
                className="ds-input"
                placeholder="Paste product info, FAQs, pricing details..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                style={{ marginBottom: '12px', fontSize: '14px', resize: 'vertical' }}
              />
              <button
                type="button"
                className="ds-btn-primary"
                onClick={handlePasteUpload}
                disabled={uploading}
                style={{ padding: '10px 18px', fontSize: '13px' }}
              >
                {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                Upload pasted text
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ds-panel" style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
        ) : documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
            <FileText size={32} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
            <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              No documents yet
            </p>
            <p style={{ fontSize: '13px' }}>
              Upload your product docs above so the AI can answer attendee questions with confidence.
            </p>
          </div>
        ) : (
          <div>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 4px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <FileText size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                    {doc.type.toUpperCase()} &middot; {doc.chunkCount} chunks &middot; {formatBytes(doc.sizeBytes)} &middot;{' '}
                    {new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {pendingDeleteId === doc.id ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="ds-btn-primary"
                      onClick={() => handleDelete(doc)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="ds-btn-ghost"
                      onClick={() => setPendingDeleteId(null)}
                      style={{ padding: '6px 8px', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ds-btn-ghost"
                    onClick={() => setPendingDeleteId(doc.id)}
                    aria-label={`Delete ${doc.name}`}
                    style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: '13px',
        }}
      >
        Total: {totalChunks} chunks &bull; Ready for meetings
      </div>
    </div>
  );
}
