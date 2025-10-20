// src/kakaoLoader.js
export function loadKakao() {
  return new Promise((resolve, reject) => {
    // 이미 로드되어 있으면 바로 반환
    if (window.kakao && window.kakao.maps) return resolve(window.kakao);

    // 중복 주입 방지용
    const EXISTING_ID = "kakao-maps-sdk";
    if (document.getElementById(EXISTING_ID)) {
      const check = () =>
        window.kakao && window.kakao.maps
          ? resolve(window.kakao)
          : setTimeout(check, 50);
      return check();
    }

    const script = document.createElement("script");
    script.id = EXISTING_ID;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.REACT_APP_KAKAO_MAP_KEY}&libraries=services&autoload=false`;
    script.onload = () => {
      if (!(window.kakao && window.kakao.maps))
        return reject(new Error("Kakao SDK object missing"));
      // ✅ autoload=false 이므로 maps.load 사용!
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => reject(new Error("Kakao SDK load failed"));
    document.head.appendChild(script);
  });
}
