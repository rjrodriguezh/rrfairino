//CartesianPlayground.jsx
import React, { useEffect, useMemo, useRef, useState } from "react"; 


{/**
function open3DPopup() {
  localStorage.setItem(
    "robot3d_data",
    JSON.stringify({
      paintAreas,
      floorDefs,
      ts: Date.now(),
    })
  );

  const popup = window.open(
    "/robot-3d",
    "robot3d",
    "width=1400,height=900"
  );

  if (!popup) {
    alert("Popup bloqueado");
  }
}
 */}
function getAutoFloorColor(floor) {
  const colors = [
    "#2563eb", // azul
    "#22c55e", // verde
    "#92400e", // café
    "#f97316", // naranjo
    "#7c3aed", // morado (extra)
  ];

  const index = (Number(floor) - 1) % colors.length;
  return colors[index];
}


function syncRotationWithY(currentRotation, centerY) {
  const rot = Number(currentRotation) || 0;
  const y = Number(centerY) || 0;

  // si no está girado, no tocar
  if (rot === 0) return 0;

  if (y > 0) return -90;
  if (y < 0) return 90;
  return 0;
}


function rotateByView(x, y, side) {
  switch (side) {
    case "front": return { x, y };          // -Y (normal)
    case "right": return { x: y, y: -x };   // +X
    case "back": return { x: -x, y: -y };   // +Y
    case "left": return { x: -y, y: x };    // -X
    default: return { x, y };
  }
}


function projectDepthForSide(center, side) {
  const x = Number(center?.x ?? 0);
  const y = Number(center?.y ?? 0);

  switch (side) {
    case "front":
      return y;
    case "right":
      return -x;
    case "back":
      return -y;
    case "left":
      return x;
    default:
      return y;
  }
}


function zToY(z) {
  const minZ = -1200;   // más abajo
  const maxZ = 200;     // más arriba
  const height = 240;   // alto del SVG
  const topPad = 10;

  return topPad + ((maxZ - z) / (maxZ - minZ)) * height;
}


function frontXToSvg(xMm) {
  const minX = -2500;
  const maxX = 2500;
  const leftPad = 30;
  const width = 320;

  return leftPad + ((xMm - minX) / (maxX - minX)) * width;
}

function getContrastTextColor(hexColor) {
  if (!hexColor) return "#000";

  const c = hexColor.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);

  // luminancia
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);

  return luminance > 150 ? "#000000" : "#ffffff";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function snapToStep(value, step) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

function truncateLabel5(label) {
  const s = (label ?? "").trim();
  if (!s) return "";
  return s;
}

function rotatePointAroundCenter(px, py, cx, cy, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = px - cx;
  const dy = py - cy;

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function rotatePolygon(points, angleDeg) {
  if (!points || points.length === 0) return points ?? [];

  const center = findInteriorPoint(points);

  return points.map((p) =>
    rotatePointAroundCenter(p.x, p.y, center.x, center.y, angleDeg)
  );
}


  function nextRotationDeg(current, y) {
    const r = Number(current) || 0;
    const yVal = Number(y) || 0;

    if (yVal > 0) {
      if (r === 0) return -90;
      if (r === -90) return 0;
      return 0;
    }

    if (yVal < 0) {
      if (r === 0) return 90;
      if (r === 90) return 0;
      return 0;
    }

    return 0;
  }

function getRotationFromY(y) {
  const val = Number(y) || 0;
  const tolerance = 10; // mm

  if (val > tolerance) return -90;
  if (val < -tolerance) return 90;
  return 0;
}

function normalizeRotationDeg(value) {
  const n = Number(value) || 0;

  if (n <= -45) return -90;
  if (n >= 45) return 90;
  return 0;
}


function rectAreaFromCenter(cx, cy, w, h) {
  const halfW = w / 2;
  const halfH = h / 2;

  const left = cx - halfW;
  const right = cx + halfW;
  const bottom = cy - halfH;
  const top = cy + halfH;

  // orden: left-bottom, left-top, right-top, right-bottom
  return [
    { x: left, y: bottom },
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
  ];
}

function formatAreaCSVLine(label, points) {
  const L = truncateLabel5(label) || "AREA";
  const tuples = points
    .map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`)
    .join(",");
  return `${L},${tuples}`;
}

/** Extrae números (x,y) desde una string. */
function parseXY(input) {
  const s = (input ?? "").trim();
  if (!s) return { ok: false, error: "Vacío." };

  const matches = s.match(/[+-]?\d+(?:\.\d+)?/g);
  if (!matches || matches.length < 2) {
    return { ok: false, error: "Formato inválido (x,y)." };
  }

  const x = Number(matches[0]);
  const y = Number(matches[1]);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, error: "X o Y inválido." };
  }
  return { ok: true, x, y };
}

/**
 * Área por línea (CSV):
 *   Label,(x,y),(x,y),(x,y)...
 */
function parseAreaCSVLine(line) {
  const raw = (line ?? "").trim();
  if (!raw) return { ok: false, error: "Línea vacía." };

  const firstComma = raw.indexOf(",");
  if (firstComma === -1) {
    return { ok: false, error: "Falta coma después del label." };
  }

  const label = truncateLabel5(raw.slice(0, firstComma).trim()) || "AREA";
  const rest = raw.slice(firstComma + 1).trim();
  if (!rest) return { ok: false, error: "Faltan puntos." };

  const tupleRegex =
    /\(\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*\)/g;
  const tuples = rest.match(tupleRegex) || [];

  const points = [];
  for (const t of tuples) {
    const p = parseXY(t);
    if (p.ok) points.push({ x: p.x, y: p.y });
  }

  if (points.length < 3) {
    return { ok: false, error: "Área requiere mínimo 3 puntos (x,y)." };
  }

  return { ok: true, label, points };
}

/** Ray casting. poly = [{x,y},...] */
function pointInPolygon(pt, poly) {
  const x = pt.x;
  const y = pt.y;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Centroid (área ponderada). */
function polygonCentroid(poly) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const x0 = poly[i].x;
    const y0 = poly[i].y;
    const x1 = poly[j].x;
    const y1 = poly[j].y;
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    const avg = poly.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );
    return { x: avg.x / poly.length, y: avg.y / poly.length };
  }
  cx /= 6 * a;
  cy /= 6 * a;
  return { x: cx, y: cy };
}

function findInteriorPoint(poly) {
  if (!poly || poly.length < 3) return { x: 0, y: 0 };

  // 1) centroide si cae dentro
  const c = polygonCentroid(poly);
  if (pointInPolygon(c, poly)) return c;

  // 2) promedio si cae dentro
  const avg = poly.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  const avgPt = { x: avg.x / poly.length, y: avg.y / poly.length };
  if (pointInPolygon(avgPt, poly)) return avgPt;

  // 3) búsqueda local
  const step = 10;
  for (let r = 1; r <= 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const pt = { x: c.x + dx * step, y: c.y + dy * step };
        if (pointInPolygon(pt, poly)) return pt;
      }
    }
  }
  return poly[0];
}

// helper label box coords

function normalizeReferencePoints(rawPoints) {
  return (rawPoints ?? [])
    .filter(
      (p) =>
        p &&
        typeof p.name === "string" &&
        Number.isFinite(Number(p.x)) &&
        Number.isFinite(Number(p.y))
    )
    .map((p) => ({
      name: String(p.name).trim(),
      x: Number(p.x),
      y: Number(p.y),
    }));
}

function normalizeLabel(label) {
  return String(label ?? "").trim().toUpperCase();
}


function parseBlueLabelNumber(label) {
  const m = String(label ?? "")
    .trim()
    .toUpperCase()
    .match(/^B(\d+)$/);

  return m ? Number(m[1]) : null;
}

function getNextGlobalBlueNumber(areas) {
  const maxNum = Math.max(
    0,
    ...(areas ?? [])
      .filter((a) => a.source === "single")
      .map((a) => parseBlueLabelNumber(a.label))
      .filter((n) => Number.isFinite(n))
  );

  return maxNum + 1;
}

function getNextFloorNumber(floorDefs, paintAreas) {
  const floorsFromDefs = (floorDefs ?? [])
    .map((f) => Number(f.floor))
    .filter((n) => Number.isFinite(n));

  const floorsFromAreas = (paintAreas ?? [])
    .filter((a) => a.source === "single")
    .map((a) => Number(a.floor ?? 1))
    .filter((n) => Number.isFinite(n));

  const maxFloor = Math.max(0, ...floorsFromDefs, ...floorsFromAreas);
  return maxFloor + 1;
}


function getNextBlueLabel(areas) {
  const usedNums = (areas ?? [])
    .filter((a) => a.source === "single")
    .map((a) => {
      const m = normalizeLabel(a.label).match(/^B(\d+)$/);
      return m ? Number(m[1]) : null;
    })
    .filter((n) => Number.isFinite(n));

  let next = 1;
  while (usedNums.includes(next)) next += 1;
  return `B${next}`;
}


function labelBoxForValue(value, fontSizePx, paddingX = 3, paddingY = 2) {
  const s = String(value);
  const charW = fontSizePx * 0.62;
  const w = Math.max(12, Math.ceil(s.length * charW + paddingX * 2));
  const h = Math.max(8, Math.ceil(fontSizePx + paddingY * 2));
  return { w, h, padX: paddingX, padY: paddingY };
}




function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/* =========================
   LUA GENERATOR HELPERS
   ========================= */
function parseBoxNumber(label) {
  const m = String(label || "").match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

function sortBoxesForLua(list) {
  return [...(list || [])].sort((a, b) => {
    const na = parseBoxNumber(a.label);
    const nb = parseBoxNumber(b.label);
    if (na !== nb) return na - nb;
    return String(a.label).localeCompare(String(b.label));
  });
}

      function generateLuaFloor({ boxes, floorNumber }) {
        const lines = [];

        lines.push(`-- ####### PISO ${floorNumber}  #######`);
        lines.push("");
        lines.push("PTP(HZ,100,-1,0)");
        lines.push("");

        boxes.forEach((b) => {
          const itemX = Math.round(b.x);
          const itemY = Math.round(b.y);

          const rz = normalizeRotationDeg(b.rotationDeg ?? 0);

          let resultadoY = 0;
          let resultadoX = 0;
          let refY = 200;
          let ptpRef = "";

          let itemZ = 300;
          let itemSafeZ = 20;
          let ptpWaitZ = 0;
          let ptpTransicionZ = 0;
          let ptpLeftZ = 0;
          let ptpLeftSafeZ = 0;

          const zBase = Number(b.zBase ?? -900);

          ptpTransicionZ = zBase + itemZ + 200 + refY;
          ptpWaitZ = zBase + itemZ + refY;
          ptpLeftZ = zBase + itemZ;
          ptpLeftSafeZ = zBase + itemZ + itemSafeZ;

          if (itemY < 0) {
            resultadoY = itemY + 424;
            resultadoX = itemX - (-623);
            ptpRef = "PL";
          } else {
            resultadoX = itemX - (-623);
            resultadoY = itemY - 424;
            ptpRef = "PR";
          }

          const boxNumber = parseBoxNumber(b.label);

          lines.push(`-- BOX ${boxNumber} - Valor X: ${resultadoX}= ${itemX} - (-623)`);
          lines.push(`-- BOX ${boxNumber} - Valor Y: ${resultadoY} =${itemY} - 424`);
          lines.push("SetAuxDO(4,0,0,0)");
          lines.push("PTP(PickWait,100,-1,0)");
          lines.push("PTP(PickSafe,100,-1,0)");
          lines.push("PTP(PickPoint,100,-1,0)");
          lines.push("SetAuxDO(4,1,0,0)");
          lines.push("PTP(PickSafe,100,-1,0)");
          lines.push(`PTP(${ptpRef},100,-1,1,${resultadoX},${resultadoY},${ptpTransicionZ},0,0,${rz})`);
          lines.push(`PTP(${ptpRef},100,-1,1,${resultadoX},${resultadoY},${ptpWaitZ},0,0,${rz})`);
          lines.push(`PTP(${ptpRef},100,-1,1,${resultadoX},${resultadoY},${ptpLeftZ},0,0,${rz})`);
          lines.push("SetAuxDO(4,0,0,0)");
          lines.push(`PTP(${ptpRef},100,-1,1,${resultadoX},${resultadoY},${ptpLeftSafeZ},0,0,${rz})`);
          lines.push("");
        });

        return lines.join("\n");
      }

function generateLuaAllFloors({ paintAreas, floorDefs }) {
  const onlyBoxes = (paintAreas ?? []).filter((a) => a.source === "single");

  const floorsInUse = Array.from(
    new Set(onlyBoxes.map((a) => Number(a.floor ?? 1)))
  ).sort((a, b) => a - b);

  const allSections = floorsInUse.map((floorNumber) => {
    const floorDef = (floorDefs ?? []).find(
      (f) => Number(f.floor) === Number(floorNumber)
    );

    const zBaseFromFloor =
      Number(floorDef?.zBase) || (-900 + (Math.max(1, Number(floorNumber)) - 1) * 300);

    const boxes = sortBoxesForLua(
      onlyBoxes
        .filter((a) => Number(a.floor ?? 1) === Number(floorNumber))
        .map((a) => {
          const poly = a.points ?? [];
          const center = findInteriorPoint(poly);

          const xs = poly.map((p) => p.x);
          const ys = poly.map((p) => p.y);

          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          return {
            id: a.id,
            label: a.label,
            x: Math.round(center.x),
            y: Math.round(center.y),
            w: Math.round(maxX - minX),
            h: Math.round(maxY - minY),
            floor: floorNumber,
            rotationDeg: a.rotationDeg ?? 0,
            zBase: zBaseFromFloor,
          };
        })
    );

    return generateLuaFloor({
      boxes,
      floorNumber,
    });
  });

  return allSections.join("\n\n");
}

function getAreaCenter(area) {
  const poly = area?.points ?? [];
  return findInteriorPoint(poly);
}

export default function CartesianPlayground() {


  
    function open3DPopup() {
      const popup = window.open(
        "/robot-3d",
        "robot3d",
        "width=1400,height=900"
      );

      if (!popup) {
        alert("Popup bloqueado");
        return;
      }

      localStorage.setItem(
        "robot3d_data",
        JSON.stringify({
          paintAreas,
          floorDefs,
        })
      );
    }

  // refs
  const svgRef = useRef(null);

  // ✅ VIEWPORT responsivo (para que no corte paneles)
  const centerRef = useRef(null);
  const [viewportPx, setViewportPx] = useState(900);

  const [showReferencePoints, setShowReferencePoints] = useState(true); // variable para mostrar puntos definidos por el robot
  const referencePoints = useMemo(
    () =>
      normalizeReferencePoints([
        { name: "HZ", x: -991.811, y: -177.128 },
        { name: "Tomacaja2", x: -1463.567, y: -83.505 },
        { name: "Tomacaja1", x: -1463.577, y: -83.493 },
        { name: "TransR1", x: -749.996, y: 1000.005 },
        { name: "PalletRbox1", x: 216.998, y: 634.997 },
        { name: "PalletRbox21", x: 167.011, y: 585.010 },
      ]),
    []
  );


  const sectionGroupStyle = {
    border: "1px solid #222222",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12, // 👈 clave
    background: "#ffffff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  };

  const sectionGroupTitleStyle = {
    fontSize: 12,
    fontWeight: 800,
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };


  
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;

      // cuadrado que cabe en la columna central, con límites sanos
      const next = Math.floor(
        clamp(Math.min(r.width, window.innerHeight - 140), 520, 1600)
      );
      setViewportPx(next);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);



  // Zoom + Pan (cámara)
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // ✅ PAN (arrastrar fondo para mover cámara)
  const panDragRef = useRef({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // ✅ Drag (polígonos)
  const areaDragRef = useRef({
    active: false,
    mode: "single", // "single" | "floor"
    id: "",
    floor: null,
    startClientX: 0,
    startClientY: 0,
    startPoints: [],
    startAreasById: {},
  });

  // ✅ seleccionado
  const [selectedAreaId, setSelectedAreaId] = useState("");

  // ✅ Context menu / editor (click derecho + link "Editar")
  const [areaMenu, setAreaMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    areaId: "",
    draftLabel: "",
    draftXY: "",
    error: "",
  });


  const [frontViewSide, setFrontViewSide] = useState("front");


  // Panel add floors and Z value
  const [floorPanelOpen, setFloorPanelOpen] = useState(false);
  const [newFloorNumber, setNewFloorNumber] = useState(1);
  const [newFloorZ, setNewFloorZ] = useState(-900);

  const handleFloorChange = (value) => {
    const num = Math.max(1, Number(value) || 1);
    setNewFloorNumber(num);
    setNewFloorZ(getSuggestedFloorZBase(num));
  };

  

  const [floorDefs, setFloorDefs] = useState([]);

  
  const [newFloorSelected, setNewFloorSelected] = useState(1);

//separar items de un piso
const [spacingPanelOpen, setSpacingPanelOpen] = useState(false);
const [spacingFloorNumber, setSpacingFloorNumber] = useState(1);
const [spacingGapX, setSpacingGapX] = useState(20);
const [spacingGapY, setSpacingGapY] = useState(20);
const [spacingError, setSpacingError] = useState("");


  // clonacion pisos
  const [clonePanelOpen, setClonePanelOpen] = useState(false);
  const [cloneSourceFloor, setCloneSourceFloor] = useState(1);
  const [cloneTargetFloor, setCloneTargetFloor] = useState(2);
  const [cloneTargetColor, setCloneTargetColor] = useState("#16a34a");
  const [cloneError, setCloneError] = useState("");

  // mover pisos
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  const [moveFloorNumber, setMoveFloorNumber] = useState(1);
  const [moveFloorDx, setMoveFloorDx] = useState(0);
  const [moveFloorDy, setMoveFloorDy] = useState(0);
  const [moveError, setMoveError] = useState("");
  const [dragFloorTogether, setDragFloorTogether] = useState(false);

  useEffect(() => {
    if (!floorDefs || floorDefs.length === 0) return;

    const exists = floorDefs.some((f) => f.floor === newFloorSelected);
    if (!exists) {
      setNewFloorSelected(floorDefs[0].floor);
    }
  }, [floorDefs, newFloorSelected]);


  const [referencePaintPanelOpen, setReferencePaintPanelOpen] = useState(true);
  // Workspace
  const [workspaceXmm, setWorkspaceXmm] = useState(5000);
  const [workspaceYmm, setWorkspaceYmm] = useState(5200);
  const [workspaceOriginXmm, setWorkspaceOriginXmm] = useState(0);
  const [workspaceOriginYmm, setWorkspaceOriginYmm] = useState(0);

  // Grid
  const [gridMm, setGridMm] = useState(10);
  const [majorGridMm, setMajorGridMm] = useState(50);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Coordenadas visibles
  const [showCoords, setShowCoords] = useState(true);
  const [coordStepMm, setCoordStepMm] = useState(200);
  const [coordFontPx, setCoordFontPx] = useState(13);

  // Form agregar área azul
  const [newLabel, setNewLabel] = useState("B1");
  const [newXY, setNewXY] = useState("(417, -635)");
  const [newW, setNewW] = useState(300);
  const [newH, setNewH] = useState(400);
  const [addOneError, setAddOneError] = useState("");

  // Paint areas textarea
  const [paintEnabled, setPaintEnabled] = useState(true);
  const [paintPanelOpen, setPaintPanelOpen] = useState(false);
  const [blueAreasPanelOpen, setBlueAreasPanelOpen] = useState(false);
  const [luaPanelOpen, setLuaPanelOpen] = useState(false);


  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);


  const [blueAreasFloorFilter, setBlueAreasFloorFilter] = useState("ALL");

  const [paintAreasText, setPaintAreasText] = useState(
    "Robot,(-623,-425),(-623,425),(377,425),(377,-425)\nRLeft,(-623,-425),(-623,-1625),(377,-1625),(377,-425),\nRRight,(-623,425),(-623,1625),(377,1625),(377,425)"
  );
  const [paintAreas, setPaintAreas] = useState(() => []);
  const [paintAreasError, setPaintAreasError] = useState("");


  useEffect(() => {
  localStorage.setItem(
    "robot3d_data",
    JSON.stringify({
      paintAreas,
      floorDefs,
      ts: Date.now(),
    })
  );
}, [paintAreas, floorDefs]);

  // ✅ NUEVO: estados LUA (Piso 1)
  const [luaFloor1Text, setLuaFloorText] = useState("");

  const importProjectInputRef = useRef(null);

  // Scale (usando viewportPx)
  const baseScale = useMemo(() => {
    const pad = 16;
    const usableW = Math.max(1, viewportPx - pad * 2);
    const usableH = Math.max(1, viewportPx - pad * 2);
    const sx = usableW / workspaceXmm;
    const sy = usableH / workspaceYmm;
    return Math.min(sx, sy);
  }, [workspaceXmm, workspaceYmm, viewportPx]);

  const scale = useMemo(() => baseScale * zoom, [baseScale, zoom]);

  const pxDeltaToMmDelta = (dxPx, dyPx) => ({
    dx_mm: -dxPx / scale,
    dy_mm: dyPx / scale,
  });

  function stopAreaDrag() {
    areaDragRef.current.active = false;
    areaDragRef.current.mode = "single";
    areaDragRef.current.id = "";
    areaDragRef.current.floor = null;
    areaDragRef.current.startClientX = 0;
    areaDragRef.current.startClientY = 0;
    areaDragRef.current.startPoints = [];
    areaDragRef.current.startAreasById = {};
  }

  const stopPan = () => {
    panDragRef.current.active = false;
  };

  const canvasCenterPx = useMemo(() => {
    return {
      x: viewportPx / 2 + pan.x,
      y: viewportPx / 2 + pan.y,
    };
  }, [viewportPx, pan.x, pan.y]);

  // ✅ px -> mm
  const pxToMm = (x_px, y_px) => {
    // X invertido
    const x_rel = (canvasCenterPx.x - x_px) / scale;

    // Y invertido
    const y_rel = (y_px - canvasCenterPx.y) / scale;

    return {
      x_mm: x_rel + workspaceOriginXmm,
      y_mm: y_rel + workspaceOriginYmm,
    };
  };

  // limits
  const limits = useMemo(() => {
    const halfW = workspaceXmm / 2;
    const halfH = workspaceYmm / 2;
    return {
      minX: workspaceOriginXmm - halfW,
      maxX: workspaceOriginXmm + halfW,
      minY: workspaceOriginYmm - halfH,
      maxY: workspaceOriginYmm + halfH,
    };
  }, [workspaceXmm, workspaceYmm, workspaceOriginXmm, workspaceOriginYmm]);

  // mm -> px
    const mmToPx = (x_mm, y_mm) => {
      const x_rel = x_mm - workspaceOriginXmm;
      const y_rel = y_mm - workspaceOriginYmm;

      // X invertido: izquierda +X, derecha -X
      const x_px = canvasCenterPx.x - x_rel * scale;

      // Y invertido: arriba -Y, abajo +Y
      const y_px = canvasCenterPx.y + y_rel * scale;

      return { x_px, y_px };
    };

  const workspaceBorderPx = useMemo(() => {
    const p1 = mmToPx(limits.minX, limits.maxY);
    const p2 = mmToPx(limits.maxX, limits.minY);

    const left = Math.min(p1.x_px, p2.x_px);
    const top = Math.min(p1.y_px, p2.y_px);
    const w = Math.abs(p2.x_px - p1.x_px);
    const h = Math.abs(p2.y_px - p1.y_px);

    return { left, top, w, h };
  }, [limits.minX, limits.maxX, limits.minY, limits.maxY, mmToPx]);

  const gridLines = useMemo(() => {
    const lines = [];

    const startX = Math.ceil(limits.minX / gridMm) * gridMm;
    for (let x = startX; x <= limits.maxX; x += gridMm) {
      const isMajor = majorGridMm > 0 && Math.abs(x % majorGridMm) < 1e-9;
      const a = mmToPx(x, limits.minY);
      const b = mmToPx(x, limits.maxY);
      lines.push({
        key: `v_${x}`,
        x1: a.x_px,
        y1: a.y_px,
        x2: b.x_px,
        y2: b.y_px,
        major: isMajor,
      });
    }

    const startY = Math.ceil(limits.minY / gridMm) * gridMm;
    for (let y = startY; y <= limits.maxY; y += gridMm) {
      const isMajor = majorGridMm > 0 && Math.abs(y % majorGridMm) < 1e-9;
      const a = mmToPx(limits.minX, y);
      const b = mmToPx(limits.maxX, y);
      lines.push({
        key: `h_${y}`,
        x1: a.x_px,
        y1: a.y_px,
        x2: b.x_px,
        y2: b.y_px,
        major: isMajor,
      });
    }

    return lines;
  }, [
    limits.minX,
    limits.maxX,
    limits.minY,
    limits.maxY,
    gridMm,
    majorGridMm,
    mmToPx,
  ]);

  // ✅ Coordenadas visibles (SIN scroll)
  const coordLabels = useMemo(() => {
    if (!showCoords) return { xs: [], ys: [], usedStepMm: coordStepMm };

    const step = Math.max(10, Math.round(coordStepMm / 10) * 10);

    const leftPx = 0;
    const topPx = 0;
    const rightPx = viewportPx;
    const bottomPx = viewportPx;

    const tl = pxToMm(leftPx, topPx);
    const br = pxToMm(rightPx, bottomPx);

    const visMinX = Math.min(tl.x_mm, br.x_mm);
    const visMaxX = Math.max(tl.x_mm, br.x_mm);
    const visMinY = Math.min(tl.y_mm, br.y_mm);
    const visMaxY = Math.max(tl.y_mm, br.y_mm);

    const xs = [];
    const ys = [];

    // Labels X: pegados abajo
    const startX = Math.ceil(visMinX / step) * step;
    for (let x = startX; x <= visMaxX; x += step) {
      const p = mmToPx(x, visMinY);
      xs.push({
        key: `xl_${x}`,
        x: p.x_px,
        y: viewportPx - 12,
        value: x,
      });
    }

    // Labels Y: pegados a la izquierda
    const startY = Math.ceil(visMinY / step) * step;
    for (let y = startY; y <= visMaxY; y += step) {
      const p = mmToPx(visMinX, y);
      ys.push({
        key: `yl_${y}`,
        x: 12,
        y: p.y_px,
        value: y,
      });
    }

    return { xs, ys, usedStepMm: step };
  }, [showCoords, coordStepMm, viewportPx, pxToMm, mmToPx]);

  const axes = useMemo(() => {
    const xA = mmToPx(limits.minX, 0);
    const xB = mmToPx(limits.maxX, 0);
    const yA = mmToPx(0, limits.minY);
    const yB = mmToPx(0, limits.maxY);

    return {
      x1: xA.x_px,
      y1: xA.y_px,
      x2: xB.x_px,
      y2: xB.y_px,
      yx1: yA.x_px,
      yy1: yA.y_px,
      yx2: yB.x_px,
      yy2: yB.y_px,
    };
  }, [
    limits.minX,
    limits.maxX,
    limits.minY,
    limits.maxY,
    mmToPx,
  ]);

  const axisDirectionLabels = useMemo(() => {
    const margin = 42; // antes 22
    const cx = viewportPx / 2;
    const cy = viewportPx / 2;

    return {
      top: {
        x: cx,
        y: margin,
        text: "-Y",
      },
      bottom: {
        x: cx,
        y: viewportPx - margin,
        text: "+Y",
      },
      left: {
        x: margin,
        y: cy,
        text: "+X",
      },
      right: {
        x: viewportPx - margin,
        y: cy,
        text: "-X",
      },
    };
  }, [viewportPx]);



  function projectHorizontalForSide(center, side) {
    const x = Number(center?.x ?? 0);
    const y = Number(center?.y ?? 0);

    switch (side) {
      case "front":
        return x;
      case "right":
        return y;
      case "back":
        return -x;
      case "left":
        return -y;
      default:
        return x;
    }
  }


  function getSuggestedFloorZBase(floorNumber) {
    const itemZ = 300; // altura de cada piso
    return -900 + (Math.max(1, Number(floorNumber)) - 1) * itemZ;
  }

  function saveFloorDef() {
    const floor = Number(newFloorNumber);
    const zBase = Number(newFloorZ);
    const color = getAutoFloorColor(floor);

    if (!Number.isFinite(floor) || floor < 1) return;
    if (!Number.isFinite(zBase)) return;
    if (!color) return;

    setFloorDefs((prev) => {
      const exists = prev.some((f) => f.floor === floor);

      if (exists) {
        return prev
          .map((f) => (f.floor === floor ? { ...f, zBase, color } : f))
          .sort((a, b) => a.floor - b.floor);
      }

      return [...prev, { floor, zBase, color }].sort((a, b) => a.floor - b.floor);
    });
  }

  function deleteFloorDef(floorNumber) {
    setFloorDefs((prev) => prev.filter((f) => f.floor !== floorNumber));
  }


  function exportProjectToJson() {
    const projectData = {
      floors: floorDefs ?? [],
      areas: (paintAreas ?? [])
        .filter((a) => a.source === "single")
        .map((a) => {
          const center = areaSummaryPointMm(a);

          const xs = (a.points ?? []).map((p) => p.x);
          const ys = (a.points ?? []).map((p) => p.y);

          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          return {
            id: a.id,
            label: a.label,
            x: center.x,
            y: center.y,
            floor: a.floor ?? 1,
            rotationDeg: a.rotationDeg ?? 0,
            w: Math.round(maxX - minX),
            h: Math.round(maxY - minY),
          };
        }),
    };

    downloadJsonFile("proyecto_robot.json", projectData);
  }




  function importProjectFromFile(file) {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const rawText = String(evt.target?.result ?? "");
        const data = JSON.parse(rawText);

        const importedFloors = Array.isArray(data?.grupo2?.pisos)
        ? data.grupo2.pisos
        : [];

      const importedAreas = Array.isArray(data?.grupo2?.cajas)
        ? data.grupo2.cajas
        : [];

        const rebuiltAreas = importedAreas.map((a, idx) => {
          const x = Number(a.x ?? 0);
          const y = Number(a.y ?? 0);
          const w = Math.max(1, Number(a.w ?? 300));
          const h = Math.max(1, Number(a.h ?? 400));
          const rotationDeg = normalizeRotationDeg(a.rotationDeg ?? 0);

          let pts = rectAreaFromCenter(x, y, w, h);

          if (rotationDeg !== 0) {
            pts = rotatePolygon(pts, rotationDeg);
          }

          pts = pts.map((p) => ({
            x: clamp(p.x, limits.minX, limits.maxX),
            y: clamp(p.y, limits.minY, limits.maxY),
          }));

          return {
            id:
              a.id ||
              globalThis.crypto?.randomUUID?.() ||
              `imported-${idx}-${Date.now()}`,
            label: truncateLabel5(a.label) || `B${idx + 1}`,
            points: pts,
            source: "single",
            floor: Number(a.floor ?? 1),
            rotationDeg,
          };
        });

        setFloorDefs(importedFloors);
        setPaintAreas(rebuiltAreas);
        setSelectedAreaId("");
        setNewLabel(getNextBlueLabel(rebuiltAreas));
        setAddOneError("");
        setPaintAreasError("");
      } catch (err) {
        console.error("Error importing project:", err);
        alert("Error al cargar el archivo del proyecto.");
      }
    };

    reader.readAsText(file);
  }

  function getFloorColor(floor) {
    return getAutoFloorColor(floor);
  }


  // clonacion helpers
  function buildAreaFromExisting(area, overrides = {}) {
    return {
      ...area,
      id:
        globalThis.crypto?.randomUUID?.() ??
        String(Date.now() + Math.random()),
      label: overrides.label ?? area.label,
      floor: overrides.floor ?? area.floor ?? 1,
      rotationDeg: overrides.rotationDeg ?? area.rotationDeg ?? 0,
      points: (area.points ?? []).map((p) => ({
        x: clamp(p.x, limits.minX, limits.maxX),
        y: clamp(p.y, limits.minY, limits.maxY),
      })),
      source: "single",
    };
  }

  function cloneItemsFromFloor() {
    setCloneError("");

    const sourceFloor = Number(cloneSourceFloor);

    if (!Number.isFinite(sourceFloor) || sourceFloor < 1) {
      setCloneError("Piso origen inválido.");
      return;
    }

    const sourceItems = (paintAreas ?? []).filter(
      (a) => a.source === "single" && Number(a.floor ?? 1) === sourceFloor
    );

    if (sourceItems.length === 0) {
      setCloneError(`No hay ítems en el piso ${sourceFloor} para clonar.`);
      return;
    }

    const targetFloor = getNextFloorNumber(floorDefs, paintAreas);
    const targetColor = getAutoFloorColor(targetFloor);

    // Crear el nuevo piso automáticamente
    setFloorDefs((prev) => {
      const exists = prev.some((f) => Number(f.floor) === targetFloor);

      if (exists) {
        return prev
          .map((f) =>
            Number(f.floor) === targetFloor
              ? {
                  ...f,
                  color: targetColor,
                  zBase: Number(f.zBase ?? getSuggestedFloorZBase(targetFloor)),
                }
              : f
          )
          .sort((a, b) => a.floor - b.floor);
      }

      return [
        ...prev,
        {
          floor: targetFloor,
          zBase: getSuggestedFloorZBase(targetFloor),
          color: getAutoFloorColor(targetFloor),
        },
      ].sort((a, b) => a.floor - b.floor);
    });

    setPaintAreas((prev) => {
      let nextBlueNumber = getNextGlobalBlueNumber(prev);

      const cloned = sourceItems.map((area) => {
        const newLabel = `B${nextBlueNumber}`;
        nextBlueNumber += 1;

        return buildAreaFromExisting(area, {
          floor: targetFloor,
          label: newLabel,
        });
      });

      const nextAreas = [...prev, ...cloned];
      setNewLabel(`B${nextBlueNumber}`);
      return nextAreas;
    });

    setBlueAreasFloorFilter(String(targetFloor));
    setNewFloorSelected(targetFloor);

    // opcional: dejar sugerido el próximo color/piso
    setCloneTargetFloor(targetFloor + 1);
    setCloneTargetColor(getAutoFloorColor(targetFloor + 1));
  }



{/* asignar separacion entre items */}
  function applySpacingToFloor() {
  setSpacingError("");

  const floor = Number(spacingFloorNumber);
  let gapX = Number(spacingGapX);
  let gapY = Number(spacingGapY);

  if (!Number.isFinite(floor) || floor < 1) {
    setSpacingError("Piso inválido.");
    return;
  }

  if (!Number.isFinite(gapX) || !Number.isFinite(gapY)) {
    setSpacingError("Separación inválida.");
    return;
  }

  if (snapEnabled) {
    gapX = snapToStep(gapX, gridMm);
    gapY = snapToStep(gapY, gridMm);
  }

  const floorItems = (paintAreas ?? [])
    .filter((a) => a.source === "single" && Number(a.floor ?? 1) === floor)
    .map((a) => {
      const center = getAreaCenter(a);
      const xs = (a.points ?? []).map((p) => p.x);
      const ys = (a.points ?? []).map((p) => p.y);

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        area: a,
        centerX: center.x,
        centerY: center.y,
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY),
      };
    });

  if (floorItems.length === 0) {
    setSpacingError(`No hay ítems en el piso ${floor}.`);
    return;
  }

  // Agrupar por filas usando Y parecido
  const rowTolerance = 80;
  const sortedByYThenX = [...floorItems].sort((a, b) => {
    if (Math.abs(a.centerY - b.centerY) <= rowTolerance) {
      return a.centerX - b.centerX;
    }
    return a.centerY - b.centerY;
  });

  const rows = [];
  for (const item of sortedByYThenX) {
    const lastRow = rows[rows.length - 1];

    if (!lastRow) {
      rows.push([item]);
      continue;
    }

    const rowAvgY =
      lastRow.reduce((acc, r) => acc + r.centerY, 0) / lastRow.length;

    if (Math.abs(item.centerY - rowAvgY) <= rowTolerance) {
      lastRow.push(item);
    } else {
      rows.push([item]);
    }
  }

  // Ordenar cada fila por X
  rows.forEach((row) => row.sort((a, b) => a.centerX - b.centerX));

  // Centro global del conjunto
  const allCentersX = floorItems.map((i) => i.centerX);
  const allCentersY = floorItems.map((i) => i.centerY);

  const globalCenterX =
    allCentersX.reduce((acc, x) => acc + x, 0) / allCentersX.length;
  const globalCenterY =
    allCentersY.reduce((acc, y) => acc + y, 0) / allCentersY.length;

  const repositioned = [];

  // Recalcular posiciones fila por fila
  rows.forEach((row, rowIndex) => {
    const rowWidths = row.map((r) => r.width);
    const rowHeights = row.map((r) => r.height);

    const totalRowWidth =
      rowWidths.reduce((acc, w) => acc + w, 0) + gapX * Math.max(0, row.length - 1);

    let cursorX = globalCenterX - totalRowWidth / 2;

    const rowHeight = Math.max(...rowHeights);

    const totalLayoutHeight =
      rows.reduce((acc, r) => {
        const h = Math.max(...r.map((x) => x.height));
        return acc + h;
      }, 0) +
      gapY * Math.max(0, rows.length - 1);

    let startY = globalCenterY - totalLayoutHeight / 2;
    for (let i = 0; i < rowIndex; i++) {
      startY += Math.max(...rows[i].map((x) => x.height)) + gapY;
    }

    const newCenterY = startY + rowHeight / 2;

    row.forEach((item) => {
      const newCenterX = cursorX + item.width / 2;

      repositioned.push({
        id: item.area.id,
        newCenterX,
        newCenterY,
        oldCenterX: item.centerX,
        oldCenterY: item.centerY,
      });

      cursorX += item.width + gapX;
    });
  });

  const repositionMap = Object.fromEntries(
    repositioned.map((r) => [r.id, r])
  );

  setPaintAreas((prev) =>
    prev.map((a) => {
      if (a.source !== "single") return a;
      if (Number(a.floor ?? 1) !== floor) return a;

      const target = repositionMap[a.id];
      if (!target) return a;

      let dx = target.newCenterX - target.oldCenterX;
      let dy = target.newCenterY - target.oldCenterY;

      if (snapEnabled) {
        dx = snapToStep(dx, gridMm);
        dy = snapToStep(dy, gridMm);
      }

      return {
        ...a,
        points: (a.points ?? []).map((p) => ({
          x: clamp(p.x + dx, limits.minX, limits.maxX),
          y: clamp(p.y + dy, limits.minY, limits.maxY),
        })),
      };
    })
  );

  setBlueAreasFloorFilter(String(floor));
  setNewFloorSelected(floor);
}


{/* mover items */}
  function moveItemsFromFloor() {
    setMoveError("");

    const floor = Number(moveFloorNumber);
    const dxInput = Number(moveFloorDx);
    const dyInput = Number(moveFloorDy);

    if (!Number.isFinite(floor) || floor < 1) {
      setMoveError("Piso inválido.");
      return;
    }

    if (!Number.isFinite(dxInput) || !Number.isFinite(dyInput)) {
      setMoveError("Desplazamiento inválido.");
      return;
    }

    let dx = dxInput;
    let dy = dyInput;

    if (snapEnabled) {
      dx = snapToStep(dx, gridMm);
      dy = snapToStep(dy, gridMm);
    }

    const sourceItems = (paintAreas ?? []).filter(
      (a) => a.source === "single" && Number(a.floor ?? 1) === floor
    );

    if (sourceItems.length === 0) {
      setMoveError(`No hay ítems en el piso ${floor} para mover.`);
      return;
    }

    setPaintAreas((prev) =>
      prev.map((a) => {
        if (a.source !== "single") return a;
        if (Number(a.floor ?? 1) !== floor) return a;

        return {
          ...a,
          points: (a.points ?? []).map((p) => ({
            x: clamp(p.x + dx, limits.minX, limits.maxX),
            y: clamp(p.y + dy, limits.minY, limits.maxY),
          })),
        };
      })
    );

    setBlueAreasFloorFilter(String(floor));
    setNewFloorSelected(floor);
  }
  function areaSummaryPointMmRaw(area) {
    const poly = area?.points ?? [];
    const p = findInteriorPoint(poly);
    return { x: p.x, y: p.y };
  }

  function areaSummaryPointMm(area) {
    const p = areaSummaryPointMmRaw(area);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  function openAreaEditorAt(clientX, clientY, areaId) {
    const area = (paintAreas ?? []).find((a) => a.id === areaId);
    if (!area) return;

    const p = areaSummaryPointMmRaw(area);
    setSelectedAreaId(areaId);
    setAreaMenu({
      open: true,
      x: clientX,
      y: clientY,
      areaId,
      draftLabel: truncateLabel5(area.label) || "AREA",
      draftXY: `(${Math.round(p.x)}, ${Math.round(p.y)})`,
      error: "",
    });
  }

  const onAreaContextMenu = (e, areaId) => {
    e.preventDefault();
    e.stopPropagation();
    openAreaEditorAt(e.clientX, e.clientY, areaId);
  };

  useEffect(() => {
    const close = () => setAreaMenu((m) => ({ ...m, open: false, areaId: "" }));
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);



  function rotateArea90(areaId) {
    setPaintAreas((prev) =>
      prev.map((a) => {
        if (a.id !== areaId) return a;
        if (a.source !== "single") return a;

        const center = findInteriorPoint(a.points ?? []);
        const nextRotation = nextRotationDeg(a.rotationDeg ?? 0, center.y);

        const delta = nextRotation - (a.rotationDeg ?? 0);

        const rotatedPoints = rotatePolygon(a.points ?? [], delta).map((p) => ({
          x: clamp(p.x, limits.minX, limits.maxX),
          y: clamp(p.y, limits.minY, limits.maxY),
        }));

        return {
          ...a,
          points: rotatedPoints,
          rotationDeg: nextRotation,
        };
      })
    );
  }


  function deletePolygon(id) {
    setPaintAreas((prev) => {
      const nextAreas = prev.filter((a) => a.id !== id);
      setNewLabel(getNextBlueLabel(nextAreas));
      return nextAreas;
    });

    setSelectedAreaId((cur) => (cur === id ? "" : cur));
    setAreaMenu((m) =>
      m.areaId === id ? { ...m, open: false, areaId: "" } : m
    );
  }

  function applyAreaEdit() {
    const area = (paintAreas ?? []).find((a) => a.id === areaMenu.areaId);
    if (!area) return;

    const parsed = parseXY(areaMenu.draftXY);
    if (!parsed.ok) {
      setAreaMenu((m) => ({ ...m, error: parsed.error }));
      return;
    }

    const newLab = truncateLabel5(areaMenu.draftLabel) || "AREA";
    const cur = areaSummaryPointMmRaw(area); // (float)
    let dx = parsed.x - cur.x;
    let dy = parsed.y - cur.y;

    if (snapEnabled) {
      dx = snapToStep(dx, gridMm);
      dy = snapToStep(dy, gridMm);
    }

    setPaintAreas((prev) =>
      prev.map((a) => {
        if (a.id !== area.id) return a;
        const moved = (a.points ?? []).map((p) => ({
          x: clamp(p.x + dx, limits.minX, limits.maxX),
          y: clamp(p.y + dy, limits.minY, limits.maxY),
        }));

        const movedCenter = findInteriorPoint(moved);
        const nextRotationDeg = syncRotationWithY(a.rotationDeg ?? 0, movedCenter.y);

        return {
          ...a,
          label: newLab,
          points: moved,
          rotationDeg: nextRotationDeg,
        };
      })
    );

    setAreaMenu((m) => ({ ...m, error: "" }));
  }

  const onAreaPointerDown = (e, areaId) => {
    if (e.button === 2) return;

    e.preventDefault();
    e.stopPropagation();

    setSelectedAreaId(areaId);

    const area = (paintAreas ?? []).find((a) => a.id === areaId);
    if (!area) return;

    const floor = Number(area.floor ?? 1);

    areaDragRef.current.active = true;
    areaDragRef.current.id = areaId;
    areaDragRef.current.floor = floor;
    areaDragRef.current.startClientX = e.clientX;
    areaDragRef.current.startClientY = e.clientY;

    if (dragFloorTogether) {
      const floorAreas = (paintAreas ?? []).filter(
        (a) => a.source === "single" && Number(a.floor ?? 1) === floor
      );

      const startAreasById = {};
      for (const a of floorAreas) {
        startAreasById[a.id] = (a.points ?? []).map((p) => ({ ...p }));
      }

      areaDragRef.current.mode = "floor";
      areaDragRef.current.startPoints = [];
      areaDragRef.current.startAreasById = startAreasById;
    } else {
      areaDragRef.current.mode = "single";
      areaDragRef.current.startPoints = (area.points ?? []).map((p) => ({ ...p }));
      areaDragRef.current.startAreasById = {};
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onAreaDragMove = (e) => {
    if (!areaDragRef.current.active) return;

    const dxPx = e.clientX - areaDragRef.current.startClientX;
    const dyPx = e.clientY - areaDragRef.current.startClientY;
    const { dx_mm, dy_mm } = pxDeltaToMmDelta(dxPx, dyPx);

    let dx = dx_mm;
    let dy = dy_mm;

    if (snapEnabled) {
      dx = snapToStep(dx, gridMm);
      dy = snapToStep(dy, gridMm);
    }

    const mode = areaDragRef.current.mode;

    if (mode === "floor") {
      const floor = Number(areaDragRef.current.floor ?? 1);
      const startAreasById = areaDragRef.current.startAreasById || {};

      setPaintAreas((prev) =>
        prev.map((a) => {
          if (a.source !== "single") return a;
          if (Number(a.floor ?? 1) !== floor) return a;

          const startPoints = startAreasById[a.id];
          if (!startPoints) return a;

          const moved = startPoints.map((p) => ({
            x: clamp(p.x + dx, limits.minX, limits.maxX),
            y: clamp(p.y + dy, limits.minY, limits.maxY),
          }));

          const movedCenter = findInteriorPoint(moved);
          const nextRotationDeg = syncRotationWithY(a.rotationDeg ?? 0, movedCenter.y);

          return {
            ...a,
            points: moved,
            rotationDeg: nextRotationDeg,
          };
        })
      );

      return;
    }

    const areaId = areaDragRef.current.id;
    const startPoints = areaDragRef.current.startPoints || [];

    setPaintAreas((prev) =>
      prev.map((a) => {
        if (a.id !== areaId) return a;

        const moved = startPoints.map((p) => ({
          x: clamp(p.x + dx, limits.minX, limits.maxX),
          y: clamp(p.y + dy, limits.minY, limits.maxY),
        }));

        const movedCenter = findInteriorPoint(moved);
        const nextRotationDeg = syncRotationWithY(a.rotationDeg ?? 0, movedCenter.y);

        return {
          ...a,
          points: moved,
          rotationDeg: nextRotationDeg,
        };
      })
    );
  };

  // ✅ PAN handlers
  const onPanPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    panDragRef.current.active = true;
    panDragRef.current.startClientX = e.clientX;
    panDragRef.current.startClientY = e.clientY;
    panDragRef.current.startPanX = pan.x;
    panDragRef.current.startPanY = pan.y;

    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPanPointerMove = (e) => {
    if (!panDragRef.current.active) return;

    const dx = e.clientX - panDragRef.current.startClientX;
    const dy = e.clientY - panDragRef.current.startClientY;

    setPan({
      x: panDragRef.current.startPanX + dx,
      y: panDragRef.current.startPanY + dy,
    });
  };

  // ✅ zoom con rueda
  const onWheelZoom = (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    setZoom((z) => {
      const next = delta > 0 ? z - 0.1 : z + 0.1;
      return clamp(next, 1, 4);
    });
  };

  // ✅ Router de eventos SVG (PAN + Drag áreas)
  const onSvgPointerMove = (e) => {
    if (areaDragRef.current.active) {
      onAreaDragMove(e);
      return;
    }
    onPanPointerMove(e);
  };

  const onSvgPointerUp = () => {
    stopPan();
    stopAreaDrag();
  };

  const onSvgPointerLeave = () => {
    stopPan();
    stopAreaDrag();
  };

  const onSvgPointerCancel = () => {
    stopPan();
    stopAreaDrag();
  };

  const addOnePoint = () => {
    setAddOneError("");

    const rawLabel = truncateLabel5(newLabel) || "AREA";
    const label = normalizeLabel(rawLabel);

    if (!floorDefs || floorDefs.length === 0) {
      setAddOneError("Debes definir al menos un piso antes de agregar un área azul.");
      return;
    }

    const labelExists = (paintAreas ?? []).some(
      (a) => a.source === "single" && normalizeLabel(a.label) === label
    );

    if (labelExists) {
      setAddOneError(`El label ${label} ya existe. Usa otro.`);
      return;
    }

    const parsed = parseXY(newXY);
    if (!parsed.ok) {
      setAddOneError(`Coordenadas inválidas: ${parsed.error}`);
      return;
    }

    let x = parsed.x;
    let y = parsed.y;

    if (snapEnabled) {
      x = snapToStep(x, gridMm);
      y = snapToStep(y, gridMm);
    }

    x = clamp(x, limits.minX, limits.maxX);
    y = clamp(y, limits.minY, limits.maxY);

    const w = Number(newW);
    const h = Number(newH);
    const w_mm = Number.isFinite(w) && w > 0 ? w : null;
    const h_mm = Number.isFinite(h) && h > 0 ? h : null;

    if (!w_mm || !h_mm) {
      setAddOneError("Para crear un polígono debes indicar ancho y alto (>0).");
      return;
    }

    let pts = rectAreaFromCenter(x, y, w_mm, h_mm);
    pts = pts.map((p) => ({
      x: clamp(p.x, limits.minX, limits.maxX),
      y: clamp(p.y, limits.minY, limits.maxY),
    }));

    const newAreaId =
      globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random());

    const newArea = {
      id: newAreaId,
      label,
      points: pts,
      source: "single",
      floor: newFloorSelected,
      rotationDeg: 0,
    };

    setPaintAreas((prev) => {
      const nextAreas = [...prev, newArea];
      setNewLabel(getNextBlueLabel(nextAreas));
      return nextAreas;
    });

    setSelectedAreaId(newAreaId);

    const line = formatAreaCSVLine(label, pts);
    setPaintAreasText((prev) => {
      const base = (prev ?? "").trim();
      return base ? `${base}\n${line}` : line;
    });
  };

  function applyPaintAreas() {
    const lines = (paintAreasText ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const areas = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
      const parsed = parseAreaCSVLine(lines[i]);
      if (!parsed.ok) {
        errors.push(`Línea ${i + 1}: ${parsed.error}`);
        continue;
      }
      areas.push({
        id:
          globalThis.crypto?.randomUUID?.() ??
          String(Date.now() + Math.random()),
        label: parsed.label,
        points: parsed.points,
        source: "csv",
      });
    }

    if (areas.length === 0) {
      setPaintAreasError(
        errors.length ? errors.join(" | ") : "No hay áreas válidas."
      );
      setPaintAreas([]);
      return;
    }

    setPaintAreasError(errors.length ? errors.slice(0, 4).join(" | ") : "");
    setPaintAreas(areas);
  }

  useEffect(() => {
    applyPaintAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paintAreasSvg = useMemo(() => {
    if (!paintEnabled) return [];

    const PAD_MM = 20;

    return (paintAreas ?? []).map((area) => {
      const polyMm = (area.points ?? []).map((p) => ({ x: p.x, y: p.y }));

      const ptsPx = polyMm.map((p) => {
        const pp = mmToPx(p.x, p.y);
        return { x_px: pp.x_px, y_px: pp.y_px };
      });
      const pointsAttr = ptsPx.map((p) => `${p.x_px},${p.y_px}`).join(" ");

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const p of polyMm) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      const centerMm = findInteriorPoint(polyMm);

      const labelPaddingMm = 40;

      const labelTopRightMm = {
        x: minX + labelPaddingMm,
        y: minY + labelPaddingMm,
      };

      const labelCenterPx = mmToPx(centerMm.x, centerMm.y);
      const labelTopRightPx = mmToPx(labelTopRightMm.x, labelTopRightMm.y);

      return {
        id: area.id,
        label: truncateLabel5(area.label) || "AREA",
        source: area.source ?? "csv",
        floor: area.floor ?? null,
        color: getFloorColor(area.floor ?? 1),
        pointsAttr,
        labelCenterPx,
        labelTopRightPx,
        summary: {
          x_mm: Math.round(centerMm.x),
          y_mm: Math.round(centerMm.y),
        },
      };
    });
  }, [paintEnabled, paintAreas, mmToPx]);




  const frontViewBoxes = useMemo(() => {
    const boxHeight = 300;

    return (paintAreas ?? [])
      .filter((a) => a.source === "single")
      .map((a) => {
        const floorDef = floorDefs.find((f) => f.floor === (a.floor ?? 1));
        const zBase = floorDef?.zBase ?? -900;
        const center = areaSummaryPointMm(a);

        const xs = (a.points ?? []).map((p) => p.x);
        const ys = (a.points ?? []).map((p) => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        let horizontalMinMm = 0;
        let horizontalMaxMm = 0;

        switch (frontViewSide) {
          case "front":
            horizontalMinMm = minX;
            horizontalMaxMm = maxX;
            break;
          case "right":
            horizontalMinMm = minY;
            horizontalMaxMm = maxY;
            break;
          case "back":
            horizontalMinMm = -maxX;
            horizontalMaxMm = -minX;
            break;
          case "left":
            horizontalMinMm = -maxY;
            horizontalMaxMm = -minY;
            break;
          default:
            horizontalMinMm = minX;
            horizontalMaxMm = maxX;
        }

        const rotated = rotateByView(center.x, center.y, frontViewSide);

        return {
          id: a.id,
          label: a.label,
          floor: a.floor ?? 1,
          zBase,
          boxHeight,
          color: getFloorColor(a.floor ?? 1),
          horizontalMm: rotated.x,
          horizontalMinMm,
          horizontalMaxMm,
          depthMm: rotated.y,
        };
      });
  }, [paintAreas, floorDefs, frontViewSide]);



  const visibleFrontViewBoxes = useMemo(() => {
  const scaleX = 320 / 5000;

  const projected = [...frontViewBoxes]
    .map((b) => {
      const x1 = frontXToSvg(b.horizontalMinMm);
      const x2 = frontXToSvg(b.horizontalMaxMm);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);

      const yTop = zToY(b.zBase + b.boxHeight);
      const yBottom = zToY(b.zBase);
      const top = Math.min(yTop, yBottom);
      const bottom = Math.max(yTop, yBottom);

      return {
        ...b,
        left,
        right,
        top,
        bottom,
        widthPx: Math.max((right - left), 10),
        heightPx: Math.max((bottom - top), 10),
      };
    })
    .sort((a, b) => a.depthMm - b.depthMm);

  const visible = [];

  for (const box of projected) {
    const occluded = visible.some((v) => {
      const overlapX = !(box.right <= v.left || box.left >= v.right);
      const overlapY = !(box.bottom <= v.top || box.top >= v.bottom);
      return overlapX && overlapY;
    });

    if (!occluded) {
      visible.push(box);
    }
  }

  return visible;
}, [frontViewBoxes]);

  
  // ✅ listado de áreas azules (source === "single")
  const blueAreasList = useMemo(() => {
  const list = (paintAreasSvg ?? [])
    .filter((a) => a.source === "single")
    .map((a) => {
      const raw = paintAreas.find((p) => p.id === a.id);
      return {
        id: a.id,
        label: truncateLabel5(a.label) || "AREA",
        x: a.summary.x_mm,
        y: a.summary.y_mm,
        floor: raw?.floor ?? 1,
        rotationDeg: raw?.rotationDeg ?? 0,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  return list;
}, [paintAreasSvg, paintAreas]);

  
    const blueAreasGroupedByFloor = useMemo(() => {
      const sourceList =
        blueAreasFloorFilter === "ALL"
          ? blueAreasList
          : blueAreasList.filter(
              (b) => String(b.floor) === String(blueAreasFloorFilter)
            );

      const grouped = {};

      for (const item of sourceList) {
        const floor = item.floor ?? 1;
        if (!grouped[floor]) grouped[floor] = [];
        grouped[floor].push(item);
      }

      return Object.entries(grouped)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([floor, items]) => ({
          floor: Number(floor),
          items: items.sort((a, b) => a.label.localeCompare(b.label)),
        }));
    }, [blueAreasList, blueAreasFloorFilter]);

  const filteredBlueAreasList = useMemo(() => {
    if (blueAreasFloorFilter === "ALL") return blueAreasList;

    return blueAreasList.filter(
      (b) => String(b.floor) === String(blueAreasFloorFilter)
    );
  }, [blueAreasList, blueAreasFloorFilter]);



  const filteredPaintAreasSvg = useMemo(() => {
    if (blueAreasFloorFilter === "ALL") return paintAreasSvg;

    return (paintAreasSvg ?? []).filter((a) => {
      if (a.source !== "single") return true;
      return String(a.floor) === String(blueAreasFloorFilter);
    });
  }, [paintAreasSvg, blueAreasFloorFilter]);

  const referencePointsSvg = useMemo(() => {
    if (!showReferencePoints) return [];

    return referencePoints
      .map((p) => {
        const px = mmToPx(p.x, p.y);
        return {
          ...p,
          x_px: px.x_px,
          y_px: px.y_px,
        };
      })
      .filter(
        (p) =>
          Number.isFinite(p.x_px) &&
          Number.isFinite(p.y_px)
      );
  }, [showReferencePoints, referencePoints, mmToPx]);

  const coordBox = useMemo(() => {
    const fs = clamp(Number(coordFontPx) || 5, 4, 16);
    return { fs, ...labelBoxForValue("-9999", fs, 3, 2) };
  }, [coordFontPx]);


  const blueLineDy = clamp(12 / zoom, 9, 14);

  return (
  <div
    style={{
      padding: 16,
      display: "grid",
      gridTemplateColumns: "460px 1fr 460px",
      gap: 16,
      width: "100%",
      maxWidth: "100vw",
      overflowX: "hidden",
      boxSizing: "border-box",
      alignItems: "start",
      background: "#7f818a",
      color: "#1f2937",
      fontFamily: "Inter, system-ui, Arial, sans-serif",
      minHeight: "100vh",
    }}
  >

{/* IZQUIERDA */}
<div
  style={{
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "2px 12px",
    overflow: "auto",
    maxHeight: "calc(100vh - 32px)",
    fontSize: 13,
    position: "sticky",
    top: 16,
    background: "#718ca5",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  }}
>
  <div style={{ paddingTop: 12 }}>
    <div style={sectionGroupStyle}>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 900 }}>Gestionar pisos y altura</div>

        <button
          onClick={() => setFloorPanelOpen((v) => !v)}
          style={{
            border: "1px solid #0f766e",
            background: floorPanelOpen ? "#0f766e" : "#ccfbf1",
            color: floorPanelOpen ? "#ffffff" : "#115e59",
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {floorPanelOpen ? "Cerrar ▲" : "Abrir ▼"}
        </button>
      </div>

      {floorPanelOpen && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
  
          {/* Piso */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Piso</label>
            <input
              type="number"
              value={newFloorNumber}
              onChange={(e) => handleFloorChange(e.target.value)}
              style={{
                width: 60,
                height: 26,
                fontSize: 12,
                padding: "2px 6px",
              }}
            />
          </div>

          {/* Z base */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Z base</label>
            <input
              type="number"
              value={newFloorZ}
              onChange={(e) => setNewFloorZ(Number(e.target.value))}
              style={{
                width: 80,
                height: 26,
                fontSize: 12,
                padding: "2px 6px",
              }}
            />
          </div>

          {/* Color preview */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Color</label>
            <div
              style={{
                width: 60,
                height: 26,
                borderRadius: 4,
                border: "1px solid #9ca3af",
                background: getAutoFloorColor(newFloorNumber),
              }}
            />
          </div>

          {/* Botón */}
          <button
            onClick={saveFloorDef}
            style={{
              height: 28,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              background: "#111827",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Guardar
          </button>

        </div>

         

          <div style={{ display: "grid", gap: 8 }}>
            {(floorDefs ?? []).map((f) => (
            <div
              key={`floor-${f.floor}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "2px 6px",
                border: "1px solid #e5e7eb",
                borderRadius: 5,
                marginBottom: 2,
                background: "#fff",
                height: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                
                {/* Color */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: getAutoFloorColor(f.floor),
                  }}
                />

                {/* Texto compacto */}
                <span style={{ fontSize: 11, lineHeight: 1 }}>
                  <strong>P{f.floor}</strong> — z:{f.zBase}
                </span>
              </div>

              {/* Botón compacto */}
              <button
                onClick={() => deleteFloorDef(f.floor)}
                style={{
                  fontSize: 10,
                  padding: "0 6px",
                  height: 18,
                  borderRadius: 4,
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ))}
          </div>
        </>
      )}
    </div>






    {/* panel agregar items  */}
    <div style={sectionGroupStyle}>
            <div
              style={{
                paddingTop: 0,
                marginTop: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 900 }}>Agregar items</div>

                <button
                  onClick={() => setAddPanelOpen((v) => !v)}
                  style={{
                    border: "1px solid #2563eb",
                    background: addPanelOpen ? "#2563eb" : "#dbeafe",
                    color: addPanelOpen ? "#ffffff" : "#1d4ed8",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {addPanelOpen ? "Cerrar ▲" : "Abrir ▼"}
                </button>
              </div>

          </div>



{addPanelOpen && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 8,
                    }}
                  >
                    <div>
                      <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 4 }}>
                        label (máx 5):
                      </label>
                      <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="B1"
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #d0d5dd",
                          background: "#fff",
                          color: "#111827",
                          fontSize: 13,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 4 }}>
                        coordenadas (x,y):
                      </label>
                      <input
                        value={newXY}
                        onChange={(e) => setNewXY(e.target.value)}
                        placeholder="(43, 544)"
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #d0d5dd",
                          background: "#fff",
                          color: "#111827",
                          fontSize: 13,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 4 }}>
                        piso:
                      </label>
                      <select
                        value={newFloorSelected}
                        onChange={(e) => setNewFloorSelected(Number(e.target.value))}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #d0d5dd",
                          background: "#fff",
                          color: "#111827",
                          fontSize: 13,
                          boxSizing: "border-box",
                        }}
                      >
                        {floorDefs.map((f) => (
                          <option key={f.floor} value={f.floor}>
                            Piso {f.floor}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 4 }}>
                          ancho (mm):
                        </label>
                        <input
                          type="number"
                          value={newW}
                          onChange={(e) => setNewW(Number(e.target.value || 0))}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #d0d5dd",
                            background: "#fff",
                            color: "#111827",
                            fontSize: 13,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: "#333", display: "block", marginBottom: 4 }}>
                          alto (mm):
                        </label>
                        <input
                          type="number"
                          value={newH}
                          onChange={(e) => setNewH(Number(e.target.value || 0))}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #d0d5dd",
                            background: "#fff",
                            color: "#111827",
                            fontSize: 13,
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {addOneError ? (
                    <div style={{ marginTop: 8, color: "#b00020", fontSize: 12 }}>
                      {addOneError}
                    </div>
                  ) : null}

                  <button
                    onClick={addOnePoint}
                    style={{
                      marginTop: 10,
                      padding: "9px 12px",
                      cursor: "pointer",
                      width: "100%",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Agregar (crea área azul)
                  </button>
                </>
              )}
</div>



              {/* ✅ lista de áreas azules */}
    <div style={sectionGroupStyle}>
                <div
                  style={{
                    paddingTop: 0,
                    marginTop: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      Gestionar items agregadas ({filteredBlueAreasList.length})
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select
                        value={blueAreasFloorFilter}
                        onChange={(e) => setBlueAreasFloorFilter(e.target.value)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid #d0d5dd",
                          background: "#fff",
                          color: "#111827",
                          fontSize: 12,
                        }}
                      >
                        <option value="ALL">Todos</option>
                        {floorDefs.map((f) => (
                          <option key={f.floor} value={String(f.floor)}>
                            Piso {f.floor}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setBlueAreasPanelOpen((v) => !v)}
                        style={{
                          border: "1px solid #3d3d42",
                          background: blueAreasPanelOpen ? "#dc2626" : "#fee2e2",
                          color: blueAreasPanelOpen ? "#ffffff" : "#991b1b",
                          borderRadius: 6,
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {blueAreasPanelOpen ? "Cerrar ▲" : "Abrir ▼"}
                      </button>
                    </div>
                  </div>

                  {blueAreasPanelOpen && (
                  <div
                    style={{
                      border: "3px dashed #ff00ff",
                      borderRadius: 8,
                      padding: 10,
                      minHeight: 120,
                      background: "#4c4949",
                      color: "#ffffff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {blueAreasGroupedByFloor.length === 0 ? (
                        <div style={{ color: "#ffffff", opacity: 0.9 }}>
                          — (no hay áreas azules para ese piso) —
                        </div>
                      ) : (
                        blueAreasGroupedByFloor.map((group) => (
                          <div
                            key={group.floor}
                            style={{
                              border: "1px solid #cbd5e1",
                              borderRadius: 12,
                              padding: 10,
                              marginBottom: 10,
                              background: "#4b5563",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 13,
                                marginBottom: 8,
                                color: getFloorColor(group.floor),
                              }}
                            >
                              Piso {group.floor}
                            </div>

                            <div style={{ display: "grid", gap: 8 }}>
                              {group.items.map((b) => (
                              <div
                                key={b.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 13,
                                      flex: 1,              // 👈 ocupa el espacio disponible
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap", // 👈 NO BAJA
                                    }}
                                  >
                                    {b.label}, (x={b.x}, y={b.y}), rot={b.rotationDeg}°
                                  </div>

                                  <button
                                    onClick={() => rotateArea90(b.id)}
                                    style={{
                                      border: "1px solid #93c5fd",
                                      borderRadius: 8,
                                      background: "#2563eb",
                                      color: "#fff",
                                      padding: "4px 10px",
                                      fontWeight: 700,
                                      fontSize: 12,
                                      cursor: "pointer",
                                      flexShrink: 0, // 👈 nunca se achica ni baja
                                    }}
                                  >
                                    Girar
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                  </div>
                )}
                </div>
    </div>
    {/* ✅ lista de áreas azules */}


      {/*// clonacion */}
    <div style={sectionGroupStyle}>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>Clonar items</div>

                <button
                  onClick={() => setClonePanelOpen((v) => !v)}
                  style={{
                    border: "1px solid #2563eb",
                    background: addPanelOpen ? "#2563eb" : "#dbeafe",
                    color: addPanelOpen ? "#ffffff" : "#1d4ed8",
                    borderRadius: 6,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {clonePanelOpen ? "Cerrar ▲" : "Abrir ▼"}
                </button>
              </div>

              {clonePanelOpen && (
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>Piso origen</label>
                  <select
                    value={cloneSourceFloor}
                    onChange={(e) => setCloneSourceFloor(Number(e.target.value))}
                    style={{ padding: 8, borderRadius: 8 }}
                  >
                    {(floorDefs ?? []).map((f) => (
                      <option key={`clone-src-${f.floor}`} value={f.floor}>
                        Piso {f.floor}
                      </option>
                    ))}
                  </select>

                  <label style={{ fontSize: 12, fontWeight: 700 }}>Piso destino</label>
                  <input
                    type="number"
                    min={1}
                    value={cloneTargetFloor}
                    onChange={(e) => setCloneTargetFloor(Number(e.target.value || 1))}
                    style={{ padding: 8, borderRadius: 8 }}
                  />

                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Color ítems piso destino
                  </label>
                  <input
                    type="color"
                    value={cloneTargetColor}
                    onChange={(e) => setCloneTargetColor(e.target.value)}
                    style={{
                      width: "100%",
                      height: 40,
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  />

                  {cloneError ? (
                    <div style={{ color: "#b00020", fontSize: 12 }}>{cloneError}</div>
                  ) : null}

                  <button
                    onClick={cloneItemsFromFloor}
                    style={{
                      marginTop: 4,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Clonar piso completo
                  </button>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                    Copia todos los ítems del piso origen al piso destino.
                  </div>
        
                </div>
              )}


    </div>
    {/*// clonacion */}

  </div>
</div>
{/* IZQUIERDA */}

      {/* CENTRO */}
      <div
        ref={centerRef}
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "4px 12px",
          overflow: "auto",
          maxHeight: "calc(100vh - 32px)",
          fontSize: 13,
          position: "sticky",
          top: 16,
          background: "#ffffff",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
          

          {/* ✅ VIEWPORT responsivo SIN SCROLL */}
          <div
            style={{
              width: viewportPx,
              height: viewportPx,
            border: "1px solid #cfcfcf",
            borderRadius: 8,
            background: "#fff",
            overflow: "hidden",
            position: "relative",
            touchAction: "none",
          }}
        >
          <svg
          ref={svgRef}
          width={viewportPx}
          height={viewportPx}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
          }}
            onPointerDown={onPanPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerLeave={onSvgPointerLeave}
            onPointerCancel={onSvgPointerCancel}
            onWheel={onWheelZoom}
          >
            {/* borde workspace */}
            <rect
              x={workspaceBorderPx.left}
              y={workspaceBorderPx.top}
              width={workspaceBorderPx.w}
              height={workspaceBorderPx.h}
              fill="none"
              stroke="#999"
              strokeWidth={2}
              strokeDasharray="6 6"
              pointerEvents="none"
            />

            {/* PUNTOS REFERENCIALES */}
            

            {gridLines.map((ln) => (
              <line
                key={ln.key}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke={ln.major ? "#d2d2d2" : "#efefef"}
                strokeWidth={ln.major ? 1.2 : 1}
                pointerEvents="none"
              />
            ))}

            <line
              x1={axes.x1}
              y1={axes.y1}
              x2={axes.x2}
              y2={axes.y2}
              stroke="#ff4d4d"
              strokeWidth={2}
              pointerEvents="none"
            />
            <line
              x1={axes.yx1}
              y1={axes.yy1}
              x2={axes.yx2}
              y2={axes.yy2}
              stroke="#ff4d4d"
              strokeWidth={2}
              pointerEvents="none"
            />

            {/* etiquetas dirección ejes */}
            <g pointerEvents="none">
              <rect
                x={axisDirectionLabels.top.x - 22}
                y={axisDirectionLabels.top.y - 11}
                width={44}
                height={22}
                rx={4}
                fill="rgba(255,255,255,0.88)"
              />
              <text
                x={axisDirectionLabels.top.x}
                y={axisDirectionLabels.top.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16"
                fontFamily="monospace"
                fontWeight="900"
                fill="#dc2626"
                style={{ userSelect: "none" }}
              >
                {axisDirectionLabels.top.text}
              </text>

              <rect
                x={axisDirectionLabels.bottom.x - 22}
                y={axisDirectionLabels.bottom.y - 11}
                width={44}
                height={22}
                rx={4}
                fill="rgba(255,255,255,0.88)"
              />
              <text
                x={axisDirectionLabels.bottom.x}
                y={axisDirectionLabels.bottom.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16"
                fontFamily="monospace"
                fontWeight="900"
                fill="#dc2626"
                style={{ userSelect: "none" }}
              >
                {axisDirectionLabels.bottom.text}
              </text>

              <rect
                x={axisDirectionLabels.left.x - 22}
                y={axisDirectionLabels.left.y - 11}
                width={44}
                height={22}
                rx={4}
                fill="rgba(255,255,255,0.88)"
              />
              <text
                x={axisDirectionLabels.left.x}
                y={axisDirectionLabels.left.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16"
                fontFamily="monospace"
                fontWeight="900"
                fill="#dc2626"
                style={{ userSelect: "none" }}
              >
                {axisDirectionLabels.left.text}
              </text>

              <rect
                x={axisDirectionLabels.right.x - 22}
                y={axisDirectionLabels.right.y - 11}
                width={44}
                height={22}
                rx={4}
                fill="rgba(255,255,255,0.88)"
              />
              <text
                x={axisDirectionLabels.right.x}
                y={axisDirectionLabels.right.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16"
                fontFamily="monospace"
                fontWeight="900"
                fill="#dc2626"
                style={{ userSelect: "none" }}
              >
                {axisDirectionLabels.right.text}
              </text>
            </g>

            {/* coords */}
            {showCoords ? (
              <g pointerEvents="none">
                {coordLabels.xs.map((t) => {
                  const box = labelBoxForValue(t.value, coordBox.fs, 3, 2);
                  return (
                    <g key={t.key}>
                      <rect
                        x={t.x - box.w / 2}
                        y={t.y - box.h / 2}
                        width={box.w}
                        height={box.h}
                        rx={2}
                        ry={2}
                        fill="rgba(255,255,255,0.75)"
                      />
                      <text
                        x={t.x}
                        y={t.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={coordBox.fs}
                        fontFamily="monospace"
                        fill="#333"
                        style={{ userSelect: "none" }}
                      >
                        {t.value}
                      </text>
                    </g>
                  );
                })}

                {coordLabels.ys.map((t) => {
                  const box = labelBoxForValue(t.value, coordBox.fs, 3, 2);
                  const textX = t.x + box.w / 2;
                  return (
                    <g key={t.key}>
                      <rect
                        x={textX - box.w / 2}
                        y={t.y - box.h / 2}
                        width={box.w}
                        height={box.h}
                        rx={2}
                        ry={2}
                        fill="rgba(255,255,255,0.75)"
                      />
                      <text
                        x={textX}
                        y={t.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={coordBox.fs}
                        fontFamily="monospace"
                        fill="#333"
                        style={{ userSelect: "none" }}
                      >
                        {t.value}
                      </text>
                    </g>
                  );
                })}
              </g>
            ) : null}

            {/* ÁREAS */}
            {filteredPaintAreasSvg.map((a) => {
              const floorColor = getFloorColor(a.floor);

              const fillColor =
                a.source === "single"
                  ? "rgba(120,120,120,0.25)"   // gris suave
                  : "rgba(120,120,120,0.10)";

              const strokeColor =
                a.source === "single"
                  ? "#888888"                 // borde gris
                  : "#666666";

              const selectedStrokeColor =
                "#ffffff"; // cuando seleccionas → blanco (resalta en fondo negro)

              return (
                <g key={a.id}>
                  <polygon
                    points={a.pointsAttr}
                    fill={
                      a.source === "single"
                        ? getFloorColor(a.floor ?? 1)
                        : "#9ca3af"
                    }
                    fillOpacity={a.source === "single" ? 0.75 : 0.85}
                    stroke={a.id === selectedAreaId ? selectedStrokeColor : strokeColor}
                    strokeWidth="2"
                    style={{
                      cursor: areaDragRef.current.active ? "grabbing" : "grab",
                    }}
                    onPointerDown={(e) => onAreaPointerDown(e, a.id)}
                    onContextMenu={(e) => onAreaContextMenu(e, a.id)}
                  />

                  <g pointerEvents="none">
                    <text
                      x={
                        a.source === "single"
                          ? a.labelCenterPx.x_px
                          : a.labelTopRightPx.x_px
                      }
                      y={
                        a.source === "single"
                          ? a.labelCenterPx.y_px
                          : a.labelTopRightPx.y_px
                      }
                      textAnchor={
                        a.source === "single"
                          ? "middle"
                          : "end"
                      }
                      dominantBaseline={
                        a.source === "single"
                          ? "middle"
                          : "hanging"
                      }
                      fill={
                        a.source === "single"
                          ? (a.id === selectedAreaId ? "#ffffff" : "#000000")
                          : "#111827"
                      }
                      style={{
                        pointerEvents: "none",
                        fontWeight: 700,
                        stroke: "#000000",
                        strokeWidth: 0.5,
                        paintOrder: "stroke"                      }}
                    >
                      {a.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* ORIGIN */}
            {(() => {
              const o = mmToPx(0, 0);
              return (
                <g pointerEvents="none">
                  <circle cx={o.x_px} cy={o.y_px} r={4} fill="#ff4d4d" />
                  <text
                    x={o.x_px + 8}
                    y={o.y_px}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight={800}
                    fill="#ff4d4d"
                    style={{ userSelect: "none" }}
                  >
                    ORIGIN (0,0)
                  </text>
                </g>
              );
            })()}
          </svg>

            {showReferencePoints &&
              referencePointsSvg.map((p) => {
                const n = String(p.name || "").toUpperCase();

                let shape = "circle";
                let color = "#16a34a";

                if (n === "HZ") {
                  shape = "diamond";
                  color = "#dc2626";
                } else if (n === "TOMACAJA1") {
                  shape = "circle";
                  color = "#1618a3";
                } else if (n === "TOMACAJA2") {
                  shape = "triangle";
                  color = "#16a34a";
                } else if (n.startsWith("TRANS")) {
                  shape = "triangle";
                  color = "#f97316";
                } else if (n.startsWith("PALLET")) {
                  shape = "square";
                  color = "#9333ea";
                }

                const left = Math.round(p.x_px);
                const top = Math.round(p.y_px);

                return (
                  <div
                    key={`ref-${p.name}`}
                    style={{
                      position: "absolute",
                      left,
                      top,
                      width: 0,
                      height: 0,
                      pointerEvents: "none",
                    }}
                  >
                    {shape === "circle" && (
                      <div
                        style={{
                          position: "absolute",
                          left: -6,
                          top: -6,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: color,
                          border: "2px solid white",
                          boxSizing: "border-box",
                        }}
                      />
                    )}

                    {shape === "square" && (
                      <div
                        style={{
                          position: "absolute",
                          left: -6,
                          top: -6,
                          width: 12,
                          height: 12,
                          background: color,
                          border: "2px solid white",
                          boxSizing: "border-box",
                        }}
                      />
                    )}

                    {shape === "diamond" && (
                      <div
                        style={{
                          position: "absolute",
                          left: -6,
                          top: -6,
                          width: 12,
                          height: 12,
                          background: color,
                          border: "2px solid white",
                          boxSizing: "border-box",
                          transform: "rotate(45deg)",
                          transformOrigin: "center",
                        }}
                      />
                    )}

                    {shape === "triangle" && (
                      <div
                        style={{
                          position: "absolute",
                          left: -7,
                          top: -7,
                          width: 0,
                          height: 0,
                          borderLeft: "7px solid transparent",
                          borderRight: "7px solid transparent",
                          borderBottom: `14px solid ${color}`,
                          filter: "drop-shadow(0 0 0 white)",
                        }}
                      />
                    )}
                  </div>
                );
              })}

        </div>
      </div>

      {/* DERECHA */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: "0 12px 12px 12px",
          overflow: "auto",
          maxHeight: "calc(100vh - 32px)",
          fontSize: 13,
          position: "sticky",
          top: 16,
          background: "#5c7c8b",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        }}
      >

        

        


        {areaMenu.open &&
          (() => {
            const area = (paintAreas ?? []).find((a) => a.id === areaMenu.areaId);
            if (!area) return null;

            const pos = areaSummaryPointMm(area);

            return (
              <div
                style={{
                  position: "fixed",
                  left: areaMenu.x + 10,
                  top: areaMenu.y + 10,
                  width: 280,
                  background: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 10,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  zIndex: 9999,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                  {truncateLabel5(area.label) || "AREA"} ({pos.x},{pos.y})
                </div>

                <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
                  Cambia label y/o el punto (x,y) del “centro interior”.
                </div>

                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  Label (máx 5)
                </div>
                <input
                  value={areaMenu.draftLabel}
                  onChange={(e) =>
                    setAreaMenu((m) => ({ ...m, draftLabel: e.target.value }))
                  }
                  style={{ width: "100%", boxSizing: "border-box" }}
                />

                <div style={{ fontSize: 12, marginTop: 10, marginBottom: 6 }}>
                  Mover a (x,y)
                </div>
                <input
                  value={areaMenu.draftXY}
                  onChange={(e) =>
                    setAreaMenu((m) => ({ ...m, draftXY: e.target.value }))
                  }
                  style={{ width: "100%", boxSizing: "border-box" }}
                />

                {areaMenu.error ? (
                  <div style={{ marginTop: 8, color: "#b00020", fontSize: 12 }}>
                    {areaMenu.error}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() =>
                      setAreaMenu((m) => ({ ...m, open: false, areaId: "" }))
                    }
                    style={{ flex: 1, padding: "8px 10px", cursor: "pointer" }}
                  >
                    Cerrar
                  </button>

                  <button
                    onClick={() => applyAreaEdit()}
                    style={{ flex: 1, padding: "8px 10px", cursor: "pointer" }}
                  >
                    Aplicar
                  </button>

                  <button
                    onClick={() => deletePolygon(area.id)}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      borderRadius: 8,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })()}

        



        <div
          style={{
            paddingTop: 12,
          }}
        >



          <div
            style={{
              paddingTop: 0,
              marginTop: 0,
            }}
          >


 





              <div style={sectionGroupStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "nowrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#374151",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Gestionar Robot y Pallets
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          margin: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={paintEnabled}
                          onChange={(e) => setPaintEnabled(e.target.checked)}
                        />
                        Mostrar
                      </label>

                      <button
                        onClick={() => setPaintPanelOpen((v) => !v)}
                        style={{
                          border: "1px solid #2563eb",
                          background: paintPanelOpen ? "#2563eb" : "#dbeafe",
                          color: paintPanelOpen ? "#ffffff" : "#1d4ed8",
                          borderRadius: 6,
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          lineHeight: 1.1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {paintPanelOpen ? "Cerrar ▲" : "Abrir ▼"}
                      </button>
                    </div>
                  </div>

                  {paintPanelOpen && (
                    <>
                      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                        Formato por línea: <b>Label,(x,y),(x,y),(x,y)...</b> (Label máx 5)
                      </div>

                      <textarea
                        value={paintAreasText}
                        onChange={(e) => setPaintAreasText(e.target.value)}
                        rows={8}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          fontFamily: "monospace",
                          fontSize: 12,
                          padding: 8,
                          boxSizing: "border-box",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                        }}
                      />

                      {paintAreasError ? (
                        <div style={{ marginTop: 8, color: "#b00020", fontSize: 13 }}>
                          {paintAreasError}
                        </div>
                      ) : null}

                      <button
                        onClick={applyPaintAreas}
                        style={{
                          marginTop: 10,
                          padding: "8px 10px",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        Aplicar áreas
                      </button>

                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "#555",
                        }}
                      >
                        áreas cargadas: {paintAreas?.length ?? 0}
                      </div>
                    </>
                  )}
                </div>




              
            
            </div>




      {/* codigo agregar pisos */}
</div>







        <div style={sectionGroupStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "nowrap",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                whiteSpace: "nowrap",
              }}
            >
              Generar Lua
            </div>

            <button
              onClick={() => setLuaPanelOpen((v) => !v)}
              style={{
                border: "1px solid #7c3aed",
                background: luaPanelOpen ? "#7c3aed" : "#ede9fe",
                color: luaPanelOpen ? "#ffffff" : "#5b21b6",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {luaPanelOpen ? "Cerrar ▲" : "Abrir ▼"}
            </button>
          </div>

          {luaPanelOpen && (
            <>
              <button
                onClick={() => {
                  const boxes = sortBoxesForLua(
                    (paintAreas ?? [])
                      .filter((a) => a.source === "single")
                      .filter((a) =>
                        blueAreasFloorFilter === "ALL"
                          ? true
                          : String(a.floor) === String(blueAreasFloorFilter)
                      )
                      .map((a) => {
                        const p = areaSummaryPointMm(a);
                        const floorNumber = a.floor ?? 1;
                        const floorDef = floorDefs.find(
                          (f) => Number(f.floor) === Number(floorNumber)
                        );

                        const xs = (a.points ?? []).map((p) => p.x);
                        const ys = (a.points ?? []).map((p) => p.y);

                        const w = Math.round(Math.max(...xs) - Math.min(...xs));
                        const h = Math.round(Math.max(...ys) - Math.min(...ys));

                        return {
                          id: a.id,
                          label: a.label,
                          x: p.x,
                          y: p.y,
                          floor: floorNumber,
                          rotationDeg: a.rotationDeg ?? 0,
                          zBase: Number(floorDef?.zBase ?? -900),
                          w,
                          h,
                        };
                      })
                  );

                    const lua = generateLuaAllFloors({
                      paintAreas,
                      floorDefs,
                    });

                    setLuaFloorText(lua);
                }}
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  cursor: "pointer",
                  width: "100%",
                  borderRadius: 8,
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Generar secuencia Piso 1
              </button>

              <textarea
                value={luaFloor1Text}
                readOnly
                rows={12}
                style={{
                  width: "100%",
                  marginTop: 10,
                  fontFamily: "monospace",
                  fontSize: 12,
                  padding: 8,
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: "2px dashed #ff00ff",
                  background: "#7f1d1d",
                  color: "#ffffff",
                }}
              />

              <button
                onClick={() => {
                  if (!luaFloor1Text.trim()) {
                    alert("Primero genera el código LUA.");
                    return;
                  }
                  downloadTextFile("piso1_lua.txt", luaFloor1Text);
                }}
                style={{
                  marginTop: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  width: "100%",
                  borderRadius: 8,
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Exportar LUA (.txt)
              </button>
            </>
          )}
        </div>


        <div style={sectionGroupStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "nowrap",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                whiteSpace: "nowrap",
              }}
            >
              Proyectos (Importar y Exportar)
            </div>

            <button
              onClick={() => setProjectPanelOpen((v) => !v)}
              style={{
                border: "1px solid #7c3aed",
                background: projectPanelOpen ? "#7c3aed" : "#ede9fe",
                color: projectPanelOpen ? "#ffffff" : "#5b21b6",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {projectPanelOpen ? "Cerrar ▲" : "Abrir ▼"}
            </button>
          </div>

          {projectPanelOpen && (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <button
                onClick={exportProjectToJson}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  width: "100%",
                  borderRadius: 8,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Guardar proyecto (.json)
              </button>

              <button
                onClick={() => importProjectInputRef.current?.click()}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  width: "100%",
                  borderRadius: 8,
                  border: "none",
                  background: "#7c3aed",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Cargar proyecto (.json)
              </button>

              <input
                ref={importProjectInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  importProjectFromFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>




    {/* Codigo derecho mover cajas */}
    <div style={sectionGroupStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#374151",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              whiteSpace: "nowrap",
            }}
          >
            Modo de arrastre
          </div>

          <div style={{ position: "relative" }}>
              <select
                value={dragFloorTogether ? "group" : "single"}
                onChange={(e) => setDragFloorTogether(e.target.value === "group")}
                style={{
                  width: 100,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #9ca3af",
                  backgroundColor: "#ffffff",   // 👈 clave
                  color: "#111827",             // 👈 texto oscuro
                  fontSize: 13,
                  cursor: "pointer",
                  appearance: "none",           // 👈 limpia estilo feo
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                }}
              >
                <option value="single">Unitario</option>
                <option value="group">Grupal</option>
              </select>
            
              <div
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  fontSize: 10,
                  color: "#6b7280",
                }}
              >
                ▼
              </div>
            </div>


        </div>

        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
          Unitario: mueve una caja. Grupal: mueve todo el piso.
        </div>
      </div>


               
               



               

{/** items 3D */}
<div style={sectionGroupStyle}>
  <div style={sectionGroupTitleStyle}>

          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8,
                color: "#111827",
              }}
            >
              Vista 3D
            </div>

            
          </div>


            </div>
          </div>
{/** items 3D */}






{/** Asignar separacion entre items */}

<div style={sectionGroupStyle}>
  <div style={sectionGroupTitleStyle}>
    Separación entre cajas por piso
    <button
      onClick={() => setSpacingPanelOpen((v) => !v)}
      style={{
        marginLeft: 8,
        border: "1px solid #7c3aed",
        background: spacingPanelOpen ? "#7c3aed" : "#ede9fe",
        color: spacingPanelOpen ? "#ffffff" : "#5b21b6",
        borderRadius: 6,
        padding: "4px 8px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {spacingPanelOpen ? "Ocultar" : "Mostrar"}
    </button>
  </div>

  {spacingPanelOpen && (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600 }}>
        Piso
        <input
          type="number"
          min="1"
          value={spacingFloorNumber}
          onChange={(e) => setSpacingFloorNumber(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      <label style={{ fontSize: 12, fontWeight: 600 }}>
        Separación X
        <input
          type="number"
          value={spacingGapX}
          onChange={(e) => setSpacingGapX(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      <label style={{ fontSize: 12, fontWeight: 600 }}>
        Separación Y
        <input
          type="number"
          value={spacingGapY}
          onChange={(e) => setSpacingGapY(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </label>

      <button
        onClick={applySpacingToFloor}
        style={{
          border: "1px solid #2563eb",
          background: "#2563eb",
          color: "#fff",
          borderRadius: 8,
          padding: "8px 10px",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Aplicar separación
      </button>

      {spacingError ? (
        <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 600 }}>
          {spacingError}
        </div>
      ) : null}
    </div>
  )}
</div>
{/** Asignar separacion entre items */}


<button
  onClick={open3DPopup}
  style={{
    padding: "8px 12px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
  }}
>
  Ver en 3D
</button>





      </div>
    </div>
  );
}