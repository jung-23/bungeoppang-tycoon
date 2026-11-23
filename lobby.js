/* 로비 페이지 : 시작 → 일차 선택 → game.html?day=N */
(() => {
  'use strict';
  const { FILLINGS, DAYS } = BP;   // data.js (게임과 공용)
  const won = n => n.toLocaleString('ko-KR');
  const root = document.getElementById('lobby');
  const box = html => { root.innerHTML = `<div class="ov-box">${html}</div>`; };

  function title() {
    history.replaceState(null, '', location.pathname);
    box(`
      <div class="big">🐟🔥</div>
      <h1>붕어빵 타이쿤</h1>
      <p>겨울밤 포장마차 사장님이 되어 보세요!</p>
      <button class="btn" type="button" data-act="select">시작</button>`);
  }

  function select() {
    const cards = DAYS.map((d, i) => `
      <a class="daycard" href="game.html?day=${i + 1}">
        ${i < FILLINGS.length ? `<em class="newtag">NEW ${FILLINGS[i].icon}</em>` : ''}
        <b>Day ${i + 1}</b>
        <span class="menu">${FILLINGS.slice(0, i + 1).map(f => f.icon).join('')}</span>
        <small>${d.endless ? '💀 극악 난이도' : '목표 ' + won(d.goal) + '원'}</small>
      </a>`).join('');
    box(`
      <h2>일차 선택</h2>
      <div class="days">${cards}</div>
      <button class="btn ghostbtn" type="button" data-act="title">← 처음으로</button>`);
  }

  root.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'select') { history.replaceState(null, '', '#select'); select(); }
    if (act === 'title') title();
  });

  if (location.hash === '#select') select(); else title();
})();
