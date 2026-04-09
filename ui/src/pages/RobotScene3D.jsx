import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Edges, Text } from "@react-three/drei";

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
  const floor = Number(area?.floor ?? 1);
  const rotationDeg = Number(area?.rotationDeg ?? 0);

  const floorDef = (floorDefs ?? []).find((f) => Number(f.floor) === floor);
  const zBase = Number(floorDef?.zBase ?? 0);

  const boxHeightMm = 300;

  const posX = Number(area?.cx ?? 0) / 100;
  const posY = zBase / 100 + boxHeightMm / 200;
  const posZ = Number(area?.cy ?? 0) / 100;

  const width = Math.max(0.2, Number(area?.widthMm ?? 300) / 100);
  const height = boxHeightMm / 100;
  const depth = Math.max(0.2, Number(area?.depthMm ?? 400) / 100);

  const rotY = (rotationDeg * Math.PI) / 180;
  const color = getFloorColor(floor, floorDefs);

  return (
    <group position={[posX, posY, posZ]}>
      <mesh rotation={[0, rotY, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
        <Edges color="black" />
      </mesh>

      <Text
        position={[0, height / 2 + 0.2, 0]}
        rotation={[0, rotY, 0]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {area?.label ?? "BOX"}
      </Text>
    </group>
  );
}

export default function RobotScene3D({
  paintAreas = [],
  floorDefs = [],
  height = 520,
}) {
  const boxes = useMemo(() => {
    return (paintAreas ?? []).filter(
      (a) =>
        a &&
        a.source === "single" &&      // SOLO items reales
        a.label &&                    // debe tener label tipo B1
        a.widthMm < 2000 &&           // evita áreas gigantes
        a.depthMm < 2000
    );
  }, [paintAreas]);

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
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 20, 10]} intensity={1.4} />
        <directionalLight position={[-10, 10, -10]} intensity={0.8} />

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

        {boxes.map((area, index) => (
          <Box3D
            key={area?.id ?? area?.label ?? index}
            area={area}
            floorDefs={floorDefs}
          />
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}