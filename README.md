## Hi there 👋

<!--
**yomssa/yomssa** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.

Here are some ideas to get you started:

- 🔭 I’m currently working on ...
- 🌱 I’m currently learning ...
- 👯 I’m looking to collaborate on ...
- 🤔 I’m looking for help with ...
- 💬 Ask me about ...
- 📫 How to reach me: ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...
-->

## 👁 눈건강 (`index.html`)

날짜별 안약 점안 체크 앱 (PWA — 휴대폰 홈 화면에 설치해서 앱처럼 사용, 오프라인 동작).

- 아침/점심/저녁: 레바케이 1회, 인공눈물 2회
- 자기 전: 타플로탄에스 1회

기록은 휴대폰 안에 저장되며, 화면 맨 아래 "기록 백업 / 복원"으로 파일 백업이 가능합니다.
스케줄을 바꾸려면 `index.html` 안의 `SCHEDULE` 배열을 수정하세요.
앱 파일을 수정한 뒤에는 `sw.js`의 `CACHE` 버전(v1 → v2)을 올려야 설치된 앱에 반영됩니다.
