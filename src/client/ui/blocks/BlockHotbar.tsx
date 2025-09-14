import React from 'react';
import type { BlockTypeRegistry } from '../../../shared/types/BlockTypes';

type BlockHotbarProps = {
  isMobile: boolean;
  allBlockTypes: BlockTypeRegistry;
  favorites: string[]; // up to 6 ids
  selectedBlockType: string;
  onSelect: (id: string) => void;
  onExpand: () => void;
};

function BlockIcon({ id, allBlockTypes }: { id: string; allBlockTypes: BlockTypeRegistry }) {
  const bt = allBlockTypes[id];
  if (!bt) return <div className="size-8 rounded-md bg-neutral-700" />;
  const tex = bt.textures.top || bt.textures.side || bt.textures.bottom;
  if (!tex) return <div className="size-8 rounded-md bg-neutral-700" />;
  if (tex.type === 'image') {
    return (
      <img
        src={tex.value}
        alt={bt.name}
        className="size-8 rounded-md object-cover"
        draggable={false}
      />
    );
  }
  return <div className="size-8 rounded-md" style={{ backgroundColor: tex.value }} />;
}

export default function BlockHotbar({ isMobile, allBlockTypes, favorites, selectedBlockType, onSelect, onExpand }: BlockHotbarProps) {
  const items = favorites.filter((id) => !!allBlockTypes[id]).slice(0, 6);
  const positionClasses = isMobile
    ? 'top-3 left-1/2 -translate-x-1/2'
    : 'bottom-5 left-1/2 -translate-x-1/2';

  return (
    <div className={`pointer-events-auto absolute ${positionClasses} z-[1100] select-none`}> 
      <div className="flex items-center gap-2 rounded-2xl bg-black/35 backdrop-blur-md p-2 shadow-2xl border border-white/10">
        {items.map((id, idx) => {
          const isSelected = id === selectedBlockType;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`relative flex items-center justify-center rounded-md p-2 transition-all duration-200 ${
                isSelected ? 'bg-white/30 scale-105 shadow-inner ring-2 ring-pink-400 ring-opacity-60' : 'bg-white/10 hover:bg-white/20'
              }`}
              aria-label={`Select ${allBlockTypes[id]?.name ?? id}`}
            >
              <BlockIcon id={id} allBlockTypes={allBlockTypes} />
              <span className="absolute -bottom-1 -right-1 text-[10px] rounded-md px-1 py-0.5 bg-black/60 text-white">
                {idx + 1}
              </span>
            </button>
          );
        })}
        <button
          onClick={onExpand}
          className="ml-1 flex items-center justify-center rounded-xl p-2 bg-gradient-to-br from-pink-400/60 to-purple-400/60 hover:from-pink-400 hover:to-purple-400 text-white transition-all duration-200 shadow-lg hover:shadow-pink-500/30"
          aria-label="Open block palette"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
            <path d="M12 2a5 5 0 015 5v1h1a4 4 0 010 8h-1v1a5 5 0 11-5-5h5a2 2 0 100-4h-3V7a3 3 0 10-6 0v8a2 2 0 002 2h1v2h-1a4 4 0 01-4-4V7a5 5 0 015-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}


