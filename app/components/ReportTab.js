'use client';
import { useState, useEffect } from 'react';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

const DAY_LABELS = [
  { label: 'D1', date: '6/26 (금)' },
  { label: 'D2', date: '6/27 (토)' },
  { label: 'D3', date: '6/28 (일)' },
  { label: 'D4', date: '6/29 (월)' },
];

const CATEGORY_COLORS = {
  'Gameplay Related':   '#1565c0',
  'Installation Issues':'#e65100',
  'Bug Report':         '#b71c1c',
  'Ban':                '#6a1b9a',
  'Others':             '#424242',
};

const LANG_NAMES = { ko: '🇰🇷 한국어', en: '🇺🇸 영어', zh: '🇨🇳 중국어', other: '기타' };

export default function ReportTab() {
  const [selectedDay, setSelectedDay] = useState('D1');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchReport(selectedDay);
  }, [selectedDay]);

  async function fetchReport(day) {
    setLoading(true);
    setAiReport('');
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=report&day=${day}`);
      const data = await res.json();
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function runAiReport() {
    if (!report) return;
    setAiLoading(true);
    setAiReport('');
    try {
      const catText = Object.entries(report.category || {})
        .map(([k, v]) => `${k}: ${v}건`).join(', ');
      const langText = Object.entries(report.language || {})
        .map(([k, v]) => `${LANG_NAMES[k]}: ${v}건`).join(', ');
      const recentText = (report.recent_tickets || [])
        .map(t => `- [${t.category}] ${t.summary || t.subject}`).join('\n');

      const prompt = `PBB 게임 알파 테스트 ${report.day} CS 일간 리포트를 작성해줘.

총 접수: ${report.total}건
문의 유형: ${catText}
언어별: ${langText}
최근 티켓 요약:
${recentText}

형식:
1. 오늘의 CS 동향 (2~3줄)
2. 주요 이슈 Top 3
3. 내일 모니터링 포인트

한국어로, 이모지 포함해서 작성해줘.`;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setAiReport(data.result);
    } catch (e) {
      setAiReport('리포트 생성 실패');
    } finally {
      setAiLoading(false);
    }
  }

  async function downloadExcel() {
    if (!report) return;
    try {
      const XLSX = await import('xlsx');
      const rows = (report.recent_tickets || []).map(t => ({
        'Ticket ID': t.ticket_id,
        '접수 시간': t.created_at,
        '제목': t.subject,
        '카테고리': t.category,
        '언어': t.language,
        'AI 요약': t.summary,
        '키워드': t.keywords,
        '상태': t.status,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, report.day);
      XLSX.writeFile(wb, `PBB_CS_${report.day}_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      alert('다운로드 실패: ' + e.message);
    }
  }

  const categories = ['Gameplay Related', 'Installation Issues', 'Bug Report', 'Ban', 'Others'];
  const totalCat = Object.values(report?.category || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* 날짜 선택 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {DAY_LABELS.map(({ label, date }) => (
          <button
            key={label}
            onClick={() => setSelectedDay(label)}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              border: selectedDay === label ? '2px solid #1a1a2e' : '2px solid #e0e0e0',
              background: selectedDay === label ? '#1a1a2e' : '#fff',
              color: selectedDay === label ? '#fff' : '#333',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
            }}>
            <div>{label}</div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{date}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>데이터 불러오는 중...</div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: `${selectedDay} 총 접수`, value: report?.total || 0, unit: '건' },
              { label: '가장 많은 유형', value: Object.entries(report?.category || {}).sort((a,b)=>b[1]-a[1])[0]?.[0]?.split(' ')[0] || '-', unit: '' },
              { label: '가장 많은 언어', value: LANG_NAMES[Object.entries(report?.language || {}).sort((a,b)=>b[1]-a[1])[0]?.[0]] || '-', unit: '' },
            ].map((kpi, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderTop: '4px solid #1a1a2e' }}>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>{kpi.label}</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1a1a2e' }}>{kpi.value}<span style={{ fontSize: '14px', marginLeft: '4px' }}>{kpi.unit}</span></div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

            {/* 카테고리별 */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>📊 문의 유형별</h3>
              {categories.map(cat => {
                const count = report?.category?.[cat] || 0;
                const pct = Math.round((count / totalCat) * 100);
                const color = CATEGORY_COLORS[cat];
                return (
                  <div key={cat} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color }}>{cat}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{count}건 ({pct}%)</span>
                    </div>
                    <div style={{ background: '#f0f0f0', borderRadius: '4px', height: '8px' }}>
                      <div style={{ width: `${pct}%`, background: color, borderRadius: '4px', height: '8px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 누적 추이 */}
            <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>📈 일별 누적 추이</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '140px', padding: '0 8px' }}>
                {(report?.trend || []).map(({ day, total }) => {
                  const maxTotal = Math.max(...(report?.trend || []).map(t => t.total)) || 1;
                  const height = Math.max((total / maxTotal) * 100, total > 0 ? 8 : 4);
                  const isSelected = day === selectedDay;
                  return (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: isSelected ? '#1a1a2e' : '#999' }}>{total > 0 ? total : ''}</div>
                      <div style={{ width: '100%', height: `${height}%`, background: isSelected ? '#1a1a2e' : '#ccc', borderRadius: '6px 6px 0 0', transition: 'height 0.5s' }} />
                      <div style={{ fontSize: '12px', fontWeight: isSelected ? '700' : '400', color: isSelected ? '#1a1a2e' : '#999' }}>{day}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI 일간 리포트 */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>🤖 AI 일간 리포트</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={runAiReport}
                  disabled={aiLoading}
                  style={{ padding: '8px 18px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: aiLoading ? 0.7 : 1 }}>
                  {aiLoading ? '생성 중...' : `${selectedDay} 리포트 생성`}
                </button>
                <button
                  onClick={downloadExcel}
                  style={{ padding: '8px 18px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  📥 Excel 다운로드
                </button>
              </div>
            </div>
            {aiReport
              ? <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{aiReport}</div>
              : <div style={{ color: '#aaa', fontSize: '14px' }}>버튼을 눌러 AI 리포트를 생성하세요</div>
            }
          </div>
        </>
      )}
    </div>
  );
}