const SPREADSHEET_ID = '1JzBgLGmWo7rhW8PYQSjjk-rnQmPHWLwwWQmvYdo-ETM';

function doGet(e) {
  const action = e.parameter.action || 'dashboard';
  const day = e.parameter.day || null;
  const category = e.parameter.category || null;

  let result;

  try {
    if (action === 'dashboard') result = getDashboardData();
    else if (action === 'hourly') result = getHourlyData(day);
    else if (action === 'report') result = getReportData(day);
    else if (action === 'keywords') result = getKeywordsData(day);
    else if (action === 'tickets') result = getTicketsByCategory(day, category);
    else result = { error: 'Unknown action' };
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 오늘 날짜 → day_label 변환
function getTodayLabel() {
  const dayMap = {
    '2026-06-26': 'D1',
    '2026-06-27': 'D2',
    '2026-06-28': 'D3',
    '2026-06-29': 'D4',
  };
  const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  if (dayMap[today]) return dayMap[today];
  const keys = Object.keys(dayMap);
  return keys.length > 0 ? dayMap[keys[0]] : null;
}

// ── tickets 시트 전체 데이터 로드
function loadTickets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tickets');
  const data = sheet.getDataRange().getValues();

  const realHeaders = data[0];
  const rows = [];

  for (let i = 2; i < data.length; i++) {
    if (!data[i][0]) continue;
    const row = {};
    realHeaders.forEach((h, idx) => {
      row[h] = data[i][idx];
    });
    rows.push(row);
  }
  return rows;
}

// ── 1. 대시보드 메인 데이터
function getDashboardData() {
  const tickets = loadTickets();
  const todayLabel = getTodayLabel();

  const dayLabels = ['D1', 'D2', 'D3', 'D4'];
  const todayIdx = dayLabels.indexOf(todayLabel);
  const yesterdayLabel = todayIdx > 0 ? dayLabels[todayIdx - 1] : null;

  const todayTickets = tickets.filter(t => t.day_label === todayLabel);
  const yesterdayTickets = yesterdayLabel
    ? tickets.filter(t => t.day_label === yesterdayLabel)
    : [];

  const totalAll = tickets.length;

  const categories = ['Gameplay Related', 'Installation Issues', 'Bug Report', 'Ban', 'Report', 'Others'];
  const categoryCount = {};
  categories.forEach(c => categoryCount[c] = 0);
  todayTickets.forEach(t => {
    if (categoryCount[t.category] !== undefined) categoryCount[t.category]++;
    else categoryCount['Others']++;
  });

  const langCount = { ko: 0, en: 0, zh: 0, other: 0 };
  todayTickets.forEach(t => {
    const lang = t.language || 'other';
    if (langCount[lang] !== undefined) langCount[lang]++;
    else langCount['other']++;
  });

  const pendingCount = todayTickets.filter(t => t.status === '신규' || t.status === '처리중').length;

  return {
    today: {
      label: todayLabel,
      total: todayTickets.length,
      pending: pendingCount,
      vs_yesterday: todayTickets.length - yesterdayTickets.length,
      category: categoryCount,
      language: langCount,
    },
    yesterday: {
      label: yesterdayLabel,
      total: yesterdayTickets.length,
    },
    total_all: totalAll,
  };
}

// ── 2. 시간대별 데이터
function getHourlyData(day) {
  const tickets = loadTickets();
  const targetDay = day || getTodayLabel();
  const filtered = tickets.filter(t => t.day_label === targetDay);

  const hourly = Array(24).fill(0);
  filtered.forEach(t => {
    const date = new Date(t.created_at);
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const hour = kst.getHours();
    hourly[hour]++;
  });

  return { day: targetDay, hourly };
}

// ── 3. 일간 리포트 데이터
function getReportData(day) {
  const tickets = loadTickets();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const summarySheet = ss.getSheetByName('summary');
  const summaryData = summarySheet.getDataRange().getValues();

  const filtered = tickets.filter(t => t.day_label === day);

  const categories = ['Gameplay Related', 'Installation Issues', 'Bug Report', 'Ban', 'Report', 'Others'];
  const categoryCount = {};
  categories.forEach(c => categoryCount[c] = 0);
  filtered.forEach(t => {
    if (categoryCount[t.category] !== undefined) categoryCount[t.category]++;
    else categoryCount['Others']++;
  });

  const langCount = { ko: 0, en: 0, zh: 0, other: 0 };
  filtered.forEach(t => {
    const lang = t.language || 'other';
    if (langCount[lang] !== undefined) langCount[lang]++;
    else langCount['other']++;
  });

  const dayLabels = ['D1', 'D2', 'D3', 'D4'];
  const trend = dayLabels.map(d => ({
    day: d,
    total: tickets.filter(t => t.day_label === d).length,
  }));

  const recentTickets = filtered
    .slice(-10)
    .map(t => ({
      ticket_id: t.ticket_id,
      subject: t.subject,
      category: t.category,
      language: t.language,
      summary: t.summary,
      keywords: t.keywords,
      status: t.status,
      created_at: t.created_at,
    }));

  return {
    day,
    total: filtered.length,
    category: categoryCount,
    language: langCount,
    trend,
    recent_tickets: recentTickets,
  };
}

// ── 4. 키워드 데이터
function getKeywordsData(day) {
  const tickets = loadTickets();
  const targetDay = day || getTodayLabel();
  const filtered = tickets.filter(t => t.day_label === targetDay);

  const keywordCount = {};
  filtered.forEach(t => {
    if (!t.keywords) return;
    const kws = t.keywords.split(',').map(k => k.trim()).filter(Boolean);
    kws.forEach(kw => {
      keywordCount[kw] = (keywordCount[kw] || 0) + 1;
    });
  });

  const sorted = Object.entries(keywordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));

  return { day: targetDay, keywords: sorted };
}

// ── 5. 카테고리별 티켓 목록 ✅ 신규
function getTicketsByCategory(day, category) {
  const tickets = loadTickets();
  const targetDay = day || getTodayLabel();

  let filtered = tickets.filter(t => t.day_label === targetDay);
  if (category) {
    filtered = filtered.filter(t => t.category === category);
  }

  const result = filtered.map(t => ({
    ticket_id: t.ticket_id,
    subject: t.subject,
    category: t.category,
    language: t.language,
    summary: t.summary,
    keywords: t.keywords,
    status: t.status,
    created_at: t.created_at,
    zendesk_url: `https://pubgsupport.zendesk.com/agent/tickets/${t.ticket_id}`,
  }));

  return { day: targetDay, category: category || 'all', tickets: result };
}
