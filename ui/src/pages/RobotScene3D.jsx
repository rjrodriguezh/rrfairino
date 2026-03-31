import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Edges, Text } from "@react-three/drei";

function getAreaCenter(area) {
  const pts = area?.points ?? [];
  if (!pts.length) return { x: 0, y: 0 };

  const sum = pts.reduce(
    (acc, p) => ({
      x: acc.x + Number(p.x || 0),
      y: acc.y + Number(p.y || 0),
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / pts.length,
    y: sum.y / pts.length,
  };
}

function getAreaSize(area) {
  const pts = area?.points ?? [];
  if (!pts.length) return { w: 300, h: 400 };

  const xs = pts.map((p) => Number(p.x || 0));
  const ys = pts.map((p) => Number(p.y || 0));

  return {
    w: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    h: Math.max(1, Math.max(...ys) - Math.min(...ys)),
  };
}

function getFloorColor(floor, floorDefs) {
  const floorDef = (floorDefs ?? []).find(
    (f) => Number(f.floor) === Number(floor)
  );

  if (floorDef?.color) return floorDef.color;

  const colors = ["#2563eb", "#22c55e", "#92400e", "#f97316", "#7c3aed"];
  const index = (Number(floor || 1) - 1) % colors.length;
  return colors[index];
}

function Box3D({ area, floorDefs }) {
  const center = getAreaCenter(area);
  const size = getAreaSize(area);

  const floor = Number(area?.floor ?? 1);
  const rotationDeg = Number(area?.rotationDeg ?? 0);

  const floorDef = (floorDefs ?? []).find((f) => Number(f.floor) === floor);
  const zBase = Number(floorDef?.zBase ?? (-900 + (floor - 1) * 300));

  const boxHeightMm = 300;

  const posX = center.x / 100;
  const posY = zBase / 100 + boxHeightMm / 200;
  const posZ = center.y / 100;

  const width = size.w / 100;
  const height = boxHeightMm / 100;
  const depth = size.h / 100;

  const rotY = (rotationDeg * Math.PI) / 180;
  const color = getFloorColor(floor, floorDefs);

  return (
    <group position={[posX, posY, posZ]} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
        <Edges color="black" />
      </mesh>

      <Text
        position={[0, height / 2 + 0.15, 0]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {area.label}
      </Text>
    </group>
  );
}

export default function RobotScene3D({
  paintAreas = [],
  floorDefs = [],
  height = 520,
}) {
  const boxes = useMemo(
    () => (paintAreas ?? []).filter((a) => a.source === "single"),
    [paintAreas]
  );

  return (
    <div
      style={{
        width: "100%",
        height,
        border: "1px solid #d1d5db",
        borderRadius: 14,
        overflow: "hidden",
        background: "#f8fafc",
      }}
    >
      <Canvas camera={{ position: [18, 14, 18], fov: 50 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} />
        <directionalLight position={[-10, 10, -10]} intensity={0.6} />

        <Grid
          args={[80, 80]}
          cellSize={1}
          sectionSize={5}
          cellThickness={0.5}
          sectionThickness={1}
          infiniteGrid
          fadeDistance={120}
          fadeStrength={1}
        />

        <axesHelper args={[8]} />

        {boxes.map((area) => (
          <Box3D key={area.id} area={area} floorDefs={floorDefs} />
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}