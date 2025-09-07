import React from 'react';
import { Canvas } from '@react-three/fiber';

function TestCube() {
  return (
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshBasicMaterial color="red" />
    </mesh>
  );
}

function SimpleTest() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb' }}>
      <h1 style={{ position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 1000 }}>
        React Three Fiber Test
      </h1>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <TestCube />
      </Canvas>
    </div>
  );
}

export default SimpleTest;
