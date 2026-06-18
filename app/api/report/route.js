import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORY_COLORS = {
  'Gameplay Related': '#1565c0',
  'Installation Issues': '#e65100',
  'Bug Report': '#b71c1c',
  'Ban': '#6a1b9a',
  'Report': '#1b5e20',
  'Others': '#424242',
};

export async function POST(request) {
  try {
    const { startDate, endDate, tickets, trend, language, category } = await request.json();

    const total = tickets?.length || 0;

    // 카테고리 분포
    const catText = Object.entries(category || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}건`)
      .join(', ');

    // 언어별 분포
    const langMap = { ko: '한국어', en: '영어', zh: '중국어', other: '기타' };
    const langText = Object.entries(language || {})
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${langMap[k] || k}: ${v}건`)
      .join(', ');

    // 티켓 목록 (최대 50건)
    const ticketList = (tickets || []).slice(0, 50).map((t, i) =>
      `${i + 1}. [${t.category || '없음'}] [${t.language || ''}] ${t.summary || t.subject || '(요약 없음)'}`
    ).join('\n');

    // Ticket Trend 텍스트
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
티켓 목록 (최대 50건):
${ticketList}

아래 JSON 형식으로만 응답해주세요. 마크다운 코드블록 없이 순수 JSON만:

{
  "summary": {
    "total": "${total}건",
    "overview": "전체적인 문의 특징 1~2줄",
    "main_issues": [
      "주요 이슈 유형과 건수 (예: 설치/실행 오류 4건 - 상세 설명)",
      "두 번째 주요 이슈",
      "세 번째 주요 이슈"
    ],
    "language_overview": [
      "한국어 X건 - 주요 문의 유형",
      "영어 X건 - 주요 문의 유형"
    ]
  },
  "ticket_trend": [
    ${(trend || []).map(({ day, date, total }) =>
      `{"day": "${day}", "date": "${date}", "total": ${total}, "dod": 0, "main_issue": "-"}`
    ).join(',\n    ')}
  ],
  "language_trend": [
    ${Object.entries(language || {}).map(([k, v]) =>
      `{"lang": "${langMap[k] || k}", "count": ${v}, "main_issue": "-"}`
    ).join(',\n    ')}
  ],
  "main_issues": [
    ${(tickets || []).slice(0, 10).map(t =>
      `{"ticket_id": "${t.ticket_id || ''}", "type": "${t.category || ''}", "description": "${(t.summary || t.subject || '').replace(/"/g, "'")}", "sentiment": "중립"}`
    ).join(',\n    ')}
  ]
}

ticket_trend의 dod는 전날 대비 증감 건수(숫자), main_issue는 해당 날의 주요 문의 유형 한 줄로 채워주세요.
language_trend의 main_issue도 해당 언어의 주요 문의 유형으로 채워주세요.
main_issues의 sentiment는 티켓 내용 기반으로 긍정/중립/부정 중 하나로 판단해주세요.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
