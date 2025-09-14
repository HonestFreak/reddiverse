import React from 'react';

type BlockType = { id: string; name: string };

type CreatorPanelMobileProps = {
  visible: boolean;
  allBlockTypes: Record<string, BlockType>;
  selectedBlockType: string;
  onChangeBlockType: (id: string) => void;
  onAdd: () => void;
  onRemove: () => void;
  onOpenSmart: () => void;
};

export default function CreatorPanelMobile({ visible, allBlockTypes, selectedBlockType, onChangeBlockType, onAdd, onRemove, onOpenSmart }: CreatorPanelMobileProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      right: '20px',
      color: 'white',
      zIndex: 1000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.7)',
      padding: '10px',
      borderRadius: '10px',
      minWidth: '150px'
    }}>
      <h4 style={{ color: '#4CAF50', margin: '0 0 8px 0', fontSize: '14px' }}>✏️ Creator</h4>
      <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>Tap blocks to edit</p>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', marginBottom: '3px', fontSize: '12px' }}>Block:</label>
        <select 
          value={selectedBlockType} 
          onChange={(e) => onChangeBlockType(e.target.value)}
          style={{
            width: '100%',
            padding: '3px',
            borderRadius: '3px',
            border: '1px solid #ccc',
            background: 'white',
            color: 'black',
            fontSize: '12px'
          }}
        >
          {Object.values(allBlockTypes).map((bt) => (
            <option key={bt.id} value={bt.id}>{bt.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '5px' }}>
        <button
          onTouchStart={onAdd}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            touchAction: 'none'
          }}
        >
          + Add
        </button>
        <button
          onTouchStart={onOpenSmart}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            touchAction: 'none'
          }}
        >
          + Smart
        </button>
        <button
          onTouchStart={onRemove}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            touchAction: 'none'
          }}
        >
          - Remove
        </button>
      </div>
    </div>
  );
}


