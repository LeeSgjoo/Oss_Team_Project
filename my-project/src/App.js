// src/App.js
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import MapPage from "./pages/MapPage";
import DetailPage from "./pages/DetailPage";
import CreatePage from "./pages/CreatePage";
import EditPage from "./pages/EditPage";

export default function App() {
  return (
    <BrowserRouter>
      <header style={{ padding: 12, borderBottom: "1px solid #eee" }}>
        <Link to="/">My Favorite Place</Link>
        <Link to="/create" style={{ marginLeft: 12 }}>
          + 장소추가
        </Link>
      </header>

      <Routes>
        {/* ✅ 모든 페이지가 지도 위에서 패널로 뜨게 함 */}
        <Route path="/" element={<MapPage />}>
          <Route path="place/:id" element={<DetailPage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="edit/:id" element={<EditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
