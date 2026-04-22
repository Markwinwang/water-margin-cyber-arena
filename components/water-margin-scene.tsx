"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Billboard,
  Float,
  OrbitControls,
  PerspectiveCamera,
  Sparkles,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { HeroRecord, typeMeta } from "@/lib/water-margin";

function BattleStandard({ hero }: { hero: HeroRecord }) {
  const texture = useTexture(hero.artwork);
  const group = useRef<THREE.Group>(null);
  const primary = typeMeta[hero.type_key]?.color ?? "#d4b16a";
  const ring = typeMeta[hero.type_key]?.ring ?? "#f1d18f";
  const satellites = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const radius = 1.9 + (index % 2) * 0.34;
        return {
          position: [Math.cos(angle) * radius, ((index % 3) - 1) * 0.28, Math.sin(angle) * radius] as const,
          size: 0.08 + (index % 3) * 0.02,
        };
      }),
    []
  );

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.22;
    group.current.children.forEach((child, index) => {
      child.rotation.z += delta * (0.02 + index * 0.004);
    });
  });

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.7, 0]}>
        <torusGeometry args={[1.9, 0.06, 22, 120]} />
        <meshStandardMaterial color={primary} emissive={primary} emissiveIntensity={0.9} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.7, 0]}>
        <ringGeometry args={[2.22, 2.34, 120]} />
        <meshBasicMaterial color={ring} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>

      <Float speed={2.1} rotationIntensity={0.4} floatIntensity={0.9}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 2.9, 24]} />
          <meshStandardMaterial color="#4a3531" metalness={0.55} roughness={0.42} />
        </mesh>

        <mesh position={[0.74, 0.64, 0]} rotation={[0, -0.08, 0]}>
          <boxGeometry args={[0.12, 2.1, 0.14]} />
          <meshStandardMaterial color="#4a3531" metalness={0.55} roughness={0.42} />
        </mesh>

        <Billboard position={[0.92, 0.7, 0.04]}>
          <mesh>
            <planeGeometry args={[2.6, 2.96]} />
            <meshBasicMaterial map={texture} transparent opacity={0.96} />
          </mesh>
        </Billboard>

        <mesh position={[-0.92, 0.18, -0.2]} rotation={[0.24, 0.2, 0]}>
          <torusKnotGeometry args={[0.55, 0.14, 160, 22]} />
          <meshStandardMaterial
            color={ring}
            emissive={ring}
            emissiveIntensity={0.4}
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      </Float>

      {satellites.map((satellite, index) => (
        <mesh key={index} position={satellite.position}>
          <sphereGeometry args={[satellite.size, 18, 18]} />
          <meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}

export default function WaterMarginScene({ hero }: { hero: HeroRecord }) {
  const primary = `${typeMeta[hero.type_key]?.color ?? "#d4b16a"}33`;

  return (
    <div
      className="h-[420px] w-full overflow-hidden rounded-[28px] border border-[rgba(212,177,106,0.16)]"
      style={{
        background: `radial-gradient(circle at 50% 28%, ${primary}, transparent 24%), linear-gradient(180deg, rgba(27,18,18,0.94), rgba(13,10,12,0.96))`,
      }}
    >
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0.18, 6.6]} fov={42} />
        <color attach="background" args={["#110c10"]} />
        <ambientLight intensity={1.1} />
        <directionalLight intensity={1.7} position={[4, 6, 5]} color={typeMeta[hero.type_key]?.ring ?? "#f1d18f"} />
        <pointLight intensity={12} position={[0, 0.5, 3]} color={typeMeta[hero.type_key]?.color ?? "#d4b16a"} />
        <pointLight intensity={7} position={[-3, -2, -2]} color="#7d90ff" />
        <Sparkles count={68} scale={[7, 5, 7]} size={3} speed={0.45} color="#f6dca1" />
        <BattleStandard hero={hero} />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.48} />
      </Canvas>
    </div>
  );
}
