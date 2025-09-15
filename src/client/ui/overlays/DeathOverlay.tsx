import React from 'react';

type DeathOverlayProps = {
  visible: boolean;
};

export default function DeathOverlay({ visible }: DeathOverlayProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      textAlign: 'center',
      zIndex: 2000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.6)',
      padding: '24px 28px',
      borderRadius: '12px',
      pointerEvents: 'none'
    }}>
      <h1 style={{ fontSize: '28px', margin: 0 }}>You Died</h1>
    </div>
  );
}


