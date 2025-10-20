import { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { loadKakao } from "../kakaoLoader";

export default function MapPage() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const myOverlaysRef = useRef([]);       // 우리(저장된) 커스텀 오버레이들
  const searchPinRef = useRef(null);      // 검색 선택 시 임시 핀(오버레이)
  const placesSvcRef = useRef(null);      // kakao.maps.services.Places 인스턴스

  const [savedPlaces, setSavedPlaces] = useState([]);
  const [loading, setLoading] = useState(true);

  // 검색 상태
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);   // Kakao 검색 결과
  const [searching, setSearching] = useState(false);

  // 1) Firestore에서 저장된 장소 목록 읽기
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

  // 2) Kakao 지도 초기화 (+ 세션 위치 복원)
  useEffect(() => {
    if (loading) return;

    let kakao;
    (async () => {
      kakao = await loadKakao();

      // 세션 저장된 지도 상태 복원
      let centerLat = 36.012, centerLng = 129.323, level = 4;
      const saved = sessionStorage.getItem("map_state");
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (isFinite(s.lat) && isFinite(s.lng) && isFinite(s.level)) {
            centerLat = s.lat; centerLng = s.lng; level = s.level;
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
        sessionStorage.setItem("map_state", JSON.stringify({ lat: c.getLat(), lng: c.getLng(), level: l }));
      };
      kakao.maps.event.addListener(map, "center_changed", saveState);
      kakao.maps.event.addListener(map, "zoom_changed", saveState);

      // 지도 클릭 → 생성으로
      kakao.maps.event.addListener(map, "click", (e) => {
        if (window.confirm("이 위치로 새로운 장소를 추가할까요?")) {
          const lat = e.latLng.getLat().toFixed(6);
          const lng = e.latLng.getLng().toFixed(6);
          window.location.href = `/create?lat=${lat}&lng=${lng}`;
        }
      });

      // Kakao Places 서비스 준비
      placesSvcRef.current = new kakao.maps.services.Places(map);

      // 저장된 장소 → 원형 사진 오버레이
      drawSavedPlaceOverlays(kakao, map, savedPlaces, myOverlaysRef);
    })();

    return () => {
      // 오버레이 정리
      myOverlaysRef.current.forEach(o => o.setMap(null));
      myOverlaysRef.current = [];
      if (searchPinRef.current) {
        searchPinRef.current.setMap(null);
        searchPinRef.current = null;
      }
    };
  }, [loading, savedPlaces]);

  // 3) 카카오 키워드 검색 실행
  const doSearch = () => {
    if (!term.trim() || !placesSvcRef.current) return;
    setSearching(true);
    placesSvcRef.current.keywordSearch(term.trim(), (data, status/*, pagination*/) => {
      setSearching(false);
      const { kakao } = window;
      if (status !== kakao.maps.services.Status.OK) {
        setResults([]);
        if (status === kakao.maps.services.Status.ZERO_RESULT) alert("검색 결과가 없어요.");
        else console.warn("Search status:", status);
        return;
      }
      setResults(data); // data: [{place_name, x(lng), y(lat), road_address_name, address_name, phone, ...}, ...]
    }, {
      // location: mapRef.current?.getCenter(), // 중심 기준 검색하고 싶으면 주석 해제
      // radius: 5000,                         // m 단위
      size: 10,   // 한 페이지 결과 수
      page: 1,
    });
  };

  // 4) 검색 결과 클릭 → 지도 이동 + 임시 핀 표기 + “여기로 추가” 버튼 제공
  const focusResult = (item) => {
    const { kakao } = window;
    if (!mapRef.current) return;

    const lat = parseFloat(item.y);
    const lng = parseFloat(item.x);
    const pos = new kakao.maps.LatLng(lat, lng);

    // 지도 이동
    mapRef.current.panTo(pos);

    // 기존 임시 핀 제거
    if (searchPinRef.current) {
      searchPinRef.current.setMap(null);
      searchPinRef.current = null;
    }

    // 임시 오버레이 (작은 원형 썸네일/마커)
    const content = document.createElement("div");
    content.style.transform = "translate(-50%, -100%)";
    content.style.cursor = "pointer";
    content.style.display = "grid";
    content.style.placeItems = "center";

    const pin = document.createElement("div");
    pin.style.width = "26px";
    pin.style.height = "26px";
    pin.style.borderRadius = "50%";
    pin.style.background = "#7c3aed"; // 보라
    pin.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    content.appendChild(pin);

    const tail = document.createElement("div");
    tail.style.width = "0"; tail.style.height = "0";
    tail.style.borderLeft = "6px solid transparent";
    tail.style.borderRight = "6px solid transparent";
    tail.style.borderTop = "7px solid #7c3aed";
    tail.style.marginTop = "2px";
    content.appendChild(tail);

    content.title = item.place_name;

    content.onclick = () => {
      window.open(`https://map.kakao.com/link/map/${encodeURIComponent(item.place_name)},${lat},${lng}`, "_blank");
    };

    const overlay = new kakao.maps.CustomOverlay({
      position: pos,
      content,
      yAnchor: 1,
      zIndex: 999,
      clickable: true
    });
    overlay.setMap(mapRef.current);
    searchPinRef.current = overlay;
  };

  // 엔터로 검색
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doSearch();
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* 상단 검색바 (카카오 장소검색 전용) */}
      <div style={{
        position: "absolute", zIndex: 5, top: 10, left: 12,
        background: "rgba(255,255,255,0.95)", backdropFilter: "saturate(120%) blur(4px)",
        border: "1px solid #e5e5ea", borderRadius: 12, padding: 10,
        display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }}>
        <span>🔎</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="장소를 검색하세요 (카카오 장소검색)"
          style={{ border: "none", outline: "none", fontSize: 16, width: 260, background: "transparent" }}
        />
        <button onClick={doSearch} disabled={searching} style={{ padding: "6px 10px" }}>
          {searching ? "검색 중..." : "검색"}
        </button>
      </div>

      {/* 좌측 결과 패널 */}
      {!!results.length && (
        <div style={{
          position: "absolute", zIndex: 5, top: 56, left: 12,
          width: 340, maxHeight: 360, overflow: "auto",
          background: "#fff", border: "1px solid #e5e5ea", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)"
        }}>
          {results.map((r) => (
            <div key={r.id} style={{ padding: 12, borderBottom: "1px solid #f1f1f5" }}>
              <div style={{ fontWeight: 700 }}>{r.place_name}</div>
              <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                {r.road_address_name || r.address_name || "-"}
              </div>
              {r.phone && <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{r.phone}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => focusResult(r)}>이 위치 보기</button>
                <button
                  onClick={() => {
                    const lat = parseFloat(r.y).toFixed(6);
                    const lng = parseFloat(r.x).toFixed(6);
                    window.location.href = `/create?lat=${lat}&lng=${lng}`;
                  }}
                >
                  여기로 장소추가
                </button>
                <a
                  href={`https://map.kakao.com/link/to/${encodeURIComponent(r.place_name)},${r.y},${r.x}`}
                  target="_blank" rel="noreferrer"
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
        style={{ width: "100%", height: "calc(100vh - 60px)", borderTop: "1px solid #f0f0f0" }}
      />
    </div>
  );
}

function drawSavedPlaceOverlays(kakao, map, places, storeRef) {
  storeRef.current.forEach(o => o.setMap(null));
  storeRef.current = [];

  places.forEach((p, idx) => {
    if (!isFinite(p.latitude) || !isFinite(p.longitude)) return;
    const pos = new kakao.maps.LatLng(p.latitude, p.longitude);

    const base = 64;
    const pref = clamp(Number(p.preference) || 3, 1, 5);
    const size = base + (pref - 3) * 8 + (idx % 3) * 6;

    const img = p.image_url || "https://via.placeholder.com/200x200?text=No+Image";

    // 🎨 content: 둥근 말풍선 (SVG 꼬리 포함)
    const content = document.createElement("div");
    content.style.position = "relative";
    content.style.transform = "translate(-50%, -100%)";
    content.style.cursor = "pointer";
    content.style.width = `${size + 12}px`;
    content.style.height = `${size + 20}px`;

    // 내부 wrapper (말풍선 테두리)
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = `${size}px`;
    wrapper.style.height = `${size}px`;
    wrapper.style.margin = "0 auto";
    wrapper.style.borderRadius = "50%";
    wrapper.style.overflow = "hidden";
    wrapper.style.border = "5px solid white";
    wrapper.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
    wrapper.style.backgroundImage = `url('${img}')`;
    wrapper.style.backgroundSize = "cover";
    wrapper.style.backgroundPosition = "center";
    wrapper.style.transition = "transform 150ms ease";
    content.appendChild(wrapper);

    // 🗨️ 말풍선 꼬리 (SVG)
    const tail = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    tail.setAttribute("width", "40");
    tail.setAttribute("height", "22");
    tail.style.position = "absolute";
    tail.style.left = "50%";
    tail.style.bottom = "-14px";
    tail.style.transform = "translateX(-50%)";
    tail.style.filter = "drop-shadow(0 2px 2px rgba(0,0,0,0.15))";

    // 꼬리 경로 (부드럽게 둥근 삼각형)
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M20 22 C16 14, 24 14, 20 22 Z"
    );
    path.setAttribute("fill", "white");
    tail.appendChild(path);
    content.appendChild(tail);

    // Hover 효과
    content.onmouseenter = () => (wrapper.style.transform = "scale(1.06)");
    content.onmouseleave = () => (wrapper.style.transform = "scale(1.0)");

    // 클릭 → 상세 페이지 이동
    content.onclick = () => window.location.href = `/place/${p.id}`;
    content.title = `${p.name ?? ""}  •  ⭐ ${p.preference ?? "-"}`;

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

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
