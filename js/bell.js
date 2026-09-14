function renderBellPage() {
  const list = document.getElementById('bellGrid');
  if (!list) return;
  let html = '';
  for (const p of PAIRS) {
    const isLast = p.break === 0;
    const breakText = isLast ? 'Конец занятий' : `${p.break} мин`;
    const breakClass = isLast ? 'bell-break-cell none' : 'bell-break-cell';
    const curClass = isPairNow(p) ? ' bell-current' : '';
    html += `
      <div class="bell-row${curClass}">
        <div><div class="bell-num-cell">${p.num}</div></div>
        <div><div class="bell-time-cell">${p.start}</div></div>
        <div><div class="bell-time-cell">${p.end}</div></div>
        <div><div class="${breakClass}">${breakText}</div></div>
      </div>`;
  }
  list.innerHTML = html;
}