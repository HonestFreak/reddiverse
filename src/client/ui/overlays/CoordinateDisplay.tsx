type CoordinateDisplayProps = {
  playerPosition: { x: number; y: number; z: number };
  chunkPosition: { x: number; z: number };
  isMobile: boolean;
};

export default function CoordinateDisplay({ playerPosition, chunkPosition, isMobile }: CoordinateDisplayProps) {
  if (isMobile) return null; // Don't show on mobile to keep UI clean

  return (
    <div className="absolute top-4 right-4 z-[1000] text-white text-shadow-lg">
      <div className="bg-black/60 backdrop-blur-md rounded-lg p-3 border border-white/10 shadow-xl">
        <div className="text-sm font-semibold mb-1">📍 Position</div>
        <div className="text-xs font-mono space-y-1">
          <div>X: {Math.round(playerPosition.x)}</div>
          <div>Y: {Math.round(playerPosition.y)}</div>
          <div>Z: {Math.round(playerPosition.z)}</div>
        </div>
        <div className="text-sm font-semibold mt-2 mb-1">🗂️ Chunk</div>
        <div className="text-xs font-mono">
          <div>Chunk: ({chunkPosition.x}, {chunkPosition.z})</div>
        </div>
      </div>
    </div>
  );
}
