/* ===== 로비(lobby.js)와 게임(game.js)이 함께 쓰는 데이터 ===== */
const BP = {
  // 1~4일차에 하나씩 해금 (팥 → 슈크림 → 치즈 → 민초)
  FILLINGS: [
    { id: 'red',    name: '팥',     icon: '🫘', price: 1500, color: '#8e3b34' },
    { id: 'cream',  name: '슈크림', icon: '🍮', price: 1500, color: '#ffe27a' },
    { id: 'cheese', name: '치즈',   icon: '🧀', price: 2000, color: '#ffb92e' },
    { id: 'mint',   name: '민초',   icon: '🌿', price: 2000, color: '#74dcc0' },
  ],

  // 일차별 설정 — goal: 목표 매출, time: 하루 영업 시간(초), patience: 손님 기본 인내심(초), slots: 동시에 서는 손님 수
  // 1~4일차는 시간제: time이 지나면 영업 종료, 그때까지 번 돈이 goal 이상이면 클리어 (손님은 인내심이 바닥나도 떠나지 않고 화난 채 기다림)
  // 5일차는 무한 모드: 시간·목표 없이 최고 기록 도전, 손님이 화나서 가면 기회(lives) 1번 차감
  DAYS: [
    { goal: 25000, time: 180, patience: 60,
      story: { icon: '👵', title: '할머니의 포장마차',
        intro: '허리를 다치신 할머니 대신 오늘부터 내가 포장마차를 맡게 됐다. "처음엔 팥붕만 구워도 충분하단다. 천천히 해, 천천히."',
        outro: '첫날 장사 끝! 할머니가 따뜻한 팥붕 한 입을 드시며 웃으셨다. "우리 손주, 손이 빠르네."' } },
    { goal: 30000, time: 180, patience: 54,
      story: { icon: '🍮', title: '학생들의 소문',
        intro: '어젯밤 올라온 후기 덕분에 학교 앞 학생들이 몰려온다. "여기 슈크림도 돼요?" 새 재료를 준비해야 한다!',
        outro: '슈크림붕어빵이 동네 단톡방에 퍼졌다. 내일은 퇴근길 직장인 손님들이 올 것 같다.' } },
    { goal: 33000, time: 180, patience: 48,
      story: { icon: '🧀', title: '야식 손님의 습격',
        intro: '퇴근길 직장인들이 야식으로 치즈붕어빵을 찾기 시작했다. 늘어나는 주문, 바빠지는 손놀림!',
        outro: '쭉 늘어나는 치즈에 모두가 감탄! 이제 단골이 하나둘 생겼다.' } },
    { goal: 35000, time: 180, patience: 44,
      story: { icon: '🌿', title: '민초단 출동',
        intro: '"민초 붕어빵… 있나요?" 소문을 들은 민초단이 나타났다. 호불호가 갈리는 맛이지만, 좋아하는 사람은 정말 좋아한다.',
        outro: '민초단의 열렬한 지지! 반대파 손님도 한 입 먹고 말없이 지갑을 열었다.' } },
    { endless: true, lives: 5, patience: 46, slots: 2,
      story: { icon: '❄️', title: '한파 특보, 마지막 밤',
        intro: '뭔가 잘못됐어… 우리 포장마차 위치가 SNS에 퍼진 것 같다…! 손님이 끝도 없이 몰려온다. 열심히 해보자!!!<br><small>손님 무한 · 기회 5번 · 실수하면 기회가 깎여요</small>',
        outro: '긴 밤이 끝났다. 포장마차는 어느새 SNS 맛집이 됐고, 멀리서 지켜보던 할머니가 엄지를 들어 보이셨다. "이제 네가 진짜 사장이다."' } },
  ],

  // 1일차 시작 전 튜토리얼 — img: game.js 의 tutorialImage() 가 그리는 그림 종류
  TUTORIAL: [
    { img: 'order', title: '주문 확인', text: '손님이 오면 <b>주문서</b>가 나와요. 어떤 속재료를 몇 개 원하는지 확인하세요. <b>⏱ 급해요!</b> 표시가 있으면 인내심이 더 빨리 줄어요.' },
    { img: 'pour',  title: '① 반죽 붓기', text: '<b>🥣 반죽</b>을 고른 뒤 <b>빈 틀</b>을 탭하면 반죽이 가운데부터 퍼져요.' },
    { img: 'fill',  title: '② 속재료 넣기', text: '주문서의 <b>속재료</b>를 고른 뒤 반죽이 담긴 틀을 탭해요. 재료가 왼쪽부터 차올라요.' },
    { img: 'close', title: '③ 판 덮기', text: '속이 다 차면 <b>"탭해서 덮기!"</b> 상태의 틀을 탭해서 판을 덮어요.' },
    { img: 'flip',  title: '④ 뒤집기 (타이밍!)', text: '덮고 2.5초 뒤 <b>타이밍 게이지</b>가 나와요. 왔다 갔다 하는 흰 막대가 <b>초록 구역</b>에 있을 때 탭하면 뒤집혀요. 빗나가면 잠깐 못 눌러요.' },
    { img: 'bake',  title: '⑤ 굽기 확인 · 열기', text: '뒤집은 순간부터 익어요. <b>덜 익음</b>일 땐 열 수 없어요. <b>알맞음</b>에서 틀을 탭해 열고, 너무 오래 두면 <b>탄</b> 붕어빵이 돼요.' },
    { img: 'bag',   title: '⑥ 봉투에 담기', text: '열린 붕어빵을 <b>꾹 눌러 끌어서 봉투</b>에 놓으세요. 봉투에 담긴 개수가 표시돼요. 잘못 만든 건 🗑에 버려요.' },
    { img: 'serve', title: '⑦ 손님에게 전달', text: '주문대로 담았으면 <b>봉투를 끌어서 손님에게</b> 놓아요. 정확하고 빠를수록 돈과 팁을 더 받아요.' },
    { img: 'goal',  title: '목표와 영업 시간', text: '<b>3분 안에 목표 금액</b>을 벌면 클리어! 손님은 기다릴수록 화나고, 인내심이 바닥나면 받는 돈이 <b>30%</b>로 줄어요.' },
  ],

  BEST_KEY: 'bp_best_day5',   // 5일차 최고 기록 저장 키 (이 기기 브라우저의 localStorage, 서버 없음)

  // localStorage 읽기/쓰기 (막힌 환경에서도 오류 없이 동작)
  load(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; } },
  save(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) { /* 저장 불가 환경 무시 */ } },
};
