import React from 'react';

type WinnerOverlayProps = {
  visible: boolean;
  onReplay: () => void;
};

export default function WinnerOverlay({ visible, onReplay }: WinnerOverlayProps) {
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
      borderRadius: '12px'
    }}>
      <h1 style={{ fontSize: '28px', margin: 0, marginBottom: '12px' }}>You Won! 🎉</h1>
      <button
        onClick={onReplay}
        style={{
          background: '#34c759',
          color: '#000',
          border: 'none',
          padding: '10px 16px',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Replay
      </button>
    </div>
  );
}


