/* =========================================================
   สมุดเงินสด — Income/Expense Tracker (Glass Edition v2)
========================================================= */

const STORAGE_KEY = 'moneyflow_records_v1';
const TITLE_KEY = 'moneyflow_app_title_v1';
const DAY_NAMES_TH = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
const MONTH_NAMES_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

let records = {};
let activeDate = todayStr();
let chartPeriod = 'day';
let chartType = 'bar';

/* ---------- helpers ---------- */
// IMPORTANT: never use Date.toISOString() to get a "date string" — it converts
// to UTC, which shifts the date backwards during early morning hours in
// timezones ahead of UTC (e.g. Thailand, UTC+7). Always build the string from
// the LOCAL year/month/day instead.
function localDateStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayStr(){ return localDateStr(new Date()); }
function fmtBaht(n){
  n = Number(n) || 0;
  return '฿' + n.toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtNum(n){
  n = Number(n) || 0;
  return n.toLocaleString('th-TH', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function num(id){ const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : v; }
function uid(){ return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function thaiDate(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate() + ' ' + MONTH_NAMES_TH[d.getMonth()] + ' ' + (d.getFullYear()+543);
}

/* ---------- storage ---------- */
function loadAll(){
  try{ records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }catch(e){ records = {}; }
}
function saveAll(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
function emptyRecord(date){
  return { date, income:{note:0,coin:0,app:0}, expenses:[], change:{coin:0,note:0} };
}
function getRecord(date){
  if(!records[date]) records[date] = emptyRecord(date);
  // backward-compat: ensure shape even if loaded from an older data version
  if(!records[date].change) records[date].change = {coin:0, note:0};
  if(!records[date].income) records[date].income = {note:0, coin:0, app:0};
  if(!records[date].expenses) records[date].expenses = [];
  return records[date];
}
function sortedDates(){ return Object.keys(records).sort(); }
function previousDate(date){
  const dates = sortedDates().filter(d => d < date);
  return dates.length ? dates[dates.length-1] : null;
}

/* ---------- computed totals ---------- */
function computeTotals(rec){
  const totalIncome = (rec.income.note||0) + (rec.income.coin||0) + (rec.income.app||0);
  const totalExpense = rec.expenses.reduce((s,e)=> s + (e.amount||0), 0);
  const totalChange = (rec.change.coin||0) + (rec.change.note||0);
  const incomeReal = totalIncome - totalChange;
  const net = incomeReal - totalExpense;
  return { totalIncome, totalExpense, totalChange, incomeReal, net };
}
// รายได้สุทธิของเดือน = ผลรวม (รายรับ - รายจ่าย - เงินทอน) ของทุกวันในเดือนนั้น
function monthlyNetTotal(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  let total = 0;
  sortedDates().forEach(key=>{
    const kd = new Date(key + 'T00:00:00');
    if(kd.getFullYear() === d.getFullYear() && kd.getMonth() === d.getMonth()){
      const t = computeTotals(records[key]);
      total += t.net;
    }
  });
  return total;
}

/* ---------- toast ---------- */
function showToast(message, type='success'){
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(()=> el.remove(), 2600);
}

/* ---------- confirm modal (generic, promise-based) ---------- */
function confirmAction(title, message){
  return new Promise((resolve)=>{
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.add('open');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    function cleanup(result){
      modal.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}
function dateAwareMessage(baseMessage){
  if(activeDate === todayStr()) return baseMessage;
  return baseMessage + ` (ข้อมูลของวันที่ ${thaiDate(activeDate)})`;
}

/* ---------- render ---------- */
function renderDateUI(){
  document.getElementById('activeDate').value = activeDate;
  const d = new Date(activeDate + 'T00:00:00');
  document.getElementById('dayName').textContent = DAY_NAMES_TH[d.getDay()];
  document.getElementById('carryDateLabel').textContent = thaiDate(activeDate);
}

function renderForm(){
  const rec = getRecord(activeDate);
  document.getElementById('incomeNote').value = rec.income.note || '';
  document.getElementById('incomeCoin').value = rec.income.coin || '';
  document.getElementById('incomeApp').value = rec.income.app || '';
  document.getElementById('changeCoin').value = rec.change.coin || '';
  document.getElementById('changeNote').value = rec.change.note || '';

  renderExpenseList(rec);
  renderCards(rec);
  renderDateUI();
}

function renderExpenseList(rec){
  const list = document.getElementById('expenseList');
  list.innerHTML = '';
  rec.expenses.forEach(e=>{
    const div = document.createElement('div');
    div.className = 'expense-item';
    div.innerHTML = `
      <div class="ei-info">
        <span>${escapeHtml(e.desc)}</span>
        <span class="ei-cat">${escapeHtml(e.category)}</span>
      </div>
      <div style="display:flex;align-items:center;">
        <span class="ei-amount">${fmtBaht(e.amount)}</span>
        <button class="ei-del" data-del="${e.id}" aria-label="ลบรายการ">✕</button>
      </div>`;
    list.appendChild(div);
  });
  document.getElementById('expenseTotal').textContent = fmtBaht(rec.expenses.reduce((s,e)=>s+e.amount,0));
}

function escapeHtml(s){ const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderCards(rec){
  const t = computeTotals(rec);
  document.getElementById('cardIncomeReal').textContent = fmtNum(t.incomeReal);
  document.getElementById('cardExpense').textContent = fmtNum(t.totalExpense);
  document.getElementById('cardNet').textContent = fmtNum(t.net);
  document.getElementById('heroCaption').innerHTML =
    `เงินทอน <b>${fmtNum(t.totalChange)} ฿</b> — (รายรับ ${fmtNum(t.totalIncome)} – ${fmtNum(t.totalChange)} = รายรับแท้จริง ${fmtNum(t.incomeReal)} ฿)`;

  document.getElementById('chipIncome').textContent = fmtNum(t.totalIncome) + ' ฿';
  document.getElementById('chipExpense').textContent = fmtNum(t.totalExpense) + ' ฿';
  document.getElementById('chipChange').textContent = fmtNum(t.totalChange) + ' ฿';

  document.getElementById('incomeTotal').textContent = fmtBaht(t.totalIncome);
  document.getElementById('changeTotal').textContent = fmtBaht(t.totalChange);

  const monthTotal = monthlyNetTotal(activeDate);
  const d = new Date(activeDate + 'T00:00:00');
  document.getElementById('cardMonthlyNet').textContent = fmtBaht(monthTotal);
  document.getElementById('monthlyNetCaption').textContent =
    `รวมรายรับหักรายจ่ายและเงินทอน ของเดือน${MONTH_NAMES_TH[d.getMonth()]} ${d.getFullYear()+543}`;
}

/* ---------- save handlers (all confirm-gated) ---------- */
async function saveIncome(){
  const ok = await confirmAction('ยืนยันบันทึกรายรับ', dateAwareMessage('ต้องการบันทึกรายรับใช่หรือไม่?'));
  if(!ok) return;
  const rec = getRecord(activeDate);
  rec.income.note = num('incomeNote');
  rec.income.coin = num('incomeCoin');
  rec.income.app = num('incomeApp');
  saveAll(); renderCards(rec);
  showToast('บันทึกรายรับสำเร็จ ✓', 'success');
}
async function saveChange(){
  const ok = await confirmAction('ยืนยันบันทึกเงินทอน', dateAwareMessage('ต้องการบันทึกเงินทอนใช่หรือไม่?'));
  if(!ok) return;
  const rec = getRecord(activeDate);
  rec.change.coin = num('changeCoin');
  rec.change.note = num('changeNote');
  saveAll(); renderCards(rec);
  showToast('บันทึกเงินทอนสำเร็จ ✓', 'success');
}
async function addExpense(){
  const desc = document.getElementById('expenseDesc').value.trim();
  const amount = num('expenseAmount');
  let category = document.getElementById('expenseCategory').value;
  if(category === '__custom'){
    category = document.getElementById('expenseCategoryCustom').value.trim() || 'อื่นๆ';
  }
  if(!desc || amount <= 0){
    showToast('กรุณากรอกรายการและจำนวนเงินให้ถูกต้อง', 'error');
    return;
  }
  const ok = await confirmAction('ยืนยันเพิ่มรายจ่าย', dateAwareMessage(`เพิ่มรายการ "${desc}" จำนวน ${fmtBaht(amount)} ใช่หรือไม่?`));
  if(!ok) return;
  const rec = getRecord(activeDate);
  rec.expenses.push({ id: uid(), desc, category, amount });
  saveAll(); renderExpenseList(rec); renderCards(rec);
  document.getElementById('expenseDesc').value = '';
  document.getElementById('expenseAmount').value = '';
  showToast('เพิ่มรายการรายจ่ายสำเร็จ ✓', 'success');
}
async function deleteExpense(id){
  const ok = await confirmAction('ยืนยันการลบ', dateAwareMessage('ต้องการลบรายการนี้ใช่หรือไม่?'));
  if(!ok) return;
  const rec = getRecord(activeDate);
  rec.expenses = rec.expenses.filter(e => e.id !== id);
  saveAll(); renderExpenseList(rec); renderCards(rec);
  showToast('ลบรายการสำเร็จ ✓', 'error');
}

/* ---------- accordion ---------- */
function initAccordion(){
  const cards = document.querySelectorAll('.form-card');
  cards.forEach((card, idx)=>{
    if(idx === 0) card.classList.add('open');
    const header = card.querySelector('.card-header');
    header.addEventListener('click', ()=> toggleCard(card));
  });
}
function toggleCard(card){
  const body = card.querySelector('.card-body');
  const isOpen = card.classList.contains('open');
  if(isOpen){
    card.classList.remove('open');
    body.style.maxHeight = '0px';
  }else{
    card.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 40 + 'px';
  }
}
function refreshOpenCardHeight(){
  document.querySelectorAll('.form-card.open').forEach(card=>{
    const body = card.querySelector('.card-body');
    body.style.maxHeight = body.scrollHeight + 40 + 'px';
  });
}

/* ---------- period summary ---------- */
function getISOWeekKey(dateObj){
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(),0,4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay()+6)%7)) / 7);
  return d.getUTCFullYear() + '-W' + week;
}
function filterByPeriod(period, refDateStr){
  const active = new Date(refDateStr + 'T00:00:00');
  return sortedDates().filter(dateKey=>{
    const d = new Date(dateKey + 'T00:00:00');
    if(period === 'day') return dateKey === refDateStr;
    if(period === 'week') return getISOWeekKey(d) === getISOWeekKey(active);
    if(period === 'month') return d.getFullYear() === active.getFullYear() && d.getMonth() === active.getMonth();
    if(period === 'year') return d.getFullYear() === active.getFullYear();
    return false;
  }).map(k=>records[k]);
}
function renderPeriodSummary(period){
  const filtered = filterByPeriod(period, activeDate);
  let income=0, expense=0, change=0;
  filtered.forEach(rec=>{
    const t = computeTotals(rec);
    income += t.totalIncome; expense += t.totalExpense; change += t.totalChange;
  });
  const net = income - expense - change;
  const container = document.getElementById('periodResults');
  container.innerHTML = `
    <div class="p-line p-income"><span>รายรับรวม</span><span class="p-value">${fmtBaht(income)}</span></div>
    <div class="p-line p-expense"><span>รายจ่ายรวม</span><span class="p-value">${fmtBaht(expense)}</span></div>
    <div class="p-line p-change"><span>เงินทอนรวม</span><span class="p-value">${fmtBaht(change)}</span></div>
    <div class="p-line p-net"><span>ยอดสุทธิรวม</span><span class="p-value">${fmtBaht(net)}</span></div>
    <div class="p-meta">อ้างอิงจาก ${filtered.length} วันที่มีข้อมูล</div>
  `;
}

/* ---------- search ---------- */
function runSearch(query){
  query = query.trim().toLowerCase();
  const results = document.getElementById('searchResults');
  results.innerHTML = '';
  if(!query) return;
  let found = [];
  sortedDates().reverse().forEach(dateKey=>{
    const rec = records[dateKey];
    if(dateKey.includes(query)) found.push({dateKey, text:'ข้อมูลของวันที่ ' + dateKey, amount:null});
    rec.expenses.forEach(e=>{
      if(e.desc.toLowerCase().includes(query) || e.category.toLowerCase().includes(query)){
        found.push({dateKey, text: e.desc + ' (' + e.category + ')', amount: e.amount});
      }
    });
  });
  if(found.length === 0){
    results.innerHTML = '<div class="search-result-item">ไม่พบรายการที่ตรงกับคำค้นหา</div>';
    return;
  }
  found.slice(0,50).forEach(f=>{
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `<div class="sr-date">${f.dateKey}</div><div>${escapeHtml(f.text)}${f.amount!=null ? ' — ' + fmtBaht(f.amount) : ''}</div>`;
    results.appendChild(div);
  });
}

/* ---------- chart: build buckets across period ---------- */
function buildChartBuckets(period){
  const active = new Date(activeDate + 'T00:00:00');
  const buckets = [];
  if(period === 'day'){
    for(let i=6;i>=0;i--){
      const d = new Date(active); d.setDate(d.getDate()-i);
      const key = localDateStr(d);
      const rec = records[key] || emptyRecord(key);
      const t = computeTotals(rec);
      buckets.push({label:(d.getDate()+'/'+(d.getMonth()+1)), income:t.totalIncome, expense:t.totalExpense});
    }
  } else if(period === 'week'){
    for(let i=7;i>=0;i--){
      const d = new Date(active); d.setDate(d.getDate() - i*7);
      const wk = getISOWeekKey(d);
      let income=0, expense=0;
      sortedDates().forEach(key=>{
        const kd = new Date(key+'T00:00:00');
        if(getISOWeekKey(kd) === wk){ const t = computeTotals(records[key]); income+=t.totalIncome; expense+=t.totalExpense; }
      });
      buckets.push({label:'W'+wk.split('-W')[1], income, expense});
    }
  } else if(period === 'month'){
    for(let i=11;i>=0;i--){
      const d = new Date(active.getFullYear(), active.getMonth()-i, 1);
      let income=0, expense=0;
      sortedDates().forEach(key=>{
        const kd = new Date(key+'T00:00:00');
        if(kd.getFullYear()===d.getFullYear() && kd.getMonth()===d.getMonth()){ const t = computeTotals(records[key]); income+=t.totalIncome; expense+=t.totalExpense; }
      });
      buckets.push({label:MONTH_NAMES_TH[d.getMonth()].slice(0,3), income, expense});
    }
  } else if(period === 'year'){
    for(let i=4;i>=0;i--){
      const y = active.getFullYear() - i;
      let income=0, expense=0;
      sortedDates().forEach(key=>{
        const kd = new Date(key+'T00:00:00');
        if(kd.getFullYear()===y){ const t = computeTotals(records[key]); income+=t.totalIncome; expense+=t.totalExpense; }
      });
      buckets.push({label:String(y+543), income, expense});
    }
  }
  return buckets;
}

/* ---------- chart: draw (bar / line / pie) ---------- */
function renderChart(){
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const buckets = buildChartBuckets(chartPeriod);

  const totalIncome = buckets.reduce((s,b)=>s+b.income,0);
  const totalExpense = buckets.reduce((s,b)=>s+b.expense,0);
  document.getElementById('legendIncome').textContent = fmtBaht(totalIncome);
  document.getElementById('legendExpense').textContent = fmtBaht(totalExpense);

  if(chartType === 'bar') drawBarChart(ctx, W, H, buckets);
  else if(chartType === 'line') drawLineChart(ctx, W, H, buckets);
  else if(chartType === 'pie') drawPieChart(ctx, W, H, totalIncome, totalExpense);
}
function drawBarChart(ctx, W, H, buckets){
  const maxVal = Math.max(1, ...buckets.map(d=>Math.max(d.income,d.expense)));
  const padding = 36;
  const chartW = W - padding*2;
  const chartH = H - padding*2;
  const groupW = chartW / buckets.length;
  const barW = Math.min(26, groupW * 0.32);

  ctx.strokeStyle = 'rgba(47,111,237,0.2)';
  ctx.beginPath(); ctx.moveTo(padding, H-padding); ctx.lineTo(W-padding, H-padding); ctx.stroke();

  buckets.forEach((d, i)=>{
    const x = padding + i*groupW + groupW/2;
    const incomeH = (d.income/maxVal) * chartH;
    const expenseH = (d.expense/maxVal) * chartH;
    ctx.fillStyle = '#0EA968';
    ctx.fillRect(x - barW - 2, H-padding-incomeH, barW, incomeH);
    ctx.fillStyle = '#E23744';
    ctx.fillRect(x + 2, H-padding-expenseH, barW, expenseH);
    ctx.fillStyle = '#52627A';
    ctx.font = '10.5px IBM Plex Sans Thai, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x, H-padding+16);
  });
}
function drawLineChart(ctx, W, H, buckets){
  const maxVal = Math.max(1, ...buckets.map(d=>Math.max(d.income,d.expense)));
  const padding = 36;
  const chartW = W - padding*2;
  const chartH = H - padding*2;
  const stepX = buckets.length > 1 ? chartW / (buckets.length-1) : 0;

  ctx.strokeStyle = 'rgba(47,111,237,0.2)';
  ctx.beginPath(); ctx.moveTo(padding, H-padding); ctx.lineTo(W-padding, H-padding); ctx.stroke();

  function drawSeries(key, color){
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineJoin='round';
    buckets.forEach((d,i)=>{
      const x = padding + i*stepX;
      const y = H - padding - (d[key]/maxVal)*chartH;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    buckets.forEach((d,i)=>{
      const x = padding + i*stepX;
      const y = H - padding - (d[key]/maxVal)*chartH;
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();
    });
  }
  drawSeries('income', '#0EA968');
  drawSeries('expense', '#E23744');

  ctx.fillStyle = '#52627A';
  ctx.font = '10.5px IBM Plex Sans Thai, sans-serif';
  ctx.textAlign = 'center';
  buckets.forEach((d,i)=>{
    const x = padding + i*stepX;
    ctx.fillText(d.label, x, H-padding+16);
  });
}
function drawPieChart(ctx, W, H, totalIncome, totalExpense){
  const cx = W/2, cy = H/2 - 10, r = Math.min(W,H)/2 - 50;
  const total = totalIncome + totalExpense;
  if(total <= 0){
    ctx.fillStyle = '#52627A';
    ctx.font = '13px IBM Plex Sans Thai, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ยังไม่มีข้อมูลในช่วงนี้', cx, cy);
    return;
  }
  const incomeAngle = (totalIncome/total) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(cx,cy);
  ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + incomeAngle);
  ctx.closePath();
  ctx.fillStyle = '#0EA968';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx,cy);
  ctx.arc(cx, cy, r, -Math.PI/2 + incomeAngle, -Math.PI/2 + Math.PI*2);
  ctx.closePath();
  ctx.fillStyle = '#E23744';
  ctx.fill();

  // percentage labels
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px IBM Plex Sans Thai, sans-serif';
  ctx.textAlign = 'center';
  const incomePct = Math.round((totalIncome/total)*100);
  const expensePct = 100 - incomePct;
  const midIncomeAngle = -Math.PI/2 + incomeAngle/2;
  const midExpenseAngle = -Math.PI/2 + incomeAngle + (Math.PI*2 - incomeAngle)/2;
  if(totalIncome > 0){
    ctx.fillText(incomePct+'%', cx + Math.cos(midIncomeAngle)*r*0.6, cy + Math.sin(midIncomeAngle)*r*0.6);
  }
  if(totalExpense > 0){
    ctx.fillText(expensePct+'%', cx + Math.cos(midExpenseAngle)*r*0.6, cy + Math.sin(midExpenseAngle)*r*0.6);
  }
}

/* ---------- history panel ---------- */
function populateHistoryYears(){
  const sel = document.getElementById('historyYear');
  const years = new Set(sortedDates().map(d=> new Date(d+'T00:00:00').getFullYear()));
  years.add(new Date().getFullYear());
  const sortedYears = Array.from(years).sort((a,b)=>b-a);
  sel.innerHTML = '<option value="all">ทุกปี</option>' + sortedYears.map(y=>`<option value="${y}">${y+543}</option>`).join('');
}
function renderHistoryList(){
  const yearVal = document.getElementById('historyYear').value;
  const monthVal = document.getElementById('historyMonth').value;
  const list = document.getElementById('historyList');
  const dates = sortedDates().reverse().filter(dateKey=>{
    const d = new Date(dateKey+'T00:00:00');
    if(yearVal !== 'all' && String(d.getFullYear()) !== yearVal) return false;
    if(monthVal !== 'all' && String(d.getMonth()) !== monthVal) return false;
    return true;
  });
  if(dates.length === 0){
    list.innerHTML = '<div class="hist-empty">ไม่พบข้อมูลในช่วงที่เลือก</div>';
    return;
  }
  list.innerHTML = '';
  dates.forEach(dateKey=>{
    const rec = records[dateKey];
    const t = computeTotals(rec);
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="hist-info">
        <span class="hist-date">${dateKey}</span>
        <span class="hist-sub">รับ ${fmtNum(t.totalIncome)} · จ่าย ${fmtNum(t.totalExpense)}</span>
      </div>
      <div class="hist-actions">
        <span class="hist-net" style="color:${t.net>=0?'#0EA968':'#E23744'}">${fmtNum(t.net)}</span>
        <button class="hist-btn" data-goto="${dateKey}" title="ไปดูวันนี้">↗</button>
        <button class="hist-btn del" data-delhist="${dateKey}" title="ลบวันนี้">✕</button>
      </div>`;
    list.appendChild(div);
  });
}

/* ---------- export: CSV ---------- */
function buildCsvRows(){
  const rows = [['date','income_note','income_coin','income_app','expense_desc','expense_category','expense_amount','change_coin','change_note']];
  sortedDates().forEach(dateKey=>{
    const rec = records[dateKey];
    if(rec.expenses.length === 0){
      rows.push([dateKey, rec.income.note, rec.income.coin, rec.income.app, '', '', '', rec.change.coin, rec.change.note]);
    }else{
      rec.expenses.forEach((e, idx)=>{
        rows.push([
          dateKey, idx===0?rec.income.note:'', idx===0?rec.income.coin:'', idx===0?rec.income.app:'',
          e.desc, e.category, e.amount,
          idx===0?rec.change.coin:'', idx===0?rec.change.note:''
        ]);
      });
    }
  });
  return rows;
}
function exportCsv(){
  const rows = buildCsvRows();
  const csv = rows.map(r => r.map(v=>{
    v = (v===undefined||v===null) ? '' : String(v);
    if(v.includes(',') || v.includes('"')) v = '"' + v.replace(/"/g,'""') + '"';
    return v;
  }).join(',')).join('\n');
  downloadBlob(csv, 'text/csv;charset=utf-8;', 'สมุดเงินสด.csv');
  showToast('ส่งออก CSV สำเร็จ ✓', 'success');
}
function exportExcel(){
  const rows = buildCsvRows();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'บัญชี');
  XLSX.writeFile(wb, 'สมุดเงินสด.xlsx');
  showToast('ส่งออก Excel สำเร็จ ✓', 'success');
}
function downloadBlob(content, mime, filename){
  const blob = new Blob(['\uFEFF' + content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- export: JSON backup ---------- */
function exportJson(){
  const payload = { app: 'moneyflow', version:2, exportedAt: new Date().toISOString(), records };
  downloadBlob(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;', 'สมุดเงินสด-backup.json');
  showToast('สำรองข้อมูลสำเร็จ ✓', 'success');
}
async function importJsonFile(file){
  const text = await file.text();
  let parsed;
  try{ parsed = JSON.parse(text); }catch(e){ showToast('ไฟล์ JSON ไม่ถูกต้อง', 'error'); return; }
  const incoming = parsed.records || parsed;
  if(typeof incoming !== 'object'){ showToast('รูปแบบไฟล์ไม่ถูกต้อง', 'error'); return; }
  const count = Object.keys(incoming).length;
  const ok = await confirmAction('ยืนยันคืนค่าข้อมูล', `พบข้อมูล ${count} วันในไฟล์ ต้องการรวม/อัปเดตทับข้อมูลปัจจุบันหรือไม่?`);
  if(!ok) return;
  Object.keys(incoming).forEach(key=>{ records[key] = incoming[key]; });
  saveAll();
  populateHistoryYears();
  renderForm();
  showToast('คืนค่าข้อมูลสำเร็จ ✓', 'success');
}

/* ---------- export: PDF ---------- */
function exportPdfDay(){
  const rec = getRecord(activeDate);
  const t = computeTotals(rec);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Daily Cash Summary / ' + activeDate, 14, 18);
  doc.setFontSize(11);
  let y = 30;
  const lines = [
    ['Income - notes', rec.income.note],
    ['Income - coins', rec.income.coin],
    ['Income - app/transfer', rec.income.app],
    ['Total income', t.totalIncome],
    ['Change given (coins)', rec.change.coin],
    ['Change given (notes)', rec.change.note],
    ['Total change', t.totalChange],
    ['Real income (income - change)', t.incomeReal],
    ['Total expenses', t.totalExpense],
    ['Net for the day', t.net],
  ];
  lines.forEach(([label, val])=>{
    doc.text(String(label), 14, y);
    doc.text(Number(val||0).toLocaleString('en-US', {minimumFractionDigits:2}), 180, y, {align:'right'});
    y += 8;
  });
  if(rec.expenses.length){
    y += 4;
    doc.setFontSize(12);
    doc.text('Expense items:', 14, y); y += 8;
    doc.setFontSize(10);
    rec.expenses.forEach(e=>{
      doc.text(`${e.desc} (${e.category})`, 14, y);
      doc.text(Number(e.amount).toLocaleString('en-US', {minimumFractionDigits:2}), 180, y, {align:'right'});
      y += 7;
    });
  }
  doc.save(`daily-summary-${activeDate}.pdf`);
  showToast('ส่งออก PDF ใบสรุปรายวันสำเร็จ ✓', 'success');
}
function exportPdfPeriod(){
  const filtered = filterByPeriod('month', activeDate);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Period Report (Monthly)', 14, 18);
  const rows = filtered.map(rec=>{
    const t = computeTotals(rec);
    return [rec.date, t.totalIncome.toFixed(2), t.totalExpense.toFixed(2), t.totalChange.toFixed(2), t.net.toFixed(2)];
  });
  doc.autoTable({
    startY: 26,
    head: [['Date','Income','Expense','Change','Net']],
    body: rows,
    styles: { fontSize: 9 }
  });
  doc.save(`period-report-${activeDate.slice(0,7)}.pdf`);
  showToast('ส่งออก PDF รายงานสรุปช่วงเวลาสำเร็จ ✓', 'success');
}

/* ---------- import CSV (merge, realtime) ---------- */
function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
  return lines.map(line=>{
    const out = []; let cur=''; let inQ=false;
    for(let i=0;i<line.length;i++){
      const c = line[i];
      if(c === '"'){ inQ = !inQ; continue; }
      if(c === ',' && !inQ){ out.push(cur); cur=''; continue; }
      cur += c;
    }
    out.push(cur);
    return out;
  });
}
async function importCsvFile(file){
  const text = await file.text();
  const rows = parseCsv(text);
  rows.shift();
  const affectedDates = new Set();
  let lastDate = null;
  rows.forEach(cols=>{
    const [date] = cols;
    const d = date && date.trim() ? date.trim() : lastDate;
    if(!d) return;
    lastDate = d;
    affectedDates.add(d);
  });
  const ok = await confirmAction('ยืนยันนำเข้าข้อมูล', `พบข้อมูล ${affectedDates.size} วันในไฟล์ CSV ต้องการรวมข้อมูลเข้ากับข้อมูลปัจจุบันหรือไม่?`);
  if(!ok) return;

  lastDate = null;
  rows.forEach(cols=>{
    const [date, incNote, incCoin, incApp, expDesc, expCat, expAmt, chCoin, chNote] = cols;
    const d = date && date.trim() ? date.trim() : lastDate;
    if(!d) return;
    lastDate = d;
    const rec = getRecord(d);
    if(incNote !== undefined && incNote !== '') rec.income.note = parseFloat(incNote)||0;
    if(incCoin !== undefined && incCoin !== '') rec.income.coin = parseFloat(incCoin)||0;
    if(incApp !== undefined && incApp !== '') rec.income.app = parseFloat(incApp)||0;
    if(chCoin !== undefined && chCoin !== '') rec.change.coin = parseFloat(chCoin)||0;
    if(chNote !== undefined && chNote !== '') rec.change.note = parseFloat(chNote)||0;
    if(expDesc && expDesc.trim()){
      rec.expenses.push({ id: uid(), desc: expDesc.trim(), category:(expCat||'อื่นๆ').trim(), amount: parseFloat(expAmt)||0 });
    }
  });
  saveAll();
  populateHistoryYears();
  renderForm();
  showToast('นำเข้า CSV สำเร็จ ✓ ข้อมูลอัปเดตเรียบร้อย', 'success');
}

/* ---------- app title (editable) ---------- */
function loadTitle(){
  const saved = localStorage.getItem(TITLE_KEY);
  if(saved) document.getElementById('appTitle').textContent = saved;
}
function saveTitle(){
  const val = document.getElementById('appTitle').textContent.trim() || 'สมุดเงินสด';
  document.getElementById('appTitle').textContent = val;
  localStorage.setItem(TITLE_KEY, val);
  document.title = val + ' | บัญชีรายรับ-รายจ่าย';
}

/* ---------- events ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  loadAll();
  loadTitle();
  initAccordion();
  renderForm();
  populateHistoryYears();

  document.getElementById('appTitle').addEventListener('blur', saveTitle);
  document.getElementById('appTitle').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('appTitle').blur(); }
  });

  // date navigation — always recomputed fresh from the device clock
  document.getElementById('activeDate').addEventListener('change', (e)=>{
    activeDate = e.target.value || todayStr();
    renderForm(); refreshOpenCardHeight();
  });
  document.getElementById('dateBack').addEventListener('click', ()=>{
    const d = new Date(activeDate + 'T00:00:00'); d.setDate(d.getDate()-1);
    activeDate = localDateStr(d);
    renderForm(); refreshOpenCardHeight();
  });
  document.getElementById('dateFwd').addEventListener('click', ()=>{
    const d = new Date(activeDate + 'T00:00:00'); d.setDate(d.getDate()+1);
    activeDate = localDateStr(d);
    renderForm(); refreshOpenCardHeight();
  });
  document.getElementById('dateToday').addEventListener('click', ()=>{
    activeDate = todayStr();
    renderForm(); refreshOpenCardHeight();
  });

  // "use yesterday's change" — autofill only, still requires Save to confirm
  document.getElementById('useYesterdayChange').addEventListener('click', ()=>{
    const prev = previousDate(activeDate);
    if(!prev){ showToast('ไม่พบข้อมูลของวันก่อนหน้า', 'error'); return; }
    const prevRec = getRecord(prev);
    document.getElementById('changeCoin').value = prevRec.change.coin || '';
    document.getElementById('changeNote').value = prevRec.change.note || '';
    showToast('ดึงยอดเงินทอนของเมื่อวานมาแล้ว กด "บันทึก" เพื่อยืนยัน', 'success');
  });

  document.querySelectorAll('[data-save]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const type = btn.getAttribute('data-save');
      if(type === 'income') saveIncome();
      if(type === 'change') saveChange();
    });
  });

  document.getElementById('expenseCategory').addEventListener('change', (e)=>{
    document.getElementById('expenseCategoryCustom').hidden = e.target.value !== '__custom';
  });
  document.getElementById('addExpenseBtn').addEventListener('click', addExpense);
  document.getElementById('expenseList').addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-del');
    if(id) deleteExpense(id);
  });

  // tap to toggle zoom — stays zoomed until tapped again
  document.querySelectorAll('.zoomable').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.currentTarget.classList.toggle('zoomed');
    });
  });

  document.querySelectorAll('.period-toggle .period-btn[data-period]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.period-toggle .period-btn[data-period]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderPeriodSummary(btn.getAttribute('data-period'));
      refreshOpenCardHeight();
    });
  });
  renderPeriodSummary('day');

  document.querySelectorAll('.chart-period-toggle .period-btn[data-chartperiod]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.chart-period-toggle .period-btn[data-chartperiod]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      chartPeriod = btn.getAttribute('data-chartperiod');
      renderChart();
    });
  });
  document.querySelectorAll('.chart-type-toggle .period-btn[data-charttype]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.chart-type-toggle .period-btn[data-charttype]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      chartType = btn.getAttribute('data-charttype');
      renderChart();
    });
  });

  // download / export / import panel
  const downloadPanel = document.getElementById('downloadPanel');
  document.getElementById('btnDownload').addEventListener('click', (e)=>{
    e.stopPropagation();
    downloadPanel.classList.toggle('open');
  });
  document.addEventListener('click', (e)=>{
    if(!downloadPanel.contains(e.target) && e.target.id !== 'btnDownload'){
      downloadPanel.classList.remove('open');
    }
  });
  document.getElementById('exportExcel').addEventListener('click', ()=>{ exportExcel(); downloadPanel.classList.remove('open'); });
  document.getElementById('exportCsv').addEventListener('click', ()=>{ exportCsv(); downloadPanel.classList.remove('open'); });
  document.getElementById('exportPdfDay').addEventListener('click', ()=>{ exportPdfDay(); downloadPanel.classList.remove('open'); });
  document.getElementById('exportPdfPeriod').addEventListener('click', ()=>{ exportPdfPeriod(); downloadPanel.classList.remove('open'); });
  document.getElementById('exportJson').addEventListener('click', ()=>{ exportJson(); downloadPanel.classList.remove('open'); });
  document.getElementById('importCsvBtn').addEventListener('click', ()=>{ document.getElementById('importCsvInput').click(); downloadPanel.classList.remove('open'); });
  document.getElementById('importJsonBtn').addEventListener('click', ()=>{ document.getElementById('importJsonInput').click(); downloadPanel.classList.remove('open'); });
  document.getElementById('importCsvInput').addEventListener('change', (e)=>{
    if(e.target.files[0]) importCsvFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('importJsonInput').addEventListener('change', (e)=>{
    if(e.target.files[0]) importJsonFile(e.target.files[0]);
    e.target.value = '';
  });

  // search panel
  document.getElementById('btnSearch').addEventListener('click', ()=>{
    document.getElementById('searchPanel').classList.add('open');
    document.getElementById('searchInput').focus();
  });
  document.getElementById('searchInput').addEventListener('input', (e)=> runSearch(e.target.value));

  // chart panel
  document.getElementById('btnChart').addEventListener('click', ()=>{
    document.getElementById('chartPanel').classList.add('open');
    setTimeout(renderChart, 30);
  });

  // history panel
  document.getElementById('btnHistory').addEventListener('click', ()=>{
    populateHistoryYears();
    renderHistoryList();
    document.getElementById('historyPanel').classList.add('open');
  });
  document.getElementById('historyYear').addEventListener('change', renderHistoryList);
  document.getElementById('historyMonth').addEventListener('change', renderHistoryList);
  document.getElementById('historyList').addEventListener('click', async (e)=>{
    const gotoDate = e.target.getAttribute('data-goto');
    const delDate = e.target.getAttribute('data-delhist');
    if(gotoDate){
      activeDate = gotoDate;
      renderForm(); refreshOpenCardHeight();
      document.getElementById('historyPanel').classList.remove('open');
    }
    if(delDate){
      const ok = await confirmAction('ยืนยันการลบ', `ต้องการลบข้อมูลทั้งหมดของวันที่ ${delDate} ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`);
      if(!ok) return;
      delete records[delDate];
      saveAll();
      renderHistoryList();
      populateHistoryYears();
      if(delDate === activeDate){ renderForm(); refreshOpenCardHeight(); }
      showToast('ลบข้อมูลสำเร็จ ✓', 'error');
    }
  });

  // close overlays
  document.querySelectorAll('[data-close]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.getElementById(btn.getAttribute('data-close')).classList.remove('open');
    });
  });
  document.querySelectorAll('.overlay-panel').forEach(panel=>{
    panel.addEventListener('click', (e)=>{
      if(e.target === panel) panel.classList.remove('open');
    });
  });
});
