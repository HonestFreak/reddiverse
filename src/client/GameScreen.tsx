import { useEffect } from 'react';
import { useVoxelGame } from './game/useVoxelGame';
import StartOverlay from './ui/overlays/StartOverlay';
import ErrorOverlay from './ui/overlays/ErrorOverlay';
// import WorldInfo from './ui/overlays/WorldInfo';
// import DebugLog from './ui/overlays/DebugLog';
import InfoDock from './ui/overlays/InfoDock';
import CoordinateDisplay from './ui/overlays/CoordinateDisplay';
import PlayerStatusDesktop from './ui/panels/PlayerStatusDesktop';
import PlayerStatusMobile from './ui/panels/PlayerStatusMobile';
import BlockHotbar from './ui/blocks/BlockHotbar';
import BlockPaletteModal from './ui/blocks/BlockPaletteModal';
import MobileControls from './ui/controls/MobileControls';
// import BuilderManagementModal from './ui/modals/BuilderManagementModal';
import SmartBlockCreateModal from './ui/modals/SmartBlockCreateModal';

export default function GameScreen() {
  const {
    canvasRef,
    isPointerLocked,
    isMobile,
    mobileMoveState,
    mobileRotationState,
    joystickPosition,
    isJoystickActive,
    joystickRef,
    isPostCreator,
    canBuild,
    // isOwner,
    worldConfig,
    showBuilderManagement,
    setShowBuilderManagement,
    // builderInput,
    // setBuilderInput,
    // addBuilder,
    // removeBuilder,
    selectedBlockType,
    setSelectedBlockType,
    allBlockTypes,
    showSmartCreate,
    setShowSmartCreate,
    playerState,
    smartCreateStatus,
    smartForm,
    setSmartForm,
    setSmartCreateStatus,
    sceneError,
    debugLogs,
    playerPosition,
    chunkPosition,
    handleJoystickStart,
    handleJoystickMove,
    handleJoystickEnd,
    handleMobileJump,
    handleMobileSprintStart,
    handleMobileSprintEnd,
    // addBlockAtPlayerRef,
    // removeBlockAtPlayerRef,
  } = useVoxelGame();

  // Hotbar favorites: pick a small default set; can be enhanced later to persist
  const favoriteIds = ['grass', 'stone', 'wood', 'sand', 'water', 'light'].filter((id) => (allBlockTypes as any)[id]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ErrorOverlay message={sceneError} deviceLabel={isMobile ? 'mobile' : 'PC'} />
      <StartOverlay visible={!isPointerLocked && !isMobile && !sceneError} />
      {!sceneError && (
        <>
          {/* Hide legacy overlays on desktop in favor of InfoDock */}
          {!isMobile && (
            <InfoDock isMobile={isMobile} worldConfig={worldConfig} canBuild={canBuild} logs={debugLogs} />
          )}
          {/* Coordinate display */}
          <CoordinateDisplay 
            playerPosition={playerPosition} 
            chunkPosition={chunkPosition} 
            isMobile={isMobile} 
          />
          {/* Keep legacy overlays for mobile only (per request: don't show info for mobile, so we skip both) */}
        </>
      )}

      {!sceneError && isMobile && (
        <PlayerStatusMobile
          playerState={playerState}
          isPostCreator={isPostCreator}
          mobileMoveState={mobileMoveState}
          mobileRotationState={mobileRotationState}
        />
      )}
      {!sceneError && !isMobile && <PlayerStatusDesktop playerState={playerState} />}

      {!sceneError && canBuild && (
        <>
          <BlockHotbar
            isMobile={isMobile}
            allBlockTypes={allBlockTypes as any}
            favorites={favoriteIds}
            selectedBlockType={selectedBlockType}
            onSelect={setSelectedBlockType}
            onExpand={() => setShowBuilderManagement(true)}
          />
          {/* Keyboard shortcuts 1-6 for quick selection (desktop) */}
          {(!isMobile) && (
            <KeyboardHotbarBinder
              favorites={favoriteIds}
              onSelect={setSelectedBlockType}
            />
          )}
          <BlockPaletteModal
            visible={showBuilderManagement}
            allBlockTypes={allBlockTypes as any}
            onClose={() => setShowBuilderManagement(false)}
            onSelect={(id) => setSelectedBlockType(id)}
            onCreateSmart={() => { setShowBuilderManagement(false); setShowSmartCreate(true); }}
          />
        </>
      )}

      {!sceneError && (
        <MobileControls
          isMobile={isMobile}
          joystickRef={joystickRef}
          joystickPosition={joystickPosition}
          isJoystickActive={isJoystickActive}
          onJoystickStart={handleJoystickStart}
          onJoystickMove={handleJoystickMove}
          onJoystickEnd={handleJoystickEnd}
          onJump={handleMobileJump}
          onSprintStart={(e) => { e.preventDefault(); handleMobileSprintStart(); }}
          onSprintEnd={(e) => { e.preventDefault(); handleMobileSprintEnd(); }}
        />
      )}

      {/* Builder management deprecated in UI for this pass; could be reintroduced elsewhere */}

      {showSmartCreate && !sceneError && (
        <SmartBlockCreateModal
          visible={true}
          form={smartForm}
          status={smartCreateStatus}
          onChangeForm={setSmartForm as any}
          onClose={() => { setShowSmartCreate(false); setSmartCreateStatus({ type: null, message: '' }); }}
          onSubmit={async () => {
            setSmartCreateStatus({ type: null, message: '' });
            try {
              if (!smartForm.name.trim()) { setSmartCreateStatus({ type: 'error', message: 'Name is required' }); return; }
              if (!smartForm.side && !smartForm.top && !smartForm.bottom) { setSmartCreateStatus({ type: 'error', message: 'At least one texture (side/top/bottom) is required' }); return; }
              let onClick, onTouch;
              try { onClick = smartForm.onClick.trim() ? JSON.parse(smartForm.onClick) : undefined; } catch (_) { setSmartCreateStatus({ type: 'error', message: 'Invalid onClick JSON format' }); return; }
              try { onTouch = smartForm.onTouch.trim() ? JSON.parse(smartForm.onTouch) : undefined; } catch (_) { setSmartCreateStatus({ type: 'error', message: 'Invalid onTouch JSON format' }); return; }
              const res = await fetch('/api/smart-blocks/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: smartForm.name, textures: { ...(smartForm.side ? { side: smartForm.side } : {}), ...(smartForm.top ? { top: smartForm.top } : {}), ...(smartForm.bottom ? { bottom: smartForm.bottom } : {}) }, onClick, onTouch }) });
              if (!res.ok) { const errorData = await res.json().catch(() => ({})); setSmartCreateStatus({ type: 'error', message: `Server error: ${errorData.message || res.statusText}` }); return; }
              await res.json();
              setSmartCreateStatus({ type: 'success', message: `Smart block "${smartForm.name}" created successfully! ✨` });
              // Small celebration animation is handled in the modal via animate-pulse class
              setTimeout(() => { setShowSmartCreate(false); setSmartCreateStatus({ type: null, message: '' }); }, 1200);
            } catch (e) {
              setSmartCreateStatus({ type: 'error', message: `Network error: ${e instanceof Error ? e.message : 'Unknown error'}` });
            }
          }}
        />
      )}

      {!sceneError && <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />}
    </div>
  );
}

function KeyboardHotbarBinder({ favorites, onSelect }: { favorites: string[]; onSelect: (id: string) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, number> = {
        Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5,
        Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5,
        KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyB: 4, KeyN: 5,
      };
      const idx = map[e.code];
      if (idx == null) return;
      if (idx < favorites.length) {
        onSelect(favorites[idx]!);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [favorites, onSelect]);
  return null;
}


