import React from 'react';

type PlayerState = { life: number; isWinner: boolean; badge: string };

type PlayerStatusDesktopProps = {
  playerState: PlayerState;
};

export default function PlayerStatusDesktop({ playerState }: PlayerStatusDesktopProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      color: 'white',
      zIndex: 1000,
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.7)',
      padding: '12px',
      borderRadius: '8px',
      minWidth: '180px'
    }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Player Status</h4>
      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
        <span style={{ color: playerState.life > 50 ? '#4CAF50' : playerState.life > 20 ? '#FF9800' : '#f44336' }}>
          ❤️ Life: {playerState.life}/100
        </span>
      </div>
      {playerState.isWinner && (
        <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '14px' }}>🏆 Winner!</div>
      )}
      {playerState.badge && (
        <div style={{ color: '#2196F3', fontSize: '12px' }}>🏅 {playerState.badge}</div>
      )}
    </div>
  );
}


