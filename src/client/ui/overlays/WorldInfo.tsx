import React from 'react';

type WorldConfig = {
  worldName: string;
  buildingPermission: 'public' | 'restricted';
  builders: string[];
  owner: string;
};

type WorldInfoProps = {
  worldConfig: WorldConfig | null;
  isMobile: boolean;
  canBuild: boolean;
};

export default function WorldInfo({ worldConfig, isMobile, canBuild }: WorldInfoProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      color: 'white',
      textAlign: 'left',
      zIndex: 1000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.7)',
      padding: '12px 16px',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 'bold',
      maxWidth: '300px'
    }}>
      {worldConfig && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4CAF50' }}>
            {worldConfig.worldName}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {worldConfig.buildingPermission === 'public' ? '🌍 Public' : '🔒 Restricted'}
            {worldConfig.buildingPermission === 'restricted' && worldConfig.builders.length > 0 && (
              <span> • {worldConfig.builders.length} builder{worldConfig.builders.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}
      <div style={{ fontSize: '12px', opacity: 0.7 }}>
        {isMobile ? '📱 Mobile' : '💻 PC'} • {canBuild ? '✏️ Can Build' : '👀 View Only'}
      </div>
    </div>
  );
}


