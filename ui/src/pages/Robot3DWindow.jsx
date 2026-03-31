import React, { useEffect, useState } from "react";
import RobotScene3D from "./RobotScene3D";

function readRobot3DData() {
  try {
    return JSON.parse(localStorage.getItem("robot3d_data") || "{}");
  } catch {
    return {};
  }
}

export default function Robot3DWindow() {
  const [data, setData] = useState(() => readRobot3DData());

  useEffect(() => {
    const refresh = () => {
      setData(readRobot3DData());
    };

    const handleStorage = (e) => {
      if (e.key === "robot3d_data") {
        refresh();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refresh);

    const interval = setInterval(refresh, 500);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refresh);
      clearInterval(interval);
    };
  }, []);

  const paintAreas = data.paintAreas ?? [];
  const floorDefs = data.floorDefs ?? [];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 16,
        boxSizing: "border-box",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 12,
          color: "#111827",
        }}
      >
        Visor 3D
      </div>

      <RobotScene3D
        paintAreas={paintAreas}
        floorDefs={floorDefs}
        height={window.innerHeight - 80}
      />
    </div>
  );
}