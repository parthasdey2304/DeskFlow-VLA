'use client';
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

function Arm() {
  const j0 = useRef<THREE.Group>(null);
  const j1 = useRef<THREE.Group>(null);
  const j2 = useRef<THREE.Group>(null);
  const [t, setT] = useState(0);
  useFrame((_, dt) => {
    setT((v) => v + dt);
    const s = t;
    if (j0.current) j0.current.rotation.y = Math.sin(s * 0.5) * 0.9;
    if (j1.current) j1.current.rotation.z = -0.6 + Math.sin(s * 0.7) * 0.25;
    if (j2.current) j2.current.rotation.z = 0.9 + Math.sin(s * 0.9 + 1) * 0.2;
  });
  const metal = { color: '#3f3f46', metalness: 0.85, roughness: 0.35 } as const;
  const accent = { color: '#fbbf24', metalness: 0.4, roughness: 0.4 } as const;
  return (
    <group position={[0, 0.1, 0]}>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.55, 0.65, 0.2, 32]} /><meshStandardMaterial {...metal} /></mesh>
      <group ref={j0} position={[0, 0.15, 0]}>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.28, 0.7, 0.28]} /><meshStandardMaterial {...metal} /></mesh>
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.3, 24]} /><meshStandardMaterial {...accent} /></mesh>
        <group ref={j1} position={[0, 0.72, 0]}>
          <mesh position={[0.55, 0, 0]}><boxGeometry args={[1.1, 0.18, 0.22]} /><meshStandardMaterial {...metal} /></mesh>
          <group ref={j2} position={[1.1, 0, 0]}>
            <mesh position={[0.4, -0.25, 0]}><boxGeometry args={[0.8, 0.14, 0.18]} /><meshStandardMaterial {...metal} /></mesh>
            <mesh position={[0.8, -0.45, 0]}><cylinderGeometry args={[0.09, 0.13, 0.3, 20]} /><meshStandardMaterial {...accent} /></mesh>
            <mesh position={[0.8, -0.62, 0]}><cylinderGeometry args={[0.16, 0.16, 0.05, 20]} /><meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.5} /></mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function DeskArmCanvas() {
  return (
    <div className="h-[320px] lg:h-[380px] w-full bg-[#0c0c0e]">
      <Canvas camera={{ position: [3.2, 2.4, 3.4], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} />
        <pointLight position={[-3, 2, -2]} intensity={0.5} color="#fbbf24" />
        <Arm />
        <Grid infiniteGrid sectionColor="#27272a" cellColor="#18181b" position={[0, -0.01, 0]} />
        <ContactShadows position={[0, 0, 0]} opacity={0.6} />
        <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
