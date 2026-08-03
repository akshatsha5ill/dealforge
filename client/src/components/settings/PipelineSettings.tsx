import { useState, useEffect } from 'react';
import { getPipelineStages, savePipelineStages, Stage, DEFAULT_STAGES } from '../../utils/stages';
import { Settings2, Plus, Trash2, GripVertical, Check } from 'lucide-react';
import FeatureGate from '../common/FeatureGate';

export function PipelineSettings() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPipelineStages().then(s => {
      setStages(s);
      setLoading(false);
    });
  }, []);

  const addStage = () => {
    const newStage: Stage = {
      id: `stage_${Date.now()}`,
      label: 'New Stage',
      color: '#cbd5e1'
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const updateStage = (index: number, field: keyof Stage, value: string) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], [field]: value };
    setStages(newStages);
  };

  const handleSave = async () => {
    setSaving(true);
    await savePipelineStages(stages);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetToDefault = () => {
    if (confirm('Are you sure you want to reset to default stages?')) {
      setStages([...DEFAULT_STAGES]);
    }
  };

  if (loading) return <div>Loading pipeline settings...</div>;

  return (
    <FeatureGate
      feature="customStages"
      description="Customize your pipeline stages to match your sales process. Available on Enterprise."
    >
    <div className="ds-panel" style={{ padding: '28px', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={18} /> Pipeline Customization
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
            Customize the stages for your deals and leads. Reordering is supported by dragging.
          </p>
        </div>
        <button onClick={resetToDefault} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          Reset to Default
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {stages.map((stage, i) => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
            
            <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={stage.label}
                  onChange={(e) => updateStage(i, 'label', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px' }}
                  placeholder="Stage Name"
                />
              </div>
              <div style={{ width: '120px' }}>
                <input
                  type="text"
                  value={stage.id}
                  onChange={(e) => updateStage(i, 'id', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'monospace' }}
                  placeholder="ID (e.g. stage_1)"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={stage.color.startsWith('var') ? '#6366f1' : stage.color} // Simplified for var(--) fallback
                  onChange={(e) => updateStage(i, 'color', e.target.value)}
                  style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }}
                  title="Select color"
                />
                <input
                  type="text"
                  value={stage.color}
                  onChange={(e) => updateStage(i, 'color', e.target.value)}
                  style={{ width: '120px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}
                  placeholder="Color Hex or Var"
                />
              </div>
            </div>
            
            <button onClick={() => removeStage(i)} style={{ padding: '8px', color: 'var(--danger)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }} title="Remove stage">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={addStage} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={16} /> Add Stage
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {saved && <span style={{ color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> Saved!</span>}
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 24px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Pipeline Stages'}
            </button>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
