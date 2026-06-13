'use client';
import { useState } from 'react';
import MonitoringTab from './components/MonitoringTab';
import ReportTab from './components/ReportTab';

export default function Home() {
  const [activeTab, setActiveTab] = useState('monitoring');

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* 헤더 */}
      <div style={{ background: '#1a1a2e', color: '#fff', padding: '0 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🎮</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>PBB CS Dashboard</div>
              <div style={{ fontSize: '11px', opacity: 0.6 }}>Alpha Test · 2026.06.26 ~ 06.29</div>
            </div>
          </div>
          <div style={{ fontSize: '12px', opacity: 0.6 }}>
            KRAFTON Player Support
          </div>
        </div>

        {/* 탭 */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '4px' }}>
          {[
            { key: 'monitoring', label: '📡 실시간 모니터링' },
            { key: 'report', label: '📋 CS 리포트' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)',
                borderBottom: activeTab === tab.key ? '3px solid #fff' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === tab.key ? '600' : '400',
                transition: 'all 0.2s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div>
        {activeTab === 'monitoring' && <MonitoringTab />}
        {activeTab === 'report' && <ReportTab />}
      </div>
    </div>
  );
}