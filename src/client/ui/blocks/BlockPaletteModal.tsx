import { useMemo, useState } from 'react';
import type { BlockTypeRegistry } from '../../../shared/types/BlockTypes';

type BlockPaletteModalProps = {
  visible: boolean;
  allBlockTypes: BlockTypeRegistry;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreateSmart: () => void;
};

export default function BlockPaletteModal({ visible, allBlockTypes, onClose, onSelect, onCreateSmart }: BlockPaletteModalProps) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => Object.values(allBlockTypes).sort((a, b) => a.name.localeCompare(b.name)), [allBlockTypes]);
  const filtered = items.filter((bt) => bt.name.toLowerCase().includes(query.toLowerCase()) || bt.id.toLowerCase().includes(query.toLowerCase()));
  if (!visible) return null;
  return (
    <div className="absolute scroll-py-8 inset-0 z-[2000] flex items-center justify-center bgx-black/60 p-5">
      <div className="w-full max-w-2xl rounded-3xl p-1 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div role="dialog" aria-modal className="relative rounded-2xl p-4 bg-neutral-900 text-white shadow-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
          <div className="sticky top-0 z-10 p-4 bg-neutral-800/70 border-b border-white/10 backdrop-blur">
            <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks..."
              aria-label="Search blocks"
              className="flex-1 min-w-0 rounded-lg bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400 placeholder-white/40"
            />
            <button
              type="button"
              onClick={onCreateSmart}
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm leading-none bg-gradient-to-br from-pink-500 to-purple-500 text-white font-semibold shadow-md hover:shadow-pink-500/30 active:scale-95 transition"
            >
              + Smart Block
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto shrink-0 rounded-lg p-2 text-white/70 hover:text-white hover:bg-white/10 transition"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((bt) => {
              const tex = bt.textures.top || bt.textures.side || bt.textures.bottom;
              const icon = tex?.type === 'image' ? (
                <img src={tex.value} alt={bt.name} className="size-12 rounded-md object-cover" draggable={false} />
              ) : (
                <div className="size-12 rounded-md" style={{ backgroundColor: tex?.value ?? '#555' }} />
              );
              return (
                <button
                  key={bt.id}
                  onClick={() => { onSelect(bt.id); onClose(); }}
                  className="group flex items-center gap-3 rounded-xl bg-white/5 hover:bg-white/10 p-3 transition shadow-sm hover:shadow-md hover:scale-105"
                >
                  {icon}
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold leading-tight">{bt.name}</span>
                    <span className="text-[10px] opacity-60">{bt.id}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


