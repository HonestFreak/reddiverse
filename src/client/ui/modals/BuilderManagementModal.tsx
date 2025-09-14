import React from 'react';

type WorldConfig = {
  worldName: string;
  buildingPermission: 'public' | 'restricted';
  builders: string[];
  owner: string;
};

type BuilderManagementModalProps = {
  visible: boolean;
  worldConfig: WorldConfig;
  builderInput: string;
  onChangeBuilderInput: (value: string) => void;
  onAddBuilder: () => void;
  onRemoveBuilder: (builder: string) => void;
  onClose: () => void;
};

export default function BuilderManagementModal({ visible, worldConfig, builderInput, onChangeBuilderInput, onAddBuilder, onRemoveBuilder, onClose }: BuilderManagementModalProps) {
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
        maxWidth: '500px',
        background: '#111',
        color: 'white',
        borderRadius: '10px',
        padding: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
          👥 Manage Builders - {worldConfig.worldName}
        </h3>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', marginBottom: '10px', opacity: 0.8 }}>
            Building Permission: <strong>{worldConfig.buildingPermission === 'public' ? '🌍 Public' : '🔒 Restricted'}</strong>
          </div>
          <div style={{ fontSize: '12px', marginBottom: '15px', opacity: 0.7 }}>
            {worldConfig.buildingPermission === 'public' 
              ? 'Anyone can build in this world'
              : 'Only the owner and builders can build in this world'}
          </div>
        </div>

        {worldConfig.buildingPermission === 'restricted' && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                Add Builder:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={builderInput}
                  onChange={(e) => onChangeBuilderInput(e.target.value)}
                  placeholder="Enter username..."
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '5px',
                    border: '1px solid #555',
                    background: '#222',
                    color: 'white',
                    fontSize: '14px'
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && onAddBuilder()}
                />
                <button
                  onClick={onAddBuilder}
                  disabled={!builderInput.trim()}
                  style={{
                    padding: '8px 16px',
                    background: builderInput.trim() ? '#4CAF50' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: builderInput.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                Current Builders ({worldConfig.builders.length}):
              </div>
              {worldConfig.builders.length === 0 ? (
                <div style={{ 
                  padding: '10px', 
                  background: 'rgba(255,255,255,0.1)', 
                  borderRadius: '5px',
                  fontSize: '12px',
                  opacity: 0.7,
                  textAlign: 'center'
                }}>
                  No builders added yet
                </div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {worldConfig.builders.map((builder, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '5px',
                        marginBottom: '5px'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>👤 {builder}</span>
                      <button
                        onClick={() => onRemoveBuilder(builder)}
                        style={{
                          padding: '4px 8px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


