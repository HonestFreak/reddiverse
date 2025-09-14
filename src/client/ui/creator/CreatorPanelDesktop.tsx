import React from 'react';

type BlockType = { id: string; name: string };

type CreatorPanelDesktopProps = {
  visible: boolean;
  isOwner: boolean;
  worldConfig: { worldName: string; buildingPermission: 'public' | 'restricted'; builders: string[]; owner: string } | null;
  allBlockTypes: Record<string, BlockType>;
  selectedBlockType: string;
  onChangeBlockType: (id: string) => void;
  onAdd: () => void;
  onRemove: () => void;
  onOpenSmart: () => void;
  onOpenBuilderManagement: () => void;
};

export default function CreatorPanelDesktop({ visible, isOwner, worldConfig, allBlockTypes, selectedBlockType, onChangeBlockType, onAdd, onRemove, onOpenSmart, onOpenBuilderManagement }: CreatorPanelDesktopProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      color: 'white',
      zIndex: 1000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.7)',
      padding: '15px',
      borderRadius: '10px',
      minWidth: '200px'
    }}>
      <h3 style={{ color: '#4CAF50', margin: '0 0 10px 0' }}>✏️ Creator Mode</h3>
      <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Left click: Remove block<br/>Right click: Place block</p>

      {isOwner && worldConfig && (
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={onOpenBuilderManagement}
            style={{
              padding: '6px 12px',
              background: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            👥 Manage Builders ({worldConfig.builders.length})
          </button>
        </div>
      )}

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Block Type:</label>
        <select 
          value={selectedBlockType} 
          onChange={(e) => onChangeBlockType(e.target.value)}
          style={{
            width: '100%',
            padding: '5px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            background: 'white',
            color: 'black'
          }}
        >
          {Object.values(allBlockTypes).map((bt) => (
            <option key={bt.id} value={bt.id}>{bt.name}</option>
          ))}
        </select>
      </div>

      <div style={{ 
        padding: '8px', 
        background: 'rgba(76, 175, 80, 0.2)', 
        borderRadius: '5px',
        fontSize: '12px',
        border: '1px solid #4CAF50'
      }}>
        Selected: <span style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{selectedBlockType}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={onAdd}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          + Add Block
        </button>
        <button
          onClick={onOpenSmart}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          + Smart Block
        </button>
        <button
          onClick={onRemove}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          - Remove
        </button>
      </div>
    </div>
  );
}


