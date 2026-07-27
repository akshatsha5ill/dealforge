import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { encryptKey, decryptKey } from '../../crypto/key-vault';
import { db } from '../../services/local-db/db';
import { requestPersistence, exportAllData, importData, downloadJSON, getStorageUsage, selectBackupDirectory, importFromJSONFile, StorageUsage } from '../../services/local-db/backup';
import { Database, Upload, Download, HardDrive } from 'lucide-react';
import { toast } from '../../components/common/Toast';

export default function SettingsPage() {
  const { setOpenAiKey, setAnthropicKey, setGeminiKey, setResendKey } = useStore();
  const [localOpenAi, setLocalOpenAi] = useState('');
  const [localAnthropic, setLocalAnthropic] = useState('');
  const [localGemini, setLocalGemini] = useState('');
  const [localResend, setLocalResend] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<any>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [persistent, setPersistent] = useState(false);
  const [hasBackupDir, setHasBackupDir] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadStorage = async () => {
      const usage = await getStorageUsage();
      setStorageUsage(usage);
      const isPersistent = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      setPersistent(isPersistent);
      const dirHandle = await db.settings.get('backup_dir_handle');
      setHasBackupDir(!!dirHandle);
    };
    loadStorage();
  }, []);

  const handleExport = async () => {
    const data = await exportAllData();
    downloadJSON(data);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        await importFromJSONFile(e.target.files[0]);
        toast.success('Data imported successfully!');
      } catch (err) {
        console.error(err);
        toast.error('Failed to import data');
      }
    }
  };

  const handleSetupAutoBackup = async () => {
    try {
      await selectBackupDirectory();
      setHasBackupDir(true);
      toast.success('Auto-backup folder selected successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to setup auto-backup directory');
    }
  };

  const handleRequestPersistence = async () => {
    const isPersistent = await requestPersistence();
    setPersistent(isPersistent);
  };

  const decryptKeys = useCallback(async (encryptedData: any) => {
    if (!password) return;
    try {
      if (encryptedData.openAi) {
        const key = await decryptKey(encryptedData.openAi, password);
        if (key) setLocalOpenAi(key);
      }
      if (encryptedData.anthropic) {
        const key = await decryptKey(encryptedData.anthropic, password);
        if (key) setLocalAnthropic(key);
      }
      if (encryptedData.gemini) {
        const key = await decryptKey(encryptedData.gemini, password);
        if (key) setLocalGemini(key);
      }
      if (encryptedData.resend) {
        const key = await decryptKey(encryptedData.resend, password);
        if (key) setLocalResend(key);
      }
    } catch {
      // Password incorrect or data corrupted
    }
  }, [password]);

  useEffect(() => {
    const loadKeys = async () => {
      const stored = await db.settings.get('dealforge_encrypted_keys');
      if (stored && stored.value && password) {
        decryptKeys(stored.value);
      }
    };
    loadKeys();
  }, [password, decryptKeys]);

  const handleSave = async (e) => {
    e.preventDefault();
    setPendingKeys({ openAi: localOpenAi, anthropic: localAnthropic, gemini: localGemini, resend: localResend });
    setShowPasswordPrompt(true);
  };

  const confirmSave = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const encrypted = {};
      if (pendingKeys.openAi) {
        encrypted.openAi = await encryptKey(pendingKeys.openAi, password);
      }
      if (pendingKeys.anthropic) {
        encrypted.anthropic = await encryptKey(pendingKeys.anthropic, password);
      }
      if (pendingKeys.gemini) {
        encrypted.gemini = await encryptKey(pendingKeys.gemini, password);
      }
      if (pendingKeys.resend) {
        encrypted.resend = await encryptKey(pendingKeys.resend, password);
      }
      
      await db.settings.put({ key: 'dealforge_encrypted_keys', value: encrypted });

      setOpenAiKey(pendingKeys.openAi);
      setAnthropicKey(pendingKeys.anthropic);
      setGeminiKey(pendingKeys.gemini);
      setResendKey(pendingKeys.resend);

      setSaved(true);
      setShowPasswordPrompt(false);
      setPendingKeys(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Encryption failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const stored = await db.settings.get('dealforge_encrypted_keys');
      if (stored && stored.value) {
        await decryptKeys(stored.value);
      }
      setShowPasswordPrompt(false);
    } catch {
      console.error('Decryption failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '20px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your API keys and account preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '900px' }}>
        {/* API Keys Section */}
        <div className="ds-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)' }}>API Keys (BYOK)</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: 1.5 }}>
            Your keys are encrypted client-side using AES-256-GCM and stored in your browser. They are sent over HTTPS only when you use AI features.
          </p>

          <form onSubmit={handleSave}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>OpenAI API Key</label>
            <input
              type="password"
              value={localOpenAi}
              onChange={(e) => setLocalOpenAi(e.target.value)}
              placeholder="sk-..."
              style={inputStyle}
            />

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>Anthropic API Key</label>
            <input
              type="password"
              value={localAnthropic}
              onChange={(e) => setLocalAnthropic(e.target.value)}
              placeholder="sk-ant-..."
              style={inputStyle}
            />

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>Gemini API Key</label>
            <input
              type="password"
              value={localGemini}
              onChange={(e) => setLocalGemini(e.target.value)}
              placeholder="AIza..."
              style={inputStyle}
            />

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>Resend API Key (for Emails)</label>
            <input
              type="password"
              value={localResend}
              onChange={(e) => setLocalResend(e.target.value)}
              placeholder="re_..."
              style={inputStyle}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="submit"
                style={{ padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                Save Keys
              </button>
              {saved && <span style={{ color: 'var(--success)', fontSize: '14px' }}>Keys encrypted and saved!</span>}
            </div>
          </form>
        </div>

        {/* Password / Security Section */}
        <div className="ds-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)' }}>Encryption Password</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: 1.5 }}>
            Set a password to encrypt/decrypt your API keys. You'll need this password to restore keys after clearing browser data.
          </p>

          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>Encryption Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a strong password"
            style={inputStyle}
          />

          <button
            onClick={handleUnlock}
            disabled={!password || loading}
            style={{ padding: '10px 20px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: password && !loading ? 'pointer' : 'not-allowed', fontWeight: 500, fontSize: '14px', opacity: password && !loading ? 1 : 0.5 }}
          >
            {loading ? 'Decrypting...' : 'Unlock Saved Keys'}
          </button>

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Security Notes</h3>
            <ul style={{ color: 'var(--text-muted)', fontSize: '12px', paddingLeft: '16px', lineHeight: 1.8 }}>
              <li>Keys are encrypted with AES-256-GCM (PBKDF2, 600K iterations)</li>
              <li>Encryption/decryption happens entirely in your browser</li>
              <li>Our servers never see your plaintext API keys</li>
              <li>Lost password = lost keys (we cannot recover them)</li>
            </ul>
          </div>
        </div>

        {/* Data Management & Backup Section */}
        <div className="ds-panel" style={{ padding: '28px', gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} /> Data Management & Backup
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px', lineHeight: 1.5 }}>
            Export your data manually, or set up an automated weekly backup folder on your computer.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={16} /> Export Data</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Download a complete JSON backup of all meetings, leads, and deals.</p>
              <button onClick={handleExport} style={{ padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', width: '100%' }}>Download JSON</button>
            </div>
            
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={16} /> Import Data</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>Restore data from a previous JSON backup file.</p>
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', width: '100%' }}>Select File</button>
            </div>

            <div style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><HardDrive size={16} /> Auto-Backup</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
                {hasBackupDir ? 'Auto-backup is enabled.' : 'Select a local folder for weekly automatic backups.'}
              </p>
              <button onClick={handleSetupAutoBackup} style={{ padding: '8px 16px', backgroundColor: hasBackupDir ? 'var(--success)' : 'var(--accent-primary)', color: hasBackupDir ? '#fff' : 'var(--bg-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', width: '100%', fontWeight: 600 }}>
                {hasBackupDir ? 'Change Folder' : 'Setup Folder'}
              </button>
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Storage Status</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {storageUsage ? `Used ${((storageUsage as any).used / 1024 / 1024).toFixed(2)} MB of ${((storageUsage as any).quota / 1024 / 1024).toFixed(2)} MB (${storageUsage.percent}%)` : 'Checking storage...'} 
                {' • '} 
                <span style={{ color: persistent ? 'var(--success)' : 'var(--warning)' }}>{persistent ? 'Persistent Storage Granted' : 'Storage may be evicted under pressure'}</span>
              </p>
            </div>
            {!persistent && (
              <button onClick={handleRequestPersistence} style={{ padding: '6px 12px', backgroundColor: 'transparent', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                Request Persistence
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Encryption Prompt Modal */}
      {showPasswordPrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="ds-panel" style={{ padding: '32px', width: '400px', maxWidth: '90vw' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Set Encryption Password</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Choose a strong password to encrypt your API keys.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{ ...inputStyle, marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPasswordPrompt(false); setPendingKeys(null); }} style={{ padding: '10px 16px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
              <button onClick={confirmSave} disabled={!password || loading} style={{ padding: '10px 16px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '8px', cursor: password && !loading ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '14px' }}>
                {loading ? 'Encrypting...' : 'Save & Encrypt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
