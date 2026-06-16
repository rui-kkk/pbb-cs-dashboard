'use client';
import { useState, useEffect } from 'react';

const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

const CATEGORY_COLORS = {
  'Gameplay Related':   { bg: '#e3f2fd', color: '#1565c0', border: '#1565c0' },
  'Installation Issues':{ bg: '#fff3e0', color: '#e65100', border: '#e65100' },
  'Bug Report':         { bg: '#fce4ec', color: '#b71c1c', border: '#b71c1c' },
  'Ban':                { bg: '#f3e5f5', color: '#6a1b9a', border: '#6a1b9a' },
  'Others':             { bg: '#f5f5f5', color: '#424242', border: '#424242' },
  'Report':             { bg: '#e8f5e9', color: '#1b5e20', border: '#1b5e20' },
};

const LANG_NAMES = { ko: '🇰🇷 한국어', en: '🇺🇸 영어', zh: '🇨🇳 중국어', other: '기타' };

export default function MonitoringTab() {
  const [dashboard, setDashboard] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [keywords, setKeywords] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAll() {
    try {
      const [dashRes, hourlyRes, kwRes] = await Promise.all([
        fetch(`${APPS_SCRIPT_URL}?action=dashboard`),
        fetch(`${APPS_SCRIPT_URL}?action=hourly`),
        fetch(`${APPS_SCRIPT_URL}?action=keywords`),
      ]);
      const [dashData, hourlyData, kwData] = await Promise.all([
        dashRes.json(), hourlyRes.json(), kwRes.json(),
      ]);
      setDashboard(dashData);
      setHourly(hourlyData);
      setKeywords(kwData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function runAiSummary() {
    if (!dashboard) return;
    setAiLoading(true);
    setAiSummary('');
    try {
      const { today } = dashboard;
      const catText = Object.entries(today.category)
        .map(([k, v]) => `${k}: ${v}건`).join(', ');
      const langText = Object.entries(today.language)
        .map(([k, v]) => `${LANG_NAMES[k]}: ${v}건`).join(', ');

      const prompt = `PBB 게임 알파 테스트 CS 현황을 슬랙 공유용으로 3줄 이내로 요약해줘.

오늘(${today.label}) 총 접수: ${today.total}건
전일 대비: ${today.vs_yesterday > 0 ? '+' : ''}${today.vs_yesterday}건
미처리: ${today.pending}건
문의 유형: ${catText}
언어별: ${langText}

형식: 이모지 포함, 핵심만, 한국어로`;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setAiSummary(data.result);
    } catch (e) {
      setAiSummary('요약 생성 실패');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
      데이터 불러오는 중...
    </div>
  );

  const today = dashboard?.today || {};
  const categories = ['Gameplay Related', 'Installation Issues', 'Bug Report', 'Ban', 'Report', 'Others'];
  const totalCat = Object.values(today.category || {}).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* KPI 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: '오늘 총 접수', value: today.total || 0, unit: '건', color: '#1a1a2e' },
          { label: '전일 대비', value: `${today.vs_yesterday > 0 ? '+' : ''}${today.vs_yesterday || 0}`, unit: '건', color: today.vs_yesterday > 0 ? '#c62828' : '#2e7d32' },
          { label: '미처리', value: today.pending || 0, unit: '건', color: '#e65100' },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderTop: `4px solid ${kpi.color}` }}>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>{kpi.label}</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: kpi.color }}>{kpi.value}<span style={{ fontSize: '16px', marginLeft: '4px' }}>{kpi.unit}</span></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* 문의 유형별 */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>📊 문의 유형별 현황</h3>
          {categories.map(cat => {
            const count = today.category?.[cat] || 0;
            const pct = Math.round((count / totalCat) * 100);
            const c = CATEGORY_COLORS[cat];
            return (
              <div key={cat} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '4px', background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{cat}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{count}건 ({pct}%)</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: '4px', height: '8px' }}>
                  <div style={{ width: `${pct}%`, background: c.color, borderRadius: '4px', height: '8px', transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 언어별 현황 */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>🌍 언어별 현황</h3>
          {Object.entries(today.language || {}).map(([lang, count]) => {
            const total = Object.values(today.language || {}).reduce((a, b) => a + b, 0) || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={lang} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{LANG_NAMES[lang] || lang}</span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{count}건 ({pct}%)</span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: '4px', height: '8px' }}>
                  <div style={{ width: `${pct}%`, background: '#1a1a2e', borderRadius: '4px', height: '8px', transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 시간대별 차트 */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>⏰ 시간대별 접수량</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
          {(hourly?.hourly || Array(24).fill(0)).map((count, hour) => {
            const max = Math.max(...(hourly?.hourly || [1])) || 1;
            const height = Math.max((count / max) * 100, count > 0 ? 8 : 2);
            const isActive = hour >= 9 && hour <= 18;
            return (
              <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ fontSize: '10px', color: '#999' }}>{count > 0 ? count : ''}</div>
                <div style={{ width: '100%', height: `${height}%`, background: isActive ? '#1a1a2e' : '#ccc', borderRadius: '3px 3px 0 0', transition: 'height 0.5s' }} title={`${hour}시: ${count}건`} />
                <div style={{ fontSize: '9px', color: '#aaa' }}>{hour % 3 === 0 ? `${hour}시` : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 키워드 */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600' }}>🔑 오늘 주요 키워드</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(keywords?.keywords || []).length === 0
            ? <span style={{ color: '#aaa', fontSize: '14px' }}>키워드 없음</span>
            : keywords.keywords.map(({ keyword, count }, i) => (
              <span key={i} style={{ padding: '6px 14px', borderRadius: '20px', background: '#e8eaf6', color: '#3949ab', fontSize: '13px', fontWeight: '500' }}>
                {keyword} <strong>{count}</strong>
              </span>
            ))
          }
        </div>
      </div>

      {/* AI 현황 요약 */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>🤖 AI 현황 요약</h3>
          <button
            onClick={runAiSummary}
            disabled={aiLoading}
            style={{ padding: '8px 18px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: aiLoading ? 0.7 : 1 }}>
            {aiLoading ? '생성 중...' : '슬랙용 요약 생성'}
          </button>
        </div>
        {aiSummary
          ? <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '16px', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{aiSummary}</div>
          : <div style={{ color: '#aaa', fontSize: '14px' }}>버튼을 눌러 AI 요약을 생성하세요</div>
        }
      </div>
    </div>
  );
}
