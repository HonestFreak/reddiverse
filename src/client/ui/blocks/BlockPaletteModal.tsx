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
    <div className="absolute scroll-py-8 inset-0 z-[2000] flex items-center justify-center bg-black/60 p-5">
      <div className="px-[10px] py-4 max-w-2xl rounded-3xl p-1 bg-gradient-to-br from-pink-400/30 via-purple-400/30 to-blue-400/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="rounded-2xl p-4 bg-neutral-900 text-white shadow-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
          <div className="flex items-center gap-2 p-4 bg-neutral-800/70 border-b border-white/10">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks..."
              className="w-full rounded-lg bg-black/40 px-3 py-2 outline-none focus:ring-2 focus:ring-pink-400"
            />
            <button onClick={onCreateSmart} className="rounded-lg px-3 py-2 bg-gradient-to-br from-pink-500 to-purple-500 text-white font-medium shadow-md hover:shadow-pink-500/30 active:scale-95 transition">
              + Smart Block
            </button>
            <button onClick={onClose} className="rounded-lg px-3 py-2 bg-white/10 hover:bg-white/20">
              Close
            </button>
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


