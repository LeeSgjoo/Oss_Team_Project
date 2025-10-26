import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";

export default function DetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [memoryText, setMemoryText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "places", id));
        if (!snap.exists()) {
          alert("문서를 찾을 수 없습니다.");
          return nav("/");
        }
        const placeData = { id: snap.id, ...snap.data() };
        setData(placeData);
        setMemoryText(placeData.memory_text || "");
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

  const handleMemoryUpdate = async () => {
    if (!data) return;
    if ((data.memory_text || "") === memoryText) {
      alert("변경된 내용이 없습니다.");
      return;
    }
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "places", id), {
        memory_text: memoryText,
      });
      setData((p) => ({ ...p, memory_text: memoryText }));
      alert("추억이 업데이트되었습니다.");
    } catch (e) {
      console.error("Update failed:", e);
      alert("업데이트에 실패했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (busy) return null;
  if (!data) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        height: "100vh",
        width: 420,
        background: "#fff",
        boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
        overflowY: "auto",
        padding: "24px 16px",
        transition: "transform 0.3s ease",
        zIndex: 5,
      }}
    >
      <button
        onClick={() => nav("/")}
        style={{
          border: "none",
          background: "transparent",
          fontSize: 20,
          cursor: "pointer",
          position: "absolute",
          top: 12,
          right: 16,
        }}
      >
        ✕
      </button>


      <div style={{ marginTop: 28 }}>
        <img
          src={data.image_url || "https://images.pexels.com/photos/28216688/pexels-photo-28216688.png"}
          alt={data.name}
          style={{
            width: "100%",
            height: 240,
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid #eee",
          }}
        />

        <h2 style={{ margin: "16px 0 4px" }}>{data.name}</h2>
        <div style={{ color: "#666", marginBottom: 4 }}>
          {data.type || "유형 없음"} • ⭐ {data.preference ?? "-"}
        </div>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>
          위치: {data.latitude}, {data.longitude}
        </div>

        {/* 추억 텍스트 입력 영역 */}
        <textarea
          value={memoryText}
          onChange={(e) => setMemoryText(e.target.value)}
          placeholder="이 장소에 대한 추억을 기록해보세요."
          style={{
            width: "100%",
            height: 150,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "8px 12px",
            lineHeight: 1.6,
            resize: "vertical",
          }}
        />

        {data.related_people && (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            함께한 사람: {data.related_people}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleMemoryUpdate}
            disabled={isUpdating}
            style={{
              padding: "8px 12px",
              border: "1px solid #4caf50",
              color: "#4caf50",
              borderRadius: 8,
              background: "transparent",
            }}
          >
            {isUpdating ? "업데이트 중..." : "업데이트"}
          </button>
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
  );
}
