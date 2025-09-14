import React from 'react';
import { useVoxelGame } from './game/useVoxelGame';
import StartOverlay from './ui/overlays/StartOverlay';
import ErrorOverlay from './ui/overlays/ErrorOverlay';
import WorldInfo from './ui/overlays/WorldInfo';
import DebugLog from './ui/overlays/DebugLog';
import PlayerStatusDesktop from './ui/panels/PlayerStatusDesktop';
import PlayerStatusMobile from './ui/panels/PlayerStatusMobile';
import CreatorPanelDesktop from './ui/creator/CreatorPanelDesktop';
import CreatorPanelMobile from './ui/creator/CreatorPanelMobile';
import MobileControls from './ui/controls/MobileControls';
import BuilderManagementModal from './ui/modals/BuilderManagementModal';
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
    isOwner,
    worldConfig,
    showBuilderManagement,
    setShowBuilderManagement,
    builderInput,
    setBuilderInput,
    addBuilder,
    removeBuilder,
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
    handleJoystickStart,
    handleJoystickMove,
    handleJoystickEnd,
    handleMobileJump,
    addBlockAtPlayerRef,
    removeBlockAtPlayerRef,
  } = useVoxelGame();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ErrorOverlay message={sceneError} deviceLabel={isMobile ? 'mobile' : 'PC'} />
      <StartOverlay visible={!isPointerLocked && !isMobile && !sceneError} />
      {!sceneError && (
        <WorldInfo worldConfig={worldConfig} isMobile={isMobile} canBuild={canBuild} />
      )}
      {!sceneError && <DebugLog logs={debugLogs} />}

      {!sceneError && isMobile && (
        <PlayerStatusMobile
          playerState={playerState}
          isPostCreator={isPostCreator}
          mobileMoveState={mobileMoveState}
          mobileRotationState={mobileRotationState}
        />
      )}
      {!sceneError && !isMobile && <PlayerStatusDesktop playerState={playerState} />}

      {!sceneError && !isMobile && canBuild && (
        <CreatorPanelDesktop
          visible={true}
          isOwner={isOwner}
          worldConfig={worldConfig}
          allBlockTypes={allBlockTypes as any}
          selectedBlockType={selectedBlockType}
          onChangeBlockType={setSelectedBlockType}
          onAdd={() => addBlockAtPlayerRef.current()}
          onRemove={() => removeBlockAtPlayerRef.current()}
          onOpenSmart={() => setShowSmartCreate(true)}
          onOpenBuilderManagement={() => setShowBuilderManagement(true)}
        />
      )}

      {!sceneError && isMobile && canBuild && (
        <CreatorPanelMobile
          visible={true}
          allBlockTypes={allBlockTypes as any}
          selectedBlockType={selectedBlockType}
          onChangeBlockType={setSelectedBlockType}
          onAdd={() => addBlockAtPlayerRef.current()}
          onRemove={() => removeBlockAtPlayerRef.current()}
          onOpenSmart={() => setShowSmartCreate(true)}
        />
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
          onSprintStart={(e) => {
            e.preventDefault();
            const newState = { ...mobileMoveState, sprint: true };
            // setMobileMoveState provided inside hook; using set is encapsulated there
            // local fast update via refs is handled inside hook's handlers
          }}
          onSprintEnd={(e) => {
            e.preventDefault();
            const newState = { ...mobileMoveState, sprint: false };
          }}
        />
      )}

      {showBuilderManagement && worldConfig && (
        <BuilderManagementModal
          visible={true}
          worldConfig={worldConfig}
          builderInput={builderInput}
          onChangeBuilderInput={setBuilderInput}
          onAddBuilder={addBuilder}
          onRemoveBuilder={removeBuilder}
          onClose={() => setShowBuilderManagement(false)}
        />
      )}

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
              setSmartCreateStatus({ type: 'success', message: `Smart block "${smartForm.name}" created successfully!` });
              // Reload handled by hook-side logic when needed (kept simple here)
              setTimeout(() => { setShowSmartCreate(false); setSmartCreateStatus({ type: null, message: '' }); }, 2000);
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


