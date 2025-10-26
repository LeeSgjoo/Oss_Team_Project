import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db, storage } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function EditPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "",
    preference: 3,
    latitude: "",
    longitude: "",
    memory_text: "",
    related_people: "",
    image_url: "",
  });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  // 문서 로드
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "places", id));
        if (!snap.exists()) {
          alert("문서를 찾을 수 없어. 목록으로 돌아갈게!");
          return nav("/");
        }
        const d = snap.data();
        setForm({
          name: d.name ?? "",
          type: d.type ?? "",
          preference: d.preference ?? 3,
          latitude: d.latitude ?? "",
          longitude: d.longitude ?? "",
          memory_text: d.memory_text ?? "",
          related_people: d.related_people ?? "",
          image_url: d.image_url ?? "",
        });
      } catch (e) {
        console.error(e);
        alert("불러오기 실패했어.");
        nav("/");
      } finally {
        setBusy(false);
      }
    })();
  }, [id, nav]);

  // 새 파일 미리보기
  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onChange = (e) => {
    const { name, value } = e.target;
    // 라디오 버튼의 값은 문자열이므로 숫자로 변환해줍니다.
    const newValue = name === "preference" ? Number(value) : value;
    setForm((p) => ({ ...p, [name]: newValue }));
  };

  const canSubmit = useMemo(() => {
    return !!form.name && form.latitude !== "" && form.longitude !== "" && !saving;
  }, [form, saving]);

  const onSave = async (e) => {
    e.preventDefault(); // 폼 제출 기본 동작 방지
    if (!canSubmit) return;

    setSaving(true);
    try {
      // (선택) 새 이미지 업로드
      let image_url = form.image_url || "";
      if (file) {
        const safeName = file.name.replace(/\s+/g, "_");
        const ext = safeName.includes(".") ? "" : ""; // 이미 파일명에 확장자 있을 거라 별도 처리 X
        const key = `places/${id}/${Date.now()}_${safeName}${ext}`;
        const storageRef = ref(storage, key);
        const task = uploadBytesResumable(storageRef, file);

        await new Promise((resolve, reject) => {
          task.on("state_changed", null, reject, resolve);
        });

        image_url = await getDownloadURL(storageRef);
      }

      // Firestore 업데이트 (필드명 스키마 유지)
      await updateDoc(doc(db, "places", id), {
        name: form.name,
        type: form.type,
        preference: Number(form.preference) || 0,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        memory_text: form.memory_text,
        related_people: form.related_people,
        image_url,
        updated_at: serverTimestamp(), // 새 타임스탬프(선택 필드)
      });

      alert("수정 완료!");
      nav(`/place/${id}`);
    } catch (e) {
      console.error(e);
      alert("수정 실패: " + (e?.message ?? "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  if (busy) return <div style={{ padding: 24 }}>불러오는 중...</div>;

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

      <h2 style={{ marginTop: 28 }}>장소 수정</h2>

      <form onSubmit={onSave}>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            name="name"
            placeholder="장소명*"
            value={form.name}
            onChange={onChange}
            required
          />

          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="type"
              placeholder="유형(쉼터/풍경/카페 등)"
              value={form.type}
              onChange={onChange}
              style={{ flex: 1 }}
            />
          </div>

          <div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ marginRight: 8, fontSize: 14, color: "#333" }}>선호도:</span>
              {/* form.preference 값에 따라 별 아이콘의 개수를 동적으로 렌더링합니다. */}
              {Array.from({ length: form.preference }).map((_, index) => {
                const starValue = index + 1;
                return (
                  <button
                    key={starValue}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, preference: starValue }))} // 클릭 시 해당 값으로 선호도 설정
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 24,
                      color: "#ffc107", // 항상 노란색으로 표시
                    }}
                  >
                    ⭐
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 4 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={`radio-${value}`} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="preference"
                    value={value}
                    checked={form.preference === value}
                    onChange={onChange}
                    style={{ cursor: "pointer" }}
                  />
                  {value}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="latitude"
              placeholder="위도*"
              value={form.latitude}
              onChange={onChange}
            />
            <input
              name="longitude"
              placeholder="경도*"
              value={form.longitude}
              onChange={onChange}
            />
          </div>

          <textarea
            name="memory_text"
            placeholder="추억 텍스트"
            value={form.memory_text}
            onChange={onChange}
            style={{ width: "100%", height: 120 }}
          />
          <input
            name="related_people"
            placeholder="함께한 사람(쉼표로 구분)"
            value={form.related_people}
            onChange={onChange}
          />

          {/* 현재 이미지 + 교체 업로드 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {preview ? (
                <img
                  src={preview}
                  alt="preview"
                  style={{
                    width: 160,
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #eee",
                  }}
                />
              ) : form.image_url ? (
                <img
                  src={form.image_url}
                  alt="current"
                  style={{
                    width: 160,
                    height: 110,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #eee",
                  }}
                />
              ) : null}
            </div>
          </div>
          
          <button disabled={!canSubmit}>
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}