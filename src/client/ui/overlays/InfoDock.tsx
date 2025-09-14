import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type WorldConfig = {
  worldName: string;
  buildingPermission: 'public' | 'restricted';
  builders: string[];
  owner: string;
};

type InfoDockProps = {
  isMobile: boolean;
  worldConfig: WorldConfig | null;
  canBuild: boolean;
  logs: string[];
};

export default function InfoDock({ isMobile, worldConfig, canBuild, logs }: InfoDockProps) {
  if (isMobile) return null;
  const [open, setOpen] = useState<null | 'world' | 'logs' | 'chat'>(null);

  const worldSummary = useMemo(() => {
    if (!worldConfig) return 'World';
    const perm = worldConfig.buildingPermission === 'public' ? '🌍 Public' : '🔒 Restricted';
    return `${worldConfig.worldName} • ${perm}`;
  }, [worldConfig]);

  const envSummary = useMemo(() => `${'💻 PC'} • ${canBuild ? '✏️ Can Build' : '👀 View Only'}`, [canBuild]);

  const Panel = ({ children }: { children: ReactNode }) => (
    <div className={`absolute bottom-14 left-0 w-[360px] max-w-[70vw] origin-bottom-left rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl p-3 text-white transition-all duration-200 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
      {children}
    </div>
  );

  return (
    <div className="absolute bottom-4 left-4 z-[1200]">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl bg-black/40 backdrop-blur-md p-2 border border-white/10 shadow-xl">
          <DockButton
            label="World"
            icon={<span className="text-lg">🌎</span>}
            active={open === 'world'}
            onClick={() => setOpen(open === 'world' ? null : 'world')}
          />
          <DockButton
            label="Logs"
            icon={<span className="text-lg">🐞</span>}
            active={open === 'logs'}
            onClick={() => setOpen(open === 'logs' ? null : 'logs')}
          />
          <DockButton
            label="Chat"
            icon={<span className="text-lg">💬</span>}
            active={open === 'chat'}
            onClick={() => setOpen(open === 'chat' ? null : 'chat')}
          />
        </div>

        {/* Panel */}
        <Panel>
          {open === 'world' && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">{worldSummary}</div>
              <div className="text-xs opacity-80">{envSummary}</div>
              {worldConfig && worldConfig.buildingPermission === 'restricted' && (
                <div className="text-[11px] opacity-70">Builders: {worldConfig.builders.length}</div>
              )}
            </div>
          )}
          {open === 'logs' && (
            <div className="max-h-[220px] overflow-y-auto">
              <div className="text-sm font-semibold mb-1">Debug Logs</div>
              {(!logs || logs.length === 0) ? (
                <div className="text-xs opacity-70">No logs</div>
              ) : (
                <div className="space-y-1 font-mono text-[11px] leading-snug">
                  {logs.map((l, i) => (
                    <div key={i} className="opacity-90">{l}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {open === 'chat' && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Chat</div>
              <div className="text-xs opacity-80">Coming soon ✨</div>
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
      className={`group relative flex items-center justify-center rounded-xl p-2 text-white transition-all duration-150 ${
        active ? 'bg-white/25 ring-2 ring-pink-400/60' : 'bg-white/10 hover:bg-white/20'
      }`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}


