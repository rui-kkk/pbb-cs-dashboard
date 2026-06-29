import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { startDate, endDate, tickets, trend, language, category } = await request.json();
    const total = tickets?.length || 0;

    const catText = Object.entries(category || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}건`)
      .join(', ');

    const langMap = { ko: '한국어', en: '영어', zh: '중국어', other: '기타' };
    const langText = Object.entries(language || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${langMap[k] || k}: ${v}건`)
      .join(', ');

    const ticketList = (tickets || []).slice(0, 30).map((t, i) =>
      `${i + 1}. [${t.category || '없음'}] [${t.language || ''}] ${(t.summary || t.subject || '(요약 없음)').substring(0, 80)}`
    ).join('\n');

    const trendText = (trend || [])
      .map(({ day, date, total }) => `${day}(${date}): ${total}건`)
      .join(', ');

    const prompt = `당신은 PBB(PUBG: Black Budget) 알파 테스트 CS 분석 전문가입니다.
아래 데이터를 바탕으로 기간별 CS 종합 리포트를 작성해주세요.

기간: ${startDate} ~ ${endDate}
총 접수 건수: ${total}건
카테고리 분포: ${catText}
언어별 현황: ${langText}
일별 추이: ${trendText}
티켓 목록 (최대 30건):
${ticketList}

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 없이 순수 JSON만 출력하세요.

{
  "summary": {
    "total": "${total}건",
    "overview": "전체적인 문의 특징 1~2줄",
    "main_issues": ["주요 이슈1", "주요 이슈2", "주요 이슈3"],
    "language_overview": ["한국어 현황", "영어 현황"]
  },
  "ticket_trend": [
    ${(trend || []).map(({ day, date, total: t }, i, arr) => {
      const prev = i > 0 ? arr[i-1].total : 0;
      return `{"day": "${day}", "date": "${date}", "total": ${t}, "dod": ${i === 0 ? 0 : t - prev}, "main_issue": "-"}`;
    }).join(',\n    ')}
  ],
  "language_trend": [
    ${Object.entries(language || {}).map(([k, v]) =>
      `{"lang": "${langMap[k] || k}", "count": ${v}, "main_issue": "-"}`
    ).join(',\n    ')}
  ],
  "main_issues": [
    ${(tickets || []).slice(0, 10).map(t =>
      `{"ticket_id": "${t.ticket_id || ''}", "type": "${(t.category || '').replace(/"/g, "'")}", "description": "${(t.summary || t.subject || '').replace(/["\n\r\t]/g, ' ').substring(0, 100)}", "sentiment": "중립"}`
    ).join(',\n    ')}
  ]
}

ticket_trend의 dod는 전날 대비 증감 건수로 채워주세요.
language_trend와 main_issues의 main_issue, sentiment도 데이터 기반으로 채워주세요.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = message.content[0].text.trim();

    // 마크다운 코드블록 제거
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    // JSON 시작/끝 위치 찾기
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('AI 응답에서 JSON을 찾을 수 없습니다: ' + raw.substring(0, 200));
    }
    raw = raw.substring(start, end + 1);

    let result;
    try {
      result = JSON.parse(raw);
    } catch (parseError) {
      // JSON 파싱 실패 시 기본 구조 반환
      result = {
        summary: {
          total: `${total}건`,
          overview: 'AI 분석 중 오류가 발생했습니다. 데이터를 확인해 주세요.',
          main_issues: [catText || '데이터 없음'],
          language_overview: [langText || '데이터 없음'],
        },
        ticket_trend: (trend || []).map(({ day, date, total: t }, i, arr) => ({
          day, date, total: t,
          dod: i === 0 ? 0 : t - arr[i-1].total,
          main_issue: '-',
        })),
        language_trend: Object.entries(language || {}).map(([k, v]) => ({
          lang: langMap[k] || k, count: v, main_issue: '-',
        })),
        main_issues: (tickets || []).slice(0, 10).map(t => ({
          ticket_id: t.ticket_id || '',
          type: t.category || '',
          description: (t.summary || t.subject || '').substring(0, 100),
          sentiment: '중립',
        })),
      };
    }

    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
