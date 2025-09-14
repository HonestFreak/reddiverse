import React from 'react';

type SmartForm = {
  name: string;
  side: { type: 'color' | 'image'; value: string } | null;
  top: { type: 'color' | 'image'; value: string } | null;
  bottom: { type: 'color' | 'image'; value: string } | null;
  onClick: string;
  onTouch: string;
};

type Status = { type: 'success' | 'error' | null; message: string };

type SmartBlockCreateModalProps = {
  visible: boolean;
  form: SmartForm;
  status: Status;
  onChangeForm: (form: SmartForm) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function SmartBlockCreateModal({ visible, form, status, onChangeForm, onClose, onSubmit }: SmartBlockCreateModalProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.7)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#111',
        color: 'white',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}>
        <h3 style={{ marginTop: 0 }}>Create Smart Block</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          <label>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Name</div>
            <input value={form.name} onChange={(e) => onChangeForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: 6 }} />
          </label>
          <label>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Side Texture (color like #ff0 or image URL)</div>
            <input placeholder="#ff9900 or https://..." onChange={(e) => {
              const v = e.target.value.trim();
              const side = v.startsWith('#') ? { type: 'color' as const, value: v } : v ? { type: 'image' as const, value: v } : null;
              onChangeForm({ ...form, side });
            }} style={{ width: '100%', padding: 6 }} />
          </label>
          <label>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Top Texture (optional)</div>
            <input placeholder="#ffeeaa or https://..." onChange={(e) => {
              const v = e.target.value.trim();
              const top = v.startsWith('#') ? { type: 'color' as const, value: v } : v ? { type: 'image' as const, value: v } : null;
              onChangeForm({ ...form, top });
            }} style={{ width: '100%', padding: 6 }} />
          </label>
          <label>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Bottom Texture (optional)</div>
            <input placeholder="#cc7700 or https://..." onChange={(e) => {
              const v = e.target.value.trim();
              const bottom = v.startsWith('#') ? { type: 'color' as const, value: v } : v ? { type: 'image' as const, value: v } : null;
              onChangeForm({ ...form, bottom });
            }} style={{ width: '100%', padding: 6 }} />
          </label>
          <label>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>onClick Actions JSON</div>
            <textarea value={form.onClick} onChange={(e) => onChangeForm({ ...form, onClick: e.target.value })} rows={3} style={{ width: '100%', padding: 6 }} />
          </label>
          <label>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>onTouch Actions JSON</div>
            <textarea value={form.onTouch} onChange={(e) => onChangeForm({ ...form, onTouch: e.target.value })} rows={3} style={{ width: '100%', padding: 6 }} />
          </label>

          {status.type && (
            <div style={{
              padding: '8px',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'white',
              background: status.type === 'success' ? '#4CAF50' : '#f44336'
            }}>
              {status.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '8px 12px' }}>Cancel</button>
            <button onClick={onSubmit} style={{ flex: 1, padding: '8px 12px', background: '#4CAF50', color: 'white', border: 'none' }}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}


