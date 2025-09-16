import React, { useMemo } from 'react';

type StartOverlayProps = {
  visible: boolean;
  isLoading?: boolean;
  onStart?: () => void;
};

export default function StartOverlay({ visible, isLoading = false, onStart }: StartOverlayProps) {
  if (!visible) return null;

  const isTouch = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return ('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0;
  }, []);

  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center select-none">
      {/* Soft voxel-y radial tint */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200/50 via-emerald-200/40 to-amber-100/40 pointer-events-none" />

      <div className="relative mx-4 w-full max-w-2xl animate-pop">
        {/* Card */}
        <div className="rounded-2xl border-4 border-emerald-300 bg-white/90 px-8 py-8 shadow-2xl shadow-emerald-500/20 backdrop-blur text-center">
          <div className="space-y-8">
            {/* Title */}
            <div className="flex items-center justify-center">
              <PlainTitle text="Reddiverse" />
            </div>

            <br/>

            {/* Status / CTA */}
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="h-6 w-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <div className="text-emerald-900 font-fredoka text-[15px]">World is loading…</div>
              </div>
            ) : (
              <div className="w-full flex items-center justify-center">
                <div
                  onClick={onStart}
                  className="rounded-2xl bg-emerald-500/95 px-[50px] py-4 text-white text-xl font-bungee shadow-xl shadow-emerald-500/30 hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-300 active:scale-[0.98] transition"
                >
                  <div className="flex items-center justify-center px-[50px]">                  {isTouch ? ' Tap to continue ' : ' Click to continue '}
                  </div>
                </div>
              </div>
            )}

            <br/>

            {/* Controls */}
            <div className="grid grid-cols-1 gap-3 text-sm text-emerald-900">
              <Row icon="🕹️" label={
                <>
                  <Key>W</Key>/<Key>S</Key> to move • <Key>A</Key>/<Key>D</Key> to rotate
                </>
              } />
              <Row icon="🦘" label={<><Key>Space</Key> to jump • <Key>Shift</Key> to sprint</>} />
              <Row icon="🧱" label={<><Key>1</Key>-<Key>6</Key> to change material</>} />
            </div>

            {/* Decorative shimmer bar */}
            <div className="h-2 w-full overflow-hidden rounded bg-gradient-to-r from-emerald-200 via-white/70 to-emerald-200 animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label }: { icon: string; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg" aria-hidden>{icon}</span>
      <div className="font-fredoka text-[15px]">{label}</div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex min-w-[1.6rem] items-center justify-center rounded-md bg-white/90 px-2 py-0.5 text-[12px] font-semibold text-slate-800 shadow">
      {children}
    </span>
  );
}

// Plain title using Crackman font
function PlainTitle({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center">
      <h1 className="font-spenbeb text-orange-600 text-shadow-lg text-4xl">R</h1>
      <h1 className="font-spenbeb text-orange-600 text-4xl">E</h1>
      <h1 className="font-spenbeb text-orange-600 text-4xl">D</h1>
      <h1 className="font-spenbeb text-orange-600 text-4xl">D</h1>
      <h1 className="font-spenbeb text-orange-600 text-4xl">I</h1>
      <h1 className="font-spenbeb text-emerald-600 text-4xl">V</h1>
      <h1 className="font-spenbeb text-emerald-600 text-4xl">E</h1>
      <h1 className="font-spenbeb text-emerald-600 text-4xl">R</h1>
      <h1 className="font-spenbeb text-emerald-600 text-4xl">S</h1>
      <h1 className="font-spenbeb text-emerald-600 text-4xl">E</h1>
    </div>
  );
}


