 

type PlayerState = { life: number; isWinner: boolean; badge: string };

type PlayerStatusDesktopProps = {
  playerState: PlayerState;
};

export default function PlayerStatusDesktop({ playerState }: PlayerStatusDesktopProps) {
  const pct = Math.max(0, Math.min(100, playerState.life));
  const barColor = pct > 50 ? 'bg-green-400' : pct > 20 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="absolute bottom-[96px] left-1/2 -translate-x-1/2 z-[1200] w-[380px] max-w-[90vw]">
      <div className="h-3 w-full rounded-full bg-black/40 backdrop-blur-sm shadow-lg">
        <div className={`h-3 rounded-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}


