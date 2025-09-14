import React from 'react';

type ErrorOverlayProps = {
  message: string | null;
  deviceLabel: string;
};

export default function ErrorOverlay({ message, deviceLabel }: ErrorOverlayProps) {
  if (!message) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      textAlign: 'center',
      zIndex: 1000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.8)',
      padding: '20px',
      borderRadius: '10px',
      maxWidth: '300px'
    }}>
      <h2>⚠️ Graphics Error</h2>
      <p>{message}</p>
      <p style={{ fontSize: '14px', marginTop: '10px' }}>Device: {deviceLabel}</p>
    </div>
  );
}


