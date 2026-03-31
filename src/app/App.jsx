//App.jsx
import React from "react";
import CartesianPlayground from "../../ui/src/pages/CartesianPlayground";
import Robot3DWindow from "../../ui/src/pages/Robot3DWindow";
import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CartesianPlayground />} />
      <Route path="/robot-3d" element={<Robot3DWindow />} />
    </Routes>
  );
}