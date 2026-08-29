/* =========================================================
   สมุดเงินสด — Income/Expense Tracker
   Data model: one record per date, stored in localStorage
========================================================= */

const STORAGE_KEY = 'moneyflow_records_v1';
const DAY_NAMES_TH = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];

let records = {};      // { 'YYYY-MM-DD': recordObj }
let activeDate = todayStr();

/* ---------- helpers ---------- */
function todayStr(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function fmtBaht(n){
  n = Number(n) || 0;
  return '฿' + n.toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function num(id){
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? 0 : v;
}
function uid(){
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

/* ---------- storage ---------- */
function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : {};
  }catch(e){
    records = {};
  }
}
function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
function emptyRecord(date){
  return {
    date,
    opening: 0,
    income: { note:0, coin:0, app:0 },
    expenses: [],
    change: { coin:0, note:0 },
    carry: { coin:0, note:0 }
  };
}
function getRecord(date){
  if(!records[date]) records[date] = emptyRecord(date);
  return records[date];
}
function sortedDates(){
  return Object.keys(records).sort();
}
function previousDate(date){
  const dates = sortedDates().filter(d => d < date);
  return dates.length ? dates[dates.length-1] : null;
}

/* ---------- computed totals ---------- */
function computeTotals(rec){
  const totalIncome = (rec.income.note||0) + (rec.income.coin||0) + (rec.income.app||0);
  const totalExpense = rec.expenses.reduce((s,e)=> s + (e.amount||0), 0);
  const totalChange = (rec.change.coin||0) + (rec.change.note||0);
  const totalCarry = (rec.carry.coin||0) + (rec.carry.note||0);
  const net = totalIncome - totalExpense;
  const circulating = (rec.opening||0) + totalIncome - totalExpense - totalChange;
  return { totalIncome, totalExpense, totalChange, totalCarry, net, circulating };
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

/* ---------- render: form fields from record ---------- */
function renderDateUI(){
  document.getElementById('activeDate').value = activeDate;
  const d = new Date(activeDate + 'T00:00:00');
  document.getElementById('dayName').textContent = DAY_NAMES_TH[d.getDay()];
  document.getElementById('carryDateLabel').textContent = activeDate + ' (' + DAY_NAMES_TH[d.getDay()] + ')';
}

function renderForm(){
  const rec = getRecord(activeDate);

  document.getElementById('openingCash').value = rec.opening || '';
  document.getElementById('incomeNote').value = rec.income.note || '';
  document.getElementById('incomeCoin').value = rec.income.coin || '';
  document.getElementById('incomeApp').value = rec.income.app || '';
  document.getElementById('changeCoin').value = rec.change.coin || '';
  document.getElementById('changeNote').value = rec.change.note || '';
  document.getElementById('carryCoin').value = rec.carry.coin || '';
  document.getElementById('carryNote').value = rec.carry.note || '';

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

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderCards(rec){
  const t = computeTotals(rec);
  document.getElementById('cardCirculating').textContent = fmtBaht(t.circulating);
  document.getElementById('cardIncome').textContent = fmtBaht(t.totalIncome);
  document.getElementById('cardExpense').textContent = fmtBaht(t.totalExpense);
  document.getElementById('cardChange').textContent = fmtBaht(t.totalChange);
  document.getElementById('cardNet').textContent = fmtBaht(t.net);

  document.getElementById('incomeTotal').textContent = fmtBaht(t.totalIncome);
  document.getElementById('changeTotal').textContent = fmtBaht(t.totalChange);
  document.getElementById('carryTotal').textContent = fmtBaht(t.totalCarry);

  document.getElementById('rIncome').textContent = fmtBaht(t.totalIncome);
  document.getElementById('rExpense').textContent = '-' + fmtBaht(t.totalExpense);
  document.getElementById('rNet').textContent = fmtBaht(t.net);
}

/* ---------- form save handlers ---------- */
function saveOpening(){
  const rec = getRecord(activeDate);
  rec.opening = num('openingCash');
  saveAll();
  renderCards(rec);
  showToast('บันทึกยอดเงินหมุนเวียนสำเร็จ ✓', 'success');
}
function saveIncome(){
  const rec = getRecord(activeDate);
  rec.income.note = num('incomeNote');
  rec.income.coin = num('incomeCoin');
  rec.income.app = num('incomeApp');
  saveAll();
  renderCards(rec);
  showToast('บันทึกรายรับสำเร็จ ✓', 'success');
}
function saveChange(){
  const rec = getRecord(activeDate);
  rec.change.coin = num('changeCoin');
  rec.change.note = num('changeNote');
  saveAll();
  renderCards(rec);
  showToast('บันทึกเงินทอนสำเร็จ ✓', 'success');
}
function saveCarry(){
  const rec = getRecord(activeDate);
  rec.carry.coin = num('carryCoin');
  rec.carry.note = num('carryNote');
  saveAll();
  renderCards(rec);
  showToast('บันทึกเงินทอนยกมาสำเร็จ ✓', 'success');
}
function addExpense(){
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
  const rec = getRecord(activeDate);
  rec.expenses.push({ id: uid(), desc, category, amount });
  saveAll();
  renderExpenseList(rec);
  renderCards(rec);
  document.getElementById('expenseDesc').value = '';
  document.getElementById('expenseAmount').value = '';
  showToast('เพิ่มรายการรายจ่ายสำเร็จ ✓', 'success');
}
function deleteExpense(id){
  const rec = getRecord(activeDate);
  rec.expenses = rec.expenses.filter(e => e.id !== id);
  saveAll();
  renderExpenseList(rec);
  renderCards(rec);
  showToast('ลบรายการสำเร็จ ✓', 'error');
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
function renderPeriodSummary(period){
  const active = new Date(activeDate + 'T00:00:00');
  let filtered = [];

  sortedDates().forEach(dateKey=>{
    const d = new Date(dateKey + 'T00:00:00');
    let match = false;
    if(period === 'day') match = dateKey === activeDate;
    else if(period === 'week') match = getISOWeekKey(d) === getISOWeekKey(active);
    else if(period === 'month') match = d.getFullYear() === active.getFullYear() && d.getMonth() === active.getMonth();
    else if(period === 'year') match = d.getFullYear() === active.getFullYear();
    if(match) filtered.push(records[dateKey]);
  });

  let income=0, expense=0, change=0;
  filtered.forEach(rec=>{
    const t = computeTotals(rec);
    income += t.totalIncome;
    expense += t.totalExpense;
    change += t.totalChange;
  });
  const net = income - expense;

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
  if(!query){ return; }

  let found = [];
  sortedDates().reverse().forEach(dateKey=>{
    const rec = records[dateKey];
    if(dateKey.includes(query)){
      found.push({dateKey, text:'ข้อมูลของวันที่ ' + dateKey, amount:null});
    }
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

/* ---------- chart ---------- */
function renderChart(){
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // last 7 days ending at activeDate
  const days = [];
  const active = new Date(activeDate + 'T00:00:00');
  for(let i=6;i>=0;i--){
    const d = new Date(active);
    d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const rec = records[key] || emptyRecord(key);
    const t = computeTotals(rec);
    days.push({ key, label: (d.getDate()+'/'+(d.getMonth()+1)), income:t.totalIncome, expense:t.totalExpense });
  }

  const maxVal = Math.max(1, ...days.map(d=>Math.max(d.income,d.expense)));
  const padding = 36;
  const chartW = W - padding*2;
  const chartH = H - padding*2;
  const groupW = chartW / days.length;
  const barW = groupW * 0.32;

  // axis
  ctx.strokeStyle = '#DAD5C8';
  ctx.beginPath();
  ctx.moveTo(padding, H-padding);
  ctx.lineTo(W-padding, H-padding);
  ctx.stroke();

  days.forEach((d, i)=>{
    const x = padding + i*groupW + groupW/2;
    const incomeH = (d.income/maxVal) * chartH;
    const expenseH = (d.expense/maxVal) * chartH;

    ctx.fillStyle = '#1F8A5F';
    ctx.fillRect(x - barW - 2, H-padding-incomeH, barW, incomeH);

    ctx.fillStyle = '#B23A48';
    ctx.fillRect(x + 2, H-padding-expenseH, barW, expenseH);

    ctx.fillStyle = '#5B6672';
    ctx.font = '11px IBM Plex Sans Thai, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, x, H-padding+16);
  });
}

/* ---------- export: CSV ---------- */
function buildCsvRows(){
  const rows = [['date','opening','income_note','income_coin','income_app','expense_desc','expense_category','expense_amount','change_coin','change_note','carry_coin','carry_note']];
  sortedDates().forEach(dateKey=>{
    const rec = records[dateKey];
    if(rec.expenses.length === 0){
      rows.push([dateKey, rec.opening, rec.income.note, rec.income.coin, rec.income.app, '', '', '', rec.change.coin, rec.change.note, rec.carry.coin, rec.carry.note]);
    }else{
      rec.expenses.forEach((e, idx)=>{
        rows.push([
          dateKey,
          idx===0 ? rec.opening : '',
          idx===0 ? rec.income.note : '',
          idx===0 ? rec.income.coin : '',
          idx===0 ? rec.income.app : '',
          e.desc, e.category, e.amount,
          idx===0 ? rec.change.coin : '',
          idx===0 ? rec.change.note : '',
          idx===0 ? rec.carry.coin : '',
          idx===0 ? rec.carry.note : ''
        ]);
      });
    }
  });
  return rows;
}
function exportCsv(){
  const rows = buildCsvRows();
  const csv = rows.map(r => r.map(v => {
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

/* ---------- import CSV ---------- */
function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
  const rows = lines.map(line=>{
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
  return rows;
}
function importCsvFile(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const rows = parseCsv(e.target.result);
      const header = rows.shift();
      let lastDate = null;
      rows.forEach(cols=>{
        const [date, opening, incNote, incCoin, incApp, expDesc, expCat, expAmt, chCoin, chNote, caCoin, caNote] = cols;
        const d = date && date.trim() ? date.trim() : lastDate;
        if(!d) return;
        lastDate = d;
        const rec = getRecord(d);
        if(opening !== undefined && opening !== '') rec.opening = parseFloat(opening)||0;
        if(incNote !== undefined && incNote !== '') rec.income.note = parseFloat(incNote)||0;
        if(incCoin !== undefined && incCoin !== '') rec.income.coin = parseFloat(incCoin)||0;
        if(incApp !== undefined && incApp !== '') rec.income.app = parseFloat(incApp)||0;
        if(chCoin !== undefined && chCoin !== '') rec.change.coin = parseFloat(chCoin)||0;
        if(chNote !== undefined && chNote !== '') rec.change.note = parseFloat(chNote)||0;
        if(caCoin !== undefined && caCoin !== '') rec.carry.coin = parseFloat(caCoin)||0;
        if(caNote !== undefined && caNote !== '') rec.carry.note = parseFloat(caNote)||0;
        if(expDesc && expDesc.trim()){
          rec.expenses.push({ id: uid(), desc: expDesc.trim(), category: (expCat||'อื่นๆ').trim(), amount: parseFloat(expAmt)||0 });
        }
      });
      saveAll();
      renderForm();
      showToast('นำเข้า CSV สำเร็จ ✓', 'success');
    }catch(err){
      showToast('นำเข้า CSV ไม่สำเร็จ ตรวจสอบไฟล์อีกครั้ง', 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

/* ---------- events ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  loadAll();
  renderForm();

  // date navigation
  document.getElementById('activeDate').addEventListener('change', (e)=>{
    activeDate = e.target.value || todayStr();
    renderForm();
  });
  document.getElementById('dateBack').addEventListener('click', ()=>{
    const d = new Date(activeDate + 'T00:00:00');
    d.setDate(d.getDate()-1);
    activeDate = d.toISOString().slice(0,10);
    renderForm();
  });
  document.getElementById('dateFwd').addEventListener('click', ()=>{
    const d = new Date(activeDate + 'T00:00:00');
    d.setDate(d.getDate()+1);
    activeDate = d.toISOString().slice(0,10);
    renderForm();
  });

  // opening: use yesterday
  document.getElementById('useYesterday').addEventListener('click', ()=>{
    const prev = previousDate(activeDate);
    if(!prev){ showToast('ไม่พบข้อมูลของวันก่อนหน้า', 'error'); return; }
    const prevRec = getRecord(prev);
    const t = computeTotals(prevRec);
    document.getElementById('openingCash').value = t.circulating.toFixed(2);
  });

  // save buttons
  document.querySelectorAll('[data-save]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const type = btn.getAttribute('data-save');
      if(type === 'opening') saveOpening();
      if(type === 'income') saveIncome();
      if(type === 'change') saveChange();
      if(type === 'carry') saveCarry();
    });
  });

  // expense category custom toggle
  document.getElementById('expenseCategory').addEventListener('change', (e)=>{
    document.getElementById('expenseCategoryCustom').hidden = e.target.value !== '__custom';
  });
  document.getElementById('addExpenseBtn').addEventListener('click', addExpense);
  document.getElementById('expenseList').addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-del');
    if(id) deleteExpense(id);
  });

  // tap to zoom net number
  document.getElementById('cardNet').addEventListener('click', (e)=>{
    e.currentTarget.classList.add('zoomed');
    setTimeout(()=> e.currentTarget.classList.remove('zoomed'), 1400);
  });

  // period summary
  document.querySelectorAll('.period-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderPeriodSummary(btn.getAttribute('data-period'));
    });
  });
  renderPeriodSummary('day');

  // download panel
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
  document.getElementById('importCsvBtn').addEventListener('click', ()=>{
    document.getElementById('importCsvInput').click();
    downloadPanel.classList.remove('open');
  });
  document.getElementById('importCsvInput').addEventListener('change', (e)=>{
    if(e.target.files[0]) importCsvFile(e.target.files[0]);
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

  // close overlays
  document.querySelectorAll('[data-close]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.getElementById(btn.getAttribute('data-close')).classList.remove('open');
    });
  });
});
