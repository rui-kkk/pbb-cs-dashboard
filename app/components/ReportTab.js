'use client';
import { useState } from 'react';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

const ALPHA_DATES = [
  { day: 'D1', date: '6/26', label: '6/26 (금)' },
  { day: 'D2', date: '6/27', label: '6/27 (토)' },
  { day: 'D3', date: '6/28', label: '6/28 (일)' },
  { day: 'D4', date: '6/29', label: '6/29 (월)' },
];

const CATEGORY_COLORS = {
  'Gameplay Related':    '#1565c0',
  'Installation Issues': '#e65100',
  'Bug Report':          '#b71c1c',
  'Ban':                 '#6a1b9a',
  'Report':              '#1b5e20',
  'Others':              '#424242',
};

const LANG_NAMES = { ko: '한국어', en: '영어', zh: '중국어', other: '기타' };
const LANG_COLORS = ['#1565c0', '#e65100', '#2e7d32', '#888'];

export default function ReportTab() {
  const [startDay, setStartDay] = useState('D1');
  const [endDay, setEndDay]     = useState('D4');
  const [report, setReport]     = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackStatus, setSlackStatus]   = useState('');

  // 선택된 day 범위에 해당하는 day 배열
  function getSelectedDays() {
    const si = ALPHA_DATES.findIndex(d => d.day === startDay);
    const ei = ALPHA_DATES.findIndex(d => d.day === endDay);
    const [from, to] = si <= ei ? [si, ei] : [ei, si];
    return ALPHA_DATES.slice(from, to + 1);
  }

  // Apps Script에서 기간 내 모든 티켓 + 집계 데이터 가져오기
  async function fetchRangeData() {
    const days = getSelectedDays();
    const allTickets = [];
    const trend = [];
    const categoryAgg = {};
    const languageAgg = {};

    for (const { day, label } of days) {
      try {
        const res = await fetch(`${APPS_SCRIPT_URL}?action=report&day=${day}`);
        const data = await res.json();
        const tickets = data.recent_tickets || [];
        allTickets.push(...tickets);
        trend.push({ day, date: label, total: data.total || 0 });
        Object.entries(data.category || {}).forEach(([k, v]) => {
          categoryAgg[k] = (categoryAgg[k] || 0) + v;
        });
        Object.entries(data.language || {}).forEach(([k, v]) => {
          languageAgg[k] = (languageAgg[k] || 0) + v;
        });
      } catch (e) {
        console.error(`${day} fetch error`, e);
        trend.push({ day, date: label, total: 0 });
      }
    }

    return { tickets: allTickets, trend, category: categoryAgg, language: languageAgg };
  }

  async function generateReport() {
    setLoading(true);
    setAiReport(null);
    setSlackStatus('');
    try {
      const rangeData = await fetchRangeData();
      setReport(rangeData);

      const days = getSelectedDays();
      const startDate = days[0]?.label || startDay;
      const endDate   = days[days.length - 1]?.label || endDay;

      setAiLoading(true);
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, ...rangeData }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiReport(data.result);
    } catch (e) {
      alert('리포트 생성 실패: ' + e.message);
    } finally {
      setLoading(false);
      setAiLoading(false);
    }
  }

  // PDF 저장 (브라우저 print)
  function savePDF() {
    window.print();
  }

  // Slack 발송
  async function sendSlack() {
    if (!aiReport) return;
    setSlackLoading(true);
    setSlackStatus('');
    try {
      const days = getSelectedDays();
      const startDate = days[0]?.label || startDay;
      const endDate   = days[days.length - 1]?.label || endDay;
      const text = buildSlackText(aiReport, startDate, endDate, report);
      const res = await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.ok) setSlackStatus('✅ Slack 발송 완료');
      else throw new Error(data.error || '발송 실패');
    } catch (e) {
      setSlackStatus('❌ ' + e.message);
    } finally {
      setSlackLoading(false);
    }
  }

  function buildSlackText(r, startDate, endDate, rawData) {
    const s = r.summary;
    let text = `*📋 PBB CS 리포트 (${startDate} ~ ${endDate})*\n\n`;
    text += `■ 총 CS 인입: ${s.total}\n`;
    text += `: ${s.overview}\n\n`;
    text += `■ 주요 이슈\n`;
    (s.main_issues || []).forEach(i => { text += `: ${i}\n`; });
    text += `\n■ 언어별 현황\n`;
    (s.language_overview || []).forEach(l => { text += `: ${l}\n`; });
    return text;
  }

  const days = getSelectedDays();
  const startLabel = days[0]?.label || '';
  const endLabel   = days[days.length - 1]?.label || '';

  // 언어 차트 데이터
  const langEntries = Object.entries(report?.language || {}).sort((a, b) => b[1] - a[1]);
  const langTotal   = langEntries.reduce((s, [, v]) => s + v, 0) || 1;

  // 도넛 차트 SVG
  function DonutChart({ data, total }) {
    const size = 120;
    const r = 40;
    const cx = size / 2, cy = size / 2;
    let offset = 0;
    const circumference = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map(([key, val], i) => {
          const pct = val / total;
          const dash = pct * circumference;
          const gap  = circumference - dash;
          const el = (
            <circle
              key={key}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={LANG_COLORS[i] || '#ccc'}
              strokeWidth={20}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circumference}
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          );
          offset += pct;
          return el;
        })}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#333">{total}건</text>
      </svg>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* 기간 설정 + 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#444' }}>기간 설정</span>

        <select
          value={startDay}
          onChange={e => setStartDay(e.target.value)}
          style={selectStyle}>
          {ALPHA_DATES.map(({ day, label }) => (
            <option key={day} value={day}>{day} · {label}</option>
          ))}
        </select>

        <span style={{ color: '#888' }}>—</span>

        <select
          value={endDay}
          onChange={e => setEndDay(e.target.value)}
          style={selectStyle}>
          {ALPHA_DATES.map(({ day, label }) => (
            <option key={day} value={day}>{day} · {label}</option>
          ))}
        </select>

        <button onClick={generateReport} disabled={loading || aiLoading} style={btnPrimary}>
          {loading || aiLoading ? '생성 중...' : '리포트 생성'}
        </button>

        <button onClick={savePDF} disabled={!aiReport} style={btnGray}>
          📄 PDF 저장
        </button>

        <button onClick={sendSlack} disabled={!aiReport || slackLoading} style={btnSlack}>
          {slackLoading ? '발송 중...' : '🔔 Slack 발송'}
        </button>

        {slackStatus && (
          <span style={{ fontSize: '13px', color: slackStatus.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
            {slackStatus}
          </span>
        )}
      </div>

      {/* 리포트 본문 */}
      {aiReport && report && (() => {
        const r = aiReport;
        const s = r.summary;
        return (
          <div id="report-content">

            {/* 제목 */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700' }}>PBB CS Report</h2>
              <div style={{ color: '#888', fontSize: '14px' }}>{startLabel} ~ {endLabel}</div>
              <hr style={{ marginTop: '16px', borderColor: '#e0e0e0' }} />
            </div>

            {/* 1. Summary */}
            <Section title="1. Summary">
              <div style={{ background: '#fafafa', borderRadius: '8px', padding: '16px 20px', fontSize: '14px', lineHeight: '2' }}>
                <p>
                  <b>■ 기간 총 CS 인입 건수: {s.total}</b><br />
                  <span style={{ color: '#555' }}>: {s.overview}</span>
                </p>
                <p>
                  <b>■ 주요 이슈</b><br />
                  {(s.main_issues || []).map((item, i) => (
                    <span key={i} style={{ display: 'block', color: '#555' }}>: {item}</span>
                  ))}
                </p>
                <p style={{ marginBottom: 0 }}>
                  <b>■ 언어별 문의 현황</b><br />
                  {(s.language_overview || []).map((item, i) => (
                    <span key={i} style={{ display: 'block', color: '#555' }}>: {item}</span>
                  ))}
                </p>
              </div>
            </Section>

            {/* 2. Ticket Trend */}
            <Section title="2. Ticket Trend">
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['날짜', '건수', 'DoD', '주요 이슈'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(r.ticket_trend || []).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={tdStyle}>{row.date}</td>
                      <td style={tdStyle}>{row.total}건</td>
                      <td style={{ ...tdStyle, color: row.dod > 0 ? '#c62828' : row.dod < 0 ? '#1565c0' : '#888', fontWeight: '600' }}>
                        {row.dod > 0 ? `+${row.dod}` : row.dod < 0 ? `${row.dod}` : '-'}
                      </td>
                      <td style={tdStyle}>{row.main_issue || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* 3. CS Trend by Language */}
            <Section title="3. CS Trend by Language">
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        {['언어', '건수', '주요 이슈'].map(h => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(r.language_trend || []).map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={tdStyle}>{row.lang}</td>
                          <td style={tdStyle}>{row.count}건</td>
                          <td style={tdStyle}>{row.main_issue || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <DonutChart data={langEntries} total={langTotal} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                    {langEntries.map(([k, v], i) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: LANG_COLORS[i] || '#ccc' }} />
                        <span>{LANG_NAMES[k] || k} ({Math.round(v / langTotal * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* 4. CS Trend by Main Issues */}
            <Section title="4. CS Trend by Main Issues">
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['Ticket', 'Type', 'Ticket Description', 'Sentiment', 'Volume'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(r.main_issues || []).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ ...tdStyle, color: '#1565c0', cursor: 'pointer' }}
                          onClick={() => row.ticket_id && window.open(`https://pubgsupport.zendesk.com/agent/tickets/${row.ticket_id}`, '_blank')}>
                        {row.ticket_id ? `#${row.ticket_id}` : '-'}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          background: CATEGORY_COLORS[row.type] ? CATEGORY_COLORS[row.type] + '18' : '#f0f0f0',
                          color: CATEGORY_COLORS[row.type] || '#333',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}>{row.type || '-'}</span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: '320px' }}>{row.description || '-'}</td>
                      <td style={{ ...tdStyle, color: row.sentiment === '부정' ? '#c62828' : row.sentiment === '긍정' ? '#2e7d32' : '#888' }}>
                        {row.sentiment || '-'}
                      </td>
                      <td style={tdStyle}>1</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

          </div>
        );
      })()}

      {(loading || aiLoading) && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
          {loading ? '데이터 수집 중...' : 'AI 리포트 생성 중...'}
        </div>
      )}

      {!aiReport && !loading && !aiLoading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#bbb', fontSize: '14px' }}>
          기간을 설정하고 리포트 생성 버튼을 눌러주세요
        </div>
      )}

    </div>
  );
}

// 섹션 컴포넌트
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{
        background: '#1a1a2e', color: '#fff',
        padding: '10px 16px', borderRadius: '6px',
        fontSize: '15px', fontWeight: '600', marginBottom: '16px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// 공통 스타일
const selectStyle = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1.5px solid #e0e0e0',
  fontSize: '13px',
  background: '#fff',
  cursor: 'pointer',
};
const btnPrimary = {
  padding: '9px 20px',
  background: '#1a1a2e',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
};
const btnGray = {
  padding: '9px 20px',
  background: '#555',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
};
const btnSlack = {
  padding: '9px 20px',
  background: '#f0a500',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
};
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  overflow: 'hidden',
};
const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '13px',
  borderBottom: '1px solid #e0e0e0',
};
const tdStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'top',
};
