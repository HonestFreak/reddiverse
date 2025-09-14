import React from 'react';

type DebugLogProps = {
  logs: string[];
};

export default function DebugLog({ logs }: DebugLogProps) {
  if (!logs || logs.length === 0) return null;
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      color: 'white',
      zIndex: 1000,
      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
      background: 'rgba(0,0,0,0.8)',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxWidth: '400px',
      maxHeight: '200px',
      overflow: 'auto'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Debug Logs:</div>
      {logs.map((log, index) => (
        <div key={index} style={{ marginBottom: '2px', opacity: 0.9 }}>
          {log}
        </div>
      ))}
    </div>
  );
}


