/* ===== 로비(lobby.js)와 게임(game.js)이 함께 쓰는 데이터 ===== */
const BP = {
  // 1~4일차에 하나씩 해금 (팥 → 슈크림 → 치즈 → 민초)
  FILLINGS: [
    { id: 'red',    name: '팥',     icon: '🫘', price: 1500, color: '#8e3b34' },
    { id: 'cream',  name: '슈크림', icon: '🍮', price: 1500, color: '#ffe27a' },
    { id: 'cheese', name: '치즈',   icon: '🧀', price: 2000, color: '#ffb92e' },
    { id: 'mint',   name: '민초',   icon: '🌿', price: 2000, color: '#74dcc0' },
  ],

  // 일차별 설정 — goal: 목표 매출, customers: 손님 수, patience: 손님 기본 인내심(초), slots: 동시에 서는 손님 수
  // 5일차는 무한 모드: 목표 없이 최고 기록 도전, 기회(lives) 5번
  DAYS: [
    { goal: 16000, customers: 8,  patience: 60,
      story: { icon: '👵', title: '할머니의 포장마차',
        intro: '허리를 다치신 할머니 대신 오늘부터 내가 포장마차를 맡게 됐다. "처음엔 팥붕만 구워도 충분하단다. 천천히 해, 천천히."',
        outro: '첫날 장사 끝! 할머니가 따뜻한 팥붕 한 입을 드시며 웃으셨다. "우리 손주, 손이 빠르네."' } },
    { goal: 22000, customers: 9,  patience: 54,
      story: { icon: '🍮', title: '학생들의 소문',
        intro: '어젯밤 올라온 후기 덕분에 학교 앞 학생들이 몰려온다. "여기 슈크림도 돼요?" 새 재료를 준비해야 한다!',
        outro: '슈크림붕어빵이 동네 단톡방에 퍼졌다. 내일은 퇴근길 직장인 손님들이 올 것 같다.' } },
    { goal: 28000, customers: 10, patience: 48,
      story: { icon: '🧀', title: '야식 손님의 습격',
        intro: '퇴근길 직장인들이 야식으로 치즈붕어빵을 찾기 시작했다. 늘어나는 주문, 바빠지는 손놀림!',
        outro: '쭉 늘어나는 치즈에 모두가 감탄! 이제 단골이 하나둘 생겼다.' } },
    { goal: 33000, customers: 11, patience: 44,
      story: { icon: '🌿', title: '민초단 출동',
        intro: '"민초 붕어빵… 있나요?" 소문을 들은 민초단이 나타났다. 호불호가 갈리는 맛이지만, 좋아하는 사람은 정말 좋아한다.',
        outro: '민초단의 열렬한 지지! 반대파 손님도 한 입 먹고 말없이 지갑을 열었다.' } },
    { record: true, endless: true, lives: 5, customers: Infinity, patience: 46, slots: 2,
      story: { icon: '❄️', title: '한파 특보, 마지막 밤',
        intro: '뭔가 잘못됐어… 우리 포장마차 위치가 SNS에 퍼진 것 같다…! 손님이 끝도 없이 몰려온다. 열심히 해보자!!!<br><small>손님 무한 · 기회 5번 · 실수하면 기회가 깎여요</small>',
        outro: '긴 밤이 끝났다. 포장마차는 어느새 SNS 맛집이 됐고, 멀리서 지켜보던 할머니가 엄지를 들어 보이셨다. "이제 네가 진짜 사장이다."' } },
  ],

  BEST_KEY: 'bp_best_day5',   // 5일차 최고 기록 저장 키 (이 기기 브라우저의 localStorage, 서버 없음)

  // localStorage 읽기/쓰기 (막힌 환경에서도 오류 없이 동작)
  load(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } },
  save(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) { /* 저장 불가 환경 무시 */ } },
};
