 

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

export default function PlayerStatusMobile({ playerState }: PlayerStatusMobileProps) {
  const pct = Math.max(0, Math.min(100, playerState.life));
  const barColor = pct > 50 ? 'bg-green-400' : pct > 20 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="absolute top-[56px] left-1/2 -translate-x-1/2 z-[1000] w-[90vw] max-w-[480px]">
      <div className="h-2.5 w-full rounded-full bg-black/40 backdrop-blur-sm shadow-lg">
        <div className={`h-2.5 rounded-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}


