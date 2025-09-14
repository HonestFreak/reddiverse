import React from 'react';

type StartOverlayProps = {
  visible: boolean;
};

export default function StartOverlay({ visible }: StartOverlayProps) {
  if (!visible) return null;
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
      background: 'rgba(0,0,0,0.5)',
      padding: '20px',
      borderRadius: '10px'
    }}>
      <h1>Voxel Game</h1>
      <p>Click to start playing</p>
      <p>W/S to move • A/D to rotate • Space to jump • Shift to sprint</p>
    </div>
  );
}


