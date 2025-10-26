// src/App.js
import { useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import MapPage from "./pages/MapPage";
import DetailPage from "./pages/DetailPage";
import CreatePage from "./pages/CreatePage";
import EditPage from "./pages/EditPage";

export default function App() {
  const [isSkyView, setIsSkyView] = useState(false);

  return (
    <BrowserRouter>
      <header
        style={{
          padding: "8px 12px",
          background: "#007FFF", // Azure Blue 배경색 적용
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link to="/" style={{ color: "white", textDecoration: "none", fontWeight: "bold" }}>
          My Favorite Place
        </Link>
        <div>
          <button
            onClick={() => setIsSkyView(false)}
            style={{
              background: !isSkyView ? "rgba(255, 255, 255, 0.25)" : "transparent",
              border: "1px solid white",
              color: "white",
              padding: "4px 8px",
              borderRadius: 4,
              marginRight: 4,
              cursor: "pointer",
            }}
          >
            지도
          </button>
          <button
            onClick={() => setIsSkyView(true)}
            style={{
              background: isSkyView ? "rgba(255, 255, 255, 0.25)" : "transparent",
              border: "1px solid white",
              color: "white",
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            스카이뷰
          </button>
          <Link
            to="/create"
            style={{
              marginLeft: 12,
              border: "1px solid white",
              color: "white",
              padding: "4px 8px",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            + 장소추가
          </Link>
        </div>
      </header>

      <Routes>
        {/* ✅ 모든 페이지가 지도 위에서 패널로 뜨게 함 */}
        <Route path="/" element={<MapPage isSkyView={isSkyView} />}>
          <Route path="place/:id" element={<DetailPage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="edit/:id" element={<EditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
