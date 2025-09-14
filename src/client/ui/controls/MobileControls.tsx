import React from 'react';

type MobileControlsProps = {
  isMobile: boolean;
  joystickRef: React.MutableRefObject<HTMLDivElement | null>;
  joystickPosition: { x: number; y: number };
  isJoystickActive: boolean;
  onJoystickStart: (e: React.TouchEvent) => void;
  onJoystickMove: (e: React.TouchEvent) => void;
  onJoystickEnd: (e: React.TouchEvent) => void;
  onJump: () => void;
  onSprintStart: (e: React.TouchEvent) => void;
  onSprintEnd: (e: React.TouchEvent) => void;
};

export default function MobileControls({ isMobile, joystickRef, joystickPosition, isJoystickActive, onJoystickStart, onJoystickMove, onJoystickEnd, onJump, onSprintStart, onSprintEnd }: MobileControlsProps) {
  if (!isMobile) return null;
  return (
    <>
      <div
        ref={joystickRef}
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '30px',
          width: '120px',
          height: '120px',
          background: 'rgba(255,255,255,0.2)',
          border: '3px solid rgba(255,255,255,0.5)',
          borderRadius: '50%',
          zIndex: 1000,
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            background: 'rgba(255,255,255,0.8)',
            border: '2px solid white',
            borderRadius: '50%',
            transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
            transition: isJoystickActive ? 'none' : 'transform 0.2s ease',
            pointerEvents: 'none'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
      }}>
        <button
          onTouchStart={onJump}
          style={{
            background: 'rgba(255,255,255,0.3)',
            border: '3px solid rgba(255,255,255,0.6)',
            borderRadius: '50%',
            color: 'white',
            width: '60px',
            height: '60px',
            fontSize: '14px',
            fontWeight: 'bold',
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          JUMP
        </button>
        <button
          onTouchStart={onSprintStart}
          onTouchEnd={onSprintEnd}
          style={{
            background: 'rgba(255,255,255,0.3)',
            border: '3px solid rgba(255,255,255,0.6)',
            borderRadius: '50%',
            color: 'white',
            width: '60px',
            height: '60px',
            fontSize: '12px',
            fontWeight: 'bold',
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          SPRINT
        </button>
      </div>
    </>
  );
}


