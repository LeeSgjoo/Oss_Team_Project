import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import MapPage from "./pages/MapPage";
import CreatePage from "./pages/CreatePage";
import DetailPage from "./pages/DetailPage";

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
        {/* MapPage가 부모, DetailPage가 그 위에 표시 */}
        <Route path="/" element={<MapPage />}>
          <Route path="place/:id" element={<DetailPage />} />
        </Route>

        <Route path="/create" element={<CreatePage />} />
      </Routes>
    </BrowserRouter>
  );
}
