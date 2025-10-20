import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";

export default function DetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "places", id));
        if (!snap.exists()) {
          alert("문서를 찾을 수 없습니다.");
          return nav("/");
        }
        setData({ id: snap.id, ...snap.data() });
      } finally {
        setBusy(false);
      }
    })();
  }, [id, nav]);

  const handleDelete = async () => {
    if (!window.confirm("정말 삭제할까요?")) return;
    await deleteDoc(doc(db, "places", id));
    alert("삭제되었습니다.");
    nav("/");
  };

  if (busy) return <div style={{ padding: 24 }}>불러오는 중...</div>;
  if (!data) return null;

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: "0 12px" }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 420px" }}>
          <img
            src={
              data.image_url ||
              "https://via.placeholder.com/800x500?text=No+Image"
            }
            alt={data.name}
            style={{
              width: "100%",
              height: 300,
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid #eee",
            }}
          />
        </div>

        <div style={{ flex: "1 1 320px" }}>
          <h2 style={{ margin: "8px 0" }}>{data.name}</h2>
          <div style={{ color: "#666", marginBottom: 4 }}>
            {data.type || "유형 없음"} • ⭐ {data.preference ?? "-"}
          </div>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
            위치: {data.latitude}, {data.longitude}
          </div>
          <div style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>
            {data.memory_text || "추억 텍스트가 없습니다."}
          </div>
          {data.related_people && (
            <div style={{ marginTop: 12, fontSize: 14 }}>
              함께한 사람: {data.related_people}
            </div>
          )}

          {/* 버튼 영역 */}
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              to="/"
              style={{
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              ← 목록
            </Link>

            {/* ✅ 수정 버튼 추가 */}
            <Link
              to={`/edit/${data.id}`}
              style={{
                padding: "8px 12px",
                border: "1px solid #0a84ff",
                color: "#0a84ff",
                borderRadius: 8,
                background: "transparent",
              }}
            >
              수정
            </Link>

            <button
              onClick={handleDelete}
              style={{
                padding: "8px 12px",
                border: "1px solid #f33",
                color: "#f33",
                borderRadius: 8,
                background: "transparent",
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
