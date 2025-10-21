// src/pages/CreatePage.jsx
import { useEffect, useMemo, useState } from "react";
import { db, storage } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";

export default function CreatePage() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    type: "",
    preference: 3,
    latitude: "",
    longitude: "",
    memory_text: "",
    related_people: "",
  });

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // 지도에서 넘어온 좌표 (?lat=..&lng=..) 채우기
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const lat = usp.get("lat");
    const lng = usp.get("lng");
    if (lat && lng) {
      setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
    }
  }, []);

  // 파일 미리보기
  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const canSubmit = useMemo(() => {
    return (
      !!form.name &&
      form.latitude !== "" &&
      form.longitude !== "" &&
      !busy
    );
  }, [form, busy]);

  const getMyLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation 미지원");
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((p) => ({
        ...p,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      }));
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    try {
      // 1) 이미지 업로드 (있다면)
      let image_url = "";
      if (file) {
        const ext = file.name.split(".").pop();
        const safeName = file.name.replace(/\s+/g, "_");
        const fileRef = ref(
          storage,
          `places/${Date.now()}_${safeName}.${ext ?? ""}`
        );
        const task = uploadBytesResumable(fileRef, file);

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(
                (snap.bytesTransferred / snap.totalBytes) * 100
              );
              setProgress(pct);
            },
            reject,
            resolve
          );
        });

        image_url = await getDownloadURL(fileRef);
      }

      // 2) Firestore 저장
      await addDoc(collection(db, "places"), {
        name: form.name,
        type: form.type,
        preference: Number(form.preference) || 0,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        memory_text: form.memory_text,
        related_people: form.related_people,
        image_url,
        created_date: serverTimestamp(),
      });

      alert("등록 완료! 지도에서 확인해보세요.");
      nav("/");
    } catch (err) {
      console.error(err);
      alert("등록 실패: " + (err?.message ?? "알 수 없는 오류"));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

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

      <h2 style={{ marginTop: 28 }}>장소 추가</h2>

      <form onSubmit={handleSubmit}>
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
            <input
              name="preference"
              type="number"
              min="1"
              max="5"
              value={form.preference}
              onChange={onChange}
              style={{ width: 120 }}
              title="선호도(1~5)"
            />
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
            <button type="button" onClick={getMyLocation}>
              현재 위치
            </button>
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

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview && (
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
            )}
          </div>

          {busy && progress > 0 && (
            <div
              style={{
                width: "100%",
                height: 8,
                background: "#eee",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "#4caf50",
                }}
              />
            </div>
          )}

          <button disabled={!canSubmit}>
            {busy ? "업로드 중..." : "등록"}
          </button>
        </div>
      </form>
    </div>
  );
}
