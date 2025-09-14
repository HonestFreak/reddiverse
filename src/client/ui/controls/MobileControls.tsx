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
        className="absolute bottom-7 left-7 z-[1000] flex items-center justify-center size-[120px] rounded-full border-4 border-white/50 bg-white/20 touch-none"
      >
        <div
          className="size-10 rounded-full border-2 border-white bg-white/80 pointer-events-none will-change-transform"
          style={{ transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`, transition: isJoystickActive ? 'none' : 'transform 0.2s ease' }}
        />
      </div>

      <div className="absolute bottom-7 right-7 z-[1000] flex flex-col gap-4">
        <button
          onTouchStart={onJump}
          className="size-[60px] rounded-full border-4 border-white/60 bg-white/30 text-white font-bold text-xs flex items-center justify-center touch-none active:scale-95 transition-transform"
        >
          JUMP
        </button>
        <button
          onTouchStart={onSprintStart}
          onTouchEnd={onSprintEnd}
          className="size-[60px] rounded-full border-4 border-white/60 bg-white/30 text-white font-bold text-[11px] flex items-center justify-center touch-none active:scale-95 transition-transform"
        >
          SPRINT
        </button>
      </div>
    </>
  );
}


