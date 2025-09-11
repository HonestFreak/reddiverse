import { PlayerPosition } from '../../shared/types/api';

export async function init(): Promise<{ postId: string; username: string }> {
  const res = await fetch('/api/init');
  if (!res.ok) throw new Error('init failed');
  const data = await res.json();
  return { postId: data.postId, username: data.username };
}

export async function join(position: PlayerPosition): Promise<void> {
  await fetch('/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}

export async function leave(): Promise<void> {
  await fetch('/api/leave', { method: 'POST' });
}

export async function sendPosition(position: PlayerPosition): Promise<void> {
  await fetch('/api/pos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  });
}


