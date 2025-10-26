import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { loadKakao } from "../kakaoLoader";

export default function MapPage({ isSkyView }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const myOverlaysRef = useRef([]);       // 저장된 오버레이
  const searchPinRef = useRef(null);      // 검색 핀
  const placesSvcRef = useRef(null);      // Kakao Places 서비스
  const nav = useNavigate();

  const [savedPlaces, setSavedPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);   // Kakao 검색 결과
  const [searching, setSearching] = useState(false);

  // ✅ Firestore에서 저장된 장소 목록 읽기
  useEffect(() => {
    (async () => {
      try {
        const qy = query(collection(db, "places"), orderBy("created_date", "desc"));
        const snap = await getDocs(qy);
        setSavedPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        alert("장소 목록 로딩 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Kakao 지도 초기화 + 세션 위치 복원
  useEffect(() => {
    if (loading) return;

    let kakao;
    (async () => {
      kakao = await loadKakao();

      // 세션에서 지도 상태 복원
      let centerLat = 36.012, centerLng = 129.323, level = 4;
      const saved = sessionStorage.getItem("map_state");
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (isFinite(s.lat) && isFinite(s.lng) && isFinite(s.level)) {
            centerLat = s.lat;
            centerLng = s.lng;
            level = s.level;
          }
        } catch {}
      }

      const center = new kakao.maps.LatLng(centerLat, centerLng);
      const map = new kakao.maps.Map(mapEl.current, { center, level });
      mapRef.current = map;

      // 상태 저장
      const saveState = () => {
        const c = map.getCenter();
        const l = map.getLevel();
        sessionStorage.setItem(
          "map_state",
          JSON.stringify({ lat: c.getLat(), lng: c.getLng(), level: l })
        );
      };
      kakao.maps.event.addListener(map, "center_changed", saveState);
      kakao.maps.event.addListener(map, "zoom_changed", saveState);

      // ✅ 지도 클릭 → 장소 생성 페이지 이동
      kakao.maps.event.addListener(map, "click", (e) => {
        if (window.confirm("이 위치로 새로운 장소를 추가할까요?")) {
          const lat = e.latLng.getLat().toFixed(6);
          const lng = e.latLng.getLng().toFixed(6);
          nav(`/create?lat=${lat}&lng=${lng}`);
        }
      });

      // Kakao Places 준비
      placesSvcRef.current = new kakao.maps.services.Places(map);

      // 저장된 장소 오버레이 표시
      drawSavedPlaceOverlays(kakao, map, savedPlaces, myOverlaysRef, nav);
    })();

    return () => {
      // 지도 언마운트 시 정리
      myOverlaysRef.current.forEach(o => o.setMap(null));
      myOverlaysRef.current = [];
      if (searchPinRef.current) {
        searchPinRef.current.setMap(null);
        searchPinRef.current = null;
      }
    };
  }, [loading, savedPlaces, nav]); // ✅ nav 의존성 추가

  // ✅ 스카이뷰 전환
  useEffect(() => {
    if (!mapRef.current) return;
    const { kakao } = window;
    if (!kakao) return;

    const mapType = isSkyView
      ? kakao.maps.MapTypeId.HYBRID
      : kakao.maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(mapType);
  }, [isSkyView]);

  // ✅ Kakao 키워드 검색 실행
  const doSearch = () => {
    if (!term.trim() || !placesSvcRef.current) return;
    setSearching(true);
    placesSvcRef.current.keywordSearch(term.trim(), (data, status) => {
      setSearching(false);
      const { kakao } = window;
      if (status !== kakao.maps.services.Status.OK) {
        setResults([]);
        if (status === kakao.maps.services.Status.ZERO_RESULT) alert("검색 결과가 없어요.");
        else console.warn("Search status:", status);
        return;
      }
      setResults(data);
    }, { size: 10, page: 1 });
  };

  // ✅ 검색 결과 클릭 → 지도 이동 + 핀 표시
  const focusResult = (item) => {
    const { kakao } = window;
    if (!mapRef.current) return;
    const lat = parseFloat(item.y);
    const lng = parseFloat(item.x);
    const pos = new kakao.maps.LatLng(lat, lng);

    mapRef.current.panTo(pos);

    // 기존 핀 제거
    if (searchPinRef.current) {
      searchPinRef.current.setMap(null);
      searchPinRef.current = null;
    }

    // 새 핀 표시
    const content = document.createElement("div");
    content.style.transform = "translate(-50%, -100%)";
    content.style.cursor = "pointer";
    content.style.display = "grid";
    content.style.placeItems = "center";

    const pin = document.createElement("div");
    pin.style.width = "26px";
    pin.style.height = "26px";
    pin.style.borderRadius = "50%";
    pin.style.background = "#7c3aed";
    pin.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    content.appendChild(pin);

    const tail = document.createElement("div");
    tail.style.width = "0";
    tail.style.height = "0";
    tail.style.borderLeft = "6px solid transparent";
    tail.style.borderRight = "6px solid transparent";
    tail.style.borderTop = "7px solid #7c3aed";
    tail.style.marginTop = "2px";
    content.appendChild(tail);

    content.title = item.place_name;
    content.onclick = () => {
      window.open(
        `https://map.kakao.com/link/map/${encodeURIComponent(item.place_name)},${lat},${lng}`,
        "_blank"
      );
    };

    const overlay = new kakao.maps.CustomOverlay({
      position: pos,
      content,
      yAnchor: 1,
      zIndex: 999,
      clickable: true,
    });
    overlay.setMap(mapRef.current);
    searchPinRef.current = overlay;
  };

  // 엔터 입력 → 검색 실행
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* 검색바 */}
      <div
        style={{
          position: "absolute",
          zIndex: 5,
          top: 10,
          left: 12,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "saturate(120%) blur(4px)",
          border: "1px solid #e5e5ea",
          borderRadius: 12,
          padding: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <span>🔎</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="장소를 검색하세요 (카카오 장소검색)"
          style={{
            border: "none",
            outline: "none",
            fontSize: 16,
            width: 260,
            background: "transparent",
          }}
        />
        <button onClick={doSearch} disabled={searching} style={{ padding: "6px 10px" }}>
          {searching ? "검색 중..." : "검색"}
        </button>
      </div>

      {/* 검색 결과 목록 */}
      {!!results.length && (
        <div
          style={{
            position: "absolute",
            zIndex: 5,
            top: 56,
            left: 12,
            width: 340,
            maxHeight: 360,
            overflow: "auto",
            background: "#fff",
            border: "1px solid #e5e5ea",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {results.map((r, i) => (
            <div key={i} style={{ padding: 12, borderBottom: "1px solid #f1f1f5" }}>
              <div style={{ fontWeight: 700 }}>{r.place_name}</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                {r.road_address_name || r.address_name || "-"}
              </div>
              {r.phone && (
                <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{r.phone}</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => focusResult(r)}>이 위치 보기</button>
                <button
                  onClick={() => {
                    const lat = parseFloat(r.y).toFixed(6);
                    const lng = parseFloat(r.x).toFixed(6);
                    nav(`/create?lat=${lat}&lng=${lng}`);
                  }}
                >
                  여기로 장소추가
                </button>
                <a
                  href={`https://map.kakao.com/link/to/${encodeURIComponent(
                    r.place_name
                  )},${r.y},${r.x}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: "auto", fontSize: 12, textDecoration: "underline" }}
                >
                  길찾기 →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 지도 */}
      <div
        ref={mapEl}
        style={{
          width: "100%",
          height: "calc(100vh - 60px)",
          borderTop: "1px solid #f0f0f0",
        }}
      />

      {/* DetailPage 패널이 여기에 표시됨 */}
      <Outlet />
    </div>
  );
}

function drawSavedPlaceOverlays(kakao, map, places, storeRef, nav) {
  storeRef.current.forEach((o) => o.setMap(null));
  storeRef.current = [];

  places.forEach((p, idx) => {
    if (!isFinite(p.latitude) || !isFinite(p.longitude)) return;
    const pos = new kakao.maps.LatLng(p.latitude, p.longitude);

    const base = 64;
    const pref = clamp(Number(p.preference) || 3, 1, 5);
    const size = base + (pref - 3) * 8 + (idx % 3) * 6;
    const img = p.image_url || "https://via.placeholder.com/200x200?text=No+Image";

    // 🎨 content: 말풍선 꼬리 없는 원형 썸네일
    const content = document.createElement("div");
    content.style.position = "relative";
    content.style.transform = "translate(-50%, -100%)";
    content.style.cursor = "pointer";
    content.style.width = `${size}px`;
    content.style.height = `${size}px`;
    content.style.borderRadius = "50%";
    content.style.overflow = "hidden";
    content.style.border = "4px solid white";
    content.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    content.style.backgroundImage = `url('${img}')`;
    content.style.backgroundSize = "cover";
    content.style.backgroundPosition = "center";
    content.style.transition = "transform 0.15s ease";

    // hover 효과
    content.onmouseenter = () => (content.style.transform = "translate(-50%, -100%) scale(1.1)");
    content.onmouseleave = () => (content.style.transform = "translate(-50%, -100%) scale(1.0)");

    // ✅ 클릭 → Detail 패널 열기
    content.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      nav(`/place/${p.id}`);
    };

    content.title = `${p.name ?? ""} • ⭐ ${p.preference ?? "-"}`;

    const overlay = new kakao.maps.CustomOverlay({
      position: pos,
      content,
      yAnchor: 1,
      zIndex: 10 + pref * 2 + (idx % 5),
      clickable: true,
    });
    overlay.setMap(map);
    storeRef.current.push(overlay);
  });
}


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
