import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { encryptKey, decryptKey, EncryptedKey } from '../../crypto/key-vault';
import { db } from '../../services/local-db/db';
import { requestPersistence, exportAllData, downloadJSON, getStorageUsage, selectBackupDirectory, importFromJSONFile, StorageUsage } from '../../services/local-db/backup';
import { Database, Upload, Download, HardDrive } from 'lucide-react';
import { toast } from '../../components/common/Toast';
import styles from './SettingsPage.module.css';

interface PendingKeys {
  openAi: string;
  anthropic: string;
  gemini: string;
  resend: string;
}

interface EncryptedKeys {
  openAi?: EncryptedKey;
  anthropic?: EncryptedKey;
  gemini?: EncryptedKey;
  resend?: EncryptedKey;
}

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
  const [pendingKeys, setPendingKeys] = useState<PendingKeys | null>(null);
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

  const decryptKeys = useCallback(async (encryptedData: EncryptedKeys) => {
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
        decryptKeys(stored.value as EncryptedKeys);
      }
    };
    loadKeys();
  }, [password, decryptKeys]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingKeys({ openAi: localOpenAi, anthropic: localAnthropic, gemini: localGemini, resend: localResend });
    setShowPasswordPrompt(true);
  };

  const confirmSave = async () => {
    if (!password || !pendingKeys) return;
    setLoading(true);
    try {
      const encrypted: EncryptedKeys = {};
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
        await decryptKeys(stored.value as EncryptedKeys);
      }
      setShowPasswordPrompt(false);
    } catch {
      console.error('Decryption failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className={styles.settingsContainer}>
        <h1 className={styles.settingsTitle}>Settings</h1>
        <p className={styles.settingsSubtitle}>Manage your API keys and account preferences.</p>
      </div>

      <div className={styles.settingsGrid}>
        {/* API Keys Section */}
        <div className={`ds-panel ${styles.apiKeysSection}`}>
          <h2 className={styles.sectionTitle}>API Keys (BYOK)</h2>
          <p className={styles.sectionDescription}>
            Your keys are encrypted client-side using AES-256-GCM and stored in your browser. They are sent over HTTPS only when you use AI features.
          </p>

          <form onSubmit={handleSave}>
            <label className={styles.formLabel}>OpenAI API Key</label>
            <input
              type="password"
              value={localOpenAi}
              onChange={(e) => setLocalOpenAi(e.target.value)}
              placeholder="sk-..."
              className={styles.formInput}
            />

            <label className={styles.formLabel}>Anthropic API Key</label>
            <input
              type="password"
              value={localAnthropic}
              onChange={(e) => setLocalAnthropic(e.target.value)}
              placeholder="sk-ant-..."
              className={styles.formInput}
            />

            <label className={styles.formLabel}>Gemini API Key</label>
            <input
              type="password"
              value={localGemini}
              onChange={(e) => setLocalGemini(e.target.value)}
              placeholder="AIza..."
              className={styles.formInput}
            />

            <label className={styles.formLabel}>Resend API Key (for Emails)</label>
            <input
              type="password"
              value={localResend}
              onChange={(e) => setLocalResend(e.target.value)}
              placeholder="re_..."
              className={styles.formInput}
            />

            <div className={styles.buttonRow}>
              <button type="submit" className={styles.saveButton}>
                Save Keys
              </button>
              {saved && <span className={styles.savedMessage}>Keys encrypted and saved!</span>}
            </div>
          </form>
        </div>

        {/* Password / Security Section */}
        <div className={`ds-panel ${styles.securitySection}`}>
          <h2 className={styles.sectionTitle}>Encryption Password</h2>
          <p className={styles.sectionDescription}>
            Set a password to encrypt/decrypt your API keys. You'll need this password to restore keys after clearing browser data.
          </p>

          <label className={styles.formLabel}>Encryption Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a strong password"
            className={styles.formInput}
          />

          <button
            onClick={handleUnlock}
            disabled={!password || loading}
            className={styles.unlockButton}
          >
            {loading ? 'Decrypting...' : 'Unlock Saved Keys'}
          </button>

          <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <h3 className={styles.securityTitle}>Security Notes</h3>
            <ul className={styles.securityNotes}>
              <li>Keys are encrypted with AES-256-GCM (PBKDF2, 600K iterations)</li>
              <li>Encryption/decryption happens entirely in your browser</li>
              <li>Our servers never see your plaintext API keys</li>
              <li>Lost password = lost keys (we cannot recover them)</li>
            </ul>
          </div>
        </div>

        {/* Data Management & Backup Section */}
        <div className={`ds-panel ${styles.dataSection}`}>
          <h2 className={styles.dataSectionHeader}>
            <Database size={18} /> Data Management & Backup
          </h2>
          <p className={styles.sectionDescription}>
            Export your data manually, or set up an automated weekly backup folder on your computer.
          </p>

          <div className={styles.dataGrid}>
            <div className={styles.dataCard}>
              <h3 className={styles.dataCardTitle}><Download size={16} /> Export Data</h3>
              <p className={styles.dataCardDescription}>Download a complete JSON backup of all meetings, leads, and deals.</p>
              <button onClick={handleExport} className={styles.dataCardButton}>Download JSON</button>
            </div>
            
            <div className={styles.dataCard}>
              <h3 className={styles.dataCardTitle}><Upload size={16} /> Import Data</h3>
              <p className={styles.dataCardDescription}>Restore data from a previous JSON backup file.</p>
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} className={styles.dataCardButton}>Select File</button>
            </div>

            <div className={styles.dataCard}>
              <h3 className={styles.dataCardTitle}><HardDrive size={16} /> Auto-Backup</h3>
              <p className={styles.dataCardDescription}>
                {hasBackupDir ? 'Auto-backup is enabled.' : 'Select a local folder for weekly automatic backups.'}
              </p>
              <button 
                onClick={handleSetupAutoBackup} 
                className={`${styles.dataCardButton} ${hasBackupDir ? styles.backupActive : ''}`}
              >
                {hasBackupDir ? 'Change Folder' : 'Setup Folder'}
              </button>
            </div>
          </div>

          <div className={styles.storageStatus}>
            <div>
              <h4 className={styles.storageTitle}>Storage Status</h4>
              <p className={styles.storageInfo}>
                {storageUsage ? `Used ${(storageUsage.used / 1024 / 1024).toFixed(2)} MB of ${(storageUsage.quota / 1024 / 1024).toFixed(2)} MB (${storageUsage.percent}%)` : 'Checking storage...'} 
                {' • '} 
                <span className={persistent ? styles.persistenceBadge : styles.persistenceBadgeWarning}>
                  {persistent ? 'Persistent Storage Granted' : 'Storage may be evicted under pressure'}
                </span>
              </p>
            </div>
            {!persistent && (
              <button onClick={handleRequestPersistence} className={styles.persistenceButton}>
                Request Persistence
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Encryption Prompt Modal */}
      {showPasswordPrompt && (
        <div className={styles.modalOverlay}>
          <div className={`ds-panel ${styles.modalContent}`}>
            <h3 className={styles.modalTitle}>Set Encryption Password</h3>
            <p className={styles.modalDescription}>Choose a strong password to encrypt your API keys.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={styles.formInput}
              style={{ marginBottom: '16px' }}
            />
            <div className={styles.modalActions}>
              <button onClick={() => { setShowPasswordPrompt(false); setPendingKeys(null); }} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={confirmSave} disabled={!password || loading} className={styles.encryptButton}>
                {loading ? 'Encrypting...' : 'Save & Encrypt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
