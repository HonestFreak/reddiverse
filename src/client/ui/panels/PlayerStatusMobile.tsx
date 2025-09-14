import React from 'react';

type PlayerState = { life: number; isWinner: boolean; badge: string };

type MoveState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
};

type RotationState = { left: boolean; right: boolean };

type PlayerStatusMobileProps = {
  playerState: PlayerState;
  isPostCreator: boolean;
  mobileMoveState: MoveState;
  mobileRotationState: RotationState;
};

export default function PlayerStatusMobile({ playerState, isPostCreator, mobileMoveState, mobileRotationState }: PlayerStatusMobileProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'white',
      textAlign: 'center',
      zIndex: 1000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.5)',
      padding: '10px 20px',
      borderRadius: '10px'
    }}>
      <h2>Voxel Game</h2>
      <p>Touch and drag to look • Use joystick to move and rotate</p>
      {isPostCreator && <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>✏️ Creator Mode - Tap blocks to edit</p>}
      <div style={{ fontSize: '14px', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
        <div style={{ color: playerState.life > 50 ? '#4CAF50' : playerState.life > 20 ? '#FF9800' : '#f44336' }}>
          ❤️ Life: {playerState.life}/100
        </div>
        {playerState.isWinner && <div style={{ color: '#FFD700', fontWeight: 'bold' }}>🏆 Winner!</div>}
        {playerState.badge && <div style={{ color: '#2196F3' }}>🏅 {playerState.badge}</div>}
      </div>
      <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.7 }}>
        Movement: {mobileMoveState.forward ? 'W' : ''}{mobileMoveState.backward ? 'S' : ''}
        {mobileRotationState.left ? 'A(rot)' : ''}{mobileRotationState.right ? 'D(rot)' : ''}
        {!mobileMoveState.forward && !mobileMoveState.backward && !mobileRotationState.left && !mobileRotationState.right && 'None'}
        {mobileMoveState.sprint && ' (Sprint)'}
      </div>
    </div>
  );
}


