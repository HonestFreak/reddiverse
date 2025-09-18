import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type WorldConfig = {
  worldName: string;
  buildingPermission: 'public' | 'restricted';
  builders: string[];
  owner: string;
  terrainType?: 'greenery' | 'desert' | 'mountains';
  seed?: number;
};

type PlayerPosition = {
  x: number;
  y: number;
  z: number;
};

type ChunkPosition = {
  x: number;
  z: number;
};

type InfoDockProps = {
  isMobile: boolean;
  worldConfig: WorldConfig | null;
  canBuild: boolean;
  logs: string[];
  playerPosition?: PlayerPosition;
  chunkPosition?: ChunkPosition;
  snailCount?: number;
};

export default function InfoDock({ isMobile, worldConfig, canBuild, logs, playerPosition, chunkPosition, snailCount }: InfoDockProps) {
  if (isMobile) return null;
  const [open, setOpen] = useState<null | 'world' | 'logs' | 'coords'>(null);

  const worldSummary = useMemo(() => {
    if (!worldConfig) return 'World';
    const perm = worldConfig.buildingPermission === 'public' ? '🌍' : '🔒';
    return `${worldConfig.worldName} ${perm}`;
  }, [worldConfig]);

  const terrainInfo = useMemo(() => {
    if (!worldConfig?.terrainType) return '';
    const terrainEmoji = worldConfig.terrainType === 'desert' ? '🏜️' : 
                        worldConfig.terrainType === 'mountains' ? '⛰️' : '🌲';
    return `${terrainEmoji} ${worldConfig.terrainType}`;
  }, [worldConfig]);

  const Panel = ({ children }: { children: ReactNode }) => (
    <div className={`absolute bottom-12 left-0 w-[280px] max-w-[60vw] origin-bottom-left rounded-xl border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl p-2 text-white transition-all duration-200 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
      {children}
    </div>
  );

  return (
    <div className="absolute bottom-4 left-4 z-[1200]">
      <div className="relative">
        <div className="flex items-center gap-1 rounded-xl bg-black/40 backdrop-blur-md p-1.5 border border-white/10 shadow-xl">
          <DockButton
            label="World"
            icon={<span className="text-sm">🌎</span>}
            active={open === 'world'}
            onClick={() => setOpen(open === 'world' ? null : 'world')}
          />
          <DockButton
            label="Coords"
            icon={<span className="text-sm">📍</span>}
            active={open === 'coords'}
            onClick={() => setOpen(open === 'coords' ? null : 'coords')}
          />
          <DockButton
            label="Logs"
            icon={<span className="text-sm">🐞</span>}
            active={open === 'logs'}
            onClick={() => setOpen(open === 'logs' ? null : 'logs')}
          />
        </div>

        {/* Panel */}
        <Panel>
          {open === 'world' && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold">{worldSummary}</div>
              <div className="text-[10px] opacity-80">{terrainInfo}</div>
              <div className="text-[10px] opacity-70">{canBuild ? '✏️ Can Build' : '👀 View Only'}</div>
              {worldConfig && worldConfig.buildingPermission === 'restricted' && (
                <div className="text-[9px] opacity-60">Builders: {worldConfig.builders.length}</div>
              )}
              {worldConfig?.seed && (
                <div className="text-[9px] opacity-60">Seed: {worldConfig.seed}</div>
              )}
              {snailCount !== undefined && (
                <div className="text-[9px] opacity-60">🐌 Snails: {snailCount}</div>
              )}
            </div>
          )}
          {open === 'coords' && playerPosition && (
            <div className="space-y-1">
              <div className="text-xs font-semibold">📍 Position</div>
              <div className="text-[10px] font-mono space-y-0.5">
                <div>X: {Math.round(playerPosition.x)}</div>
                <div>Y: {Math.round(playerPosition.y)}</div>
                <div>Z: {Math.round(playerPosition.z)}</div>
              </div>
              {chunkPosition && (
                <>
                  <div className="text-xs font-semibold mt-1">🗂️ Chunk</div>
                  <div className="text-[10px] font-mono">
                    ({chunkPosition.x}, {chunkPosition.z})
                  </div>
                </>
              )}
            </div>
          )}
          {open === 'logs' && (
            <div className="max-h-[180px] overflow-y-auto">
              <div className="text-xs font-semibold mb-1">Debug Logs</div>
              {(!logs || logs.length === 0) ? (
                <div className="text-[10px] opacity-70">No logs</div>
              ) : (
                <div className="space-y-0.5 font-mono text-[9px] leading-tight">
                  {logs.slice(-10).map((l, i) => (
                    <div key={i} className="opacity-90">{l}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function DockButton({ label, icon, active, onClick }: { label: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center justify-center rounded-lg p-1.5 text-white transition-all duration-150 ${
        active ? 'bg-white/25 ring-1 ring-pink-400/60' : 'bg-white/10 hover:bg-white/20'
      }`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}


