import { DeepResearchResult } from './research';

export type PitchAngle =
  | 'local_search'
  | 'mobile_speed'
  | 'free_mockup'
  | 'ai_automation'
  | 'data_science_training';

export interface EmailPitch {
  subject: string;
  body: string;
  modelUsed: string;
  pitchAngle: PitchAngle;
  alternativeSubjects: string[];
}

export interface PitchContext {
  businessName: string;
  category: string;
  city: string;
  research: DeepResearchResult;
  offerService?: string;
  senderName?: string;
  senderEmail?: string;
  senderBusiness?: string;
  pitchAngle?: PitchAngle | 'auto';
}

const DEFAULT_SIGNATURE = (name = 'Muhammad Shoaib', email = 'Mshoaibawan371@gmail.com') => `Best,

${name}
AI Developer & Automation Architect | Huawei Certified Cloud Developer
LLMs & Python | Data Science Trainer
${email}`;

/**
 * 1. Generate pitch via Anthropic Claude API
 */
async function generateWithAnthropic(
  apiKey: string,
  ctx: PitchContext
): Promise<EmailPitch | null> {
  const chosenAngle = ctx.pitchAngle && ctx.pitchAngle !== 'auto' ? ctx.pitchAngle : 'ai_automation';
  const prompt = `You are an elite B2B outreach specialist writing a cold email to a business leader.
Business Name: ${ctx.businessName}
Niche: ${ctx.category}
Location: ${ctx.city}
Angle: ${chosenAngle}
Key Research Observations:
${ctx.research.growth_signals.observations.join('\n')}

Sender Profile:
Name: ${ctx.senderName || 'Muhammad Shoaib'}
Email: ${ctx.senderEmail || 'Mshoaibawan371@gmail.com'}
Specialization: AI Developer & Automation Architect | Huawei Certified Cloud Developer | LLMs & Python | Data Science Trainer
Offer: ${ctx.offerService || 'AI Automation, Custom LLM Workflows, Cloud Architecture & High-Converting Digital Infrastructure'}

Strict Requirements:
1. Mention the actual business name and at least one factual research observation.
2. If Angle is 'ai_automation': Highlight automating repetitive manual workflows (client intake, lead qualification, data pipelines) using custom AI agents, LLMs, and Python.
3. If Angle is 'data_science_training': Highlight hands-on training/upskilling in Data Science, Machine Learning, Python, and Cloud Architecture for cohorts/teams.
4. If Angle is 'mobile_speed': Highlight mobile conversion, instant estimate/quote booking, and speed optimization.
5. If Angle is 'free_mockup' or 'local_search': Highlight building a clean digital presence and automated online client booking.
6. Be concise (under 130 words), natural, polite, and direct.
7. NO fake flattery or generic clichés ("I hope this email finds you well", "In today's fast-paced world").
8. Include a clear, low-pressure permission-based call to action (offering to share a quick preview or outline).
9. NEVER include any opt-out text or lines like "reply no thanks" or "if not interested reply no thanks".
10. Sign off with:
Best,

Muhammad Shoaib
AI Developer & Automation Architect | Huawei Certified Cloud Developer
LLMs & Python | Data Science Trainer
${ctx.senderEmail || 'Mshoaibawan371@gmail.com'}

Provide output strictly in JSON format: {"subject": "...", "body": "...", "alternativeSubjects": ["...", "..."]}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const content = data.content?.[0]?.text || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject,
          body: parsed.body,
          modelUsed: 'Anthropic Claude 3.5 Sonnet',
          pitchAngle: chosenAngle,
          alternativeSubjects: Array.isArray(parsed.alternativeSubjects) ? parsed.alternativeSubjects : [],
        };
      }
    }
  } catch (e) {
    console.warn('Anthropic API call failed:', e);
  }
  return null;
}

/**
 * 2. Generate pitch via Google Gemini API
 */
async function generateWithGemini(
  apiKey: string,
  ctx: PitchContext
): Promise<EmailPitch | null> {
  const chosenAngle = ctx.pitchAngle && ctx.pitchAngle !== 'auto' ? ctx.pitchAngle : 'ai_automation';
  const prompt = `Write a personalized, concise B2B email to a business leader:
Business: ${ctx.businessName} (${ctx.category} in ${ctx.city})
Verified observations: ${ctx.research.growth_signals.observations.join(', ')}
Sender: ${ctx.senderName || 'Muhammad Shoaib'} (${ctx.senderEmail || 'Mshoaibawan371@gmail.com'})
Title: AI Developer & Automation Architect | Huawei Certified Cloud Developer | LLMs & Python | Data Science Trainer
Offer: ${ctx.offerService || 'AI Automation, Cloud Infrastructure & Digital Systems'}
Angle: ${chosenAngle}

Rules:
- Mention business name and a factual observation.
- Under 130 words, direct and conversational.
- Low-pressure permission-based call to action.
- Do NOT include any opt-out line or "reply no thanks".
- Sign off with sender's full professional title and email.
Return strictly JSON: {"subject": "...", "body": "...", "alternativeSubjects": ["...", "..."]}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject,
          body: parsed.body,
          modelUsed: 'Google Gemini 1.5 Flash',
          pitchAngle: chosenAngle,
          alternativeSubjects: Array.isArray(parsed.alternativeSubjects) ? parsed.alternativeSubjects : [],
        };
      }
    }
  } catch (e) {
    console.warn('Gemini API call failed:', e);
  }
  return null;
}

/**
 * 3. Intelligent Heuristic Generator Backed by Professional AI & Engineering Profile
 */
export function generateHeuristicPitch(ctx: PitchContext): EmailPitch {
  const name = ctx.businessName.trim();
  let rawCategory = (ctx.category || 'local services').toLowerCase().replace(/_/g, ' ');
  if (rawCategory === 'business' || rawCategory === 'local business' || !rawCategory.trim()) {
    rawCategory = 'local services';
  }
  const category = rawCategory;
  const city = ctx.city.split(',')[0].trim();
  const senderName = ctx.senderName || 'Muhammad Shoaib';
  const senderEmail = ctx.senderEmail || 'Mshoaibawan371@gmail.com';
  const sig = DEFAULT_SIGNATURE(senderName, senderEmail);

  let angle = ctx.pitchAngle;
  if (!angle || angle === 'auto') {
    const catLower = category.toLowerCase();
    if (
      catLower.includes('training') ||
      catLower.includes('bootcamp') ||
      catLower.includes('academy') ||
      catLower.includes('institute') ||
      catLower.includes('college')
    ) {
      angle = 'data_science_training';
    } else if (
      catLower.includes('ai') ||
      catLower.includes('software') ||
      catLower.includes('saas') ||
      catLower.includes('tech') ||
      catLower.includes('automation') ||
      catLower.includes('agency') ||
      catLower.includes('consult') ||
      catLower.includes('logistics') ||
      catLower.includes('fintech')
    ) {
      angle = 'ai_automation';
    } else if (ctx.research.growth_signals.observations.some(o => o.includes('phone') || o.includes('feedback') || o.includes('rating'))) {
      angle = 'mobile_speed';
    } else {
      angle = 'free_mockup';
    }
  }

  let subject = '';
  let alternativeSubjects: string[] = [];
  let body = '';

  if (angle === 'ai_automation') {
    subject = `${name} — AI & Workflow Automation question`;
    alternativeSubjects = [
      `Automating workflows for ${name}`,
      `Quick question for ${name} team`,
      `Idea regarding ${name} operational automation`,
    ];
    body = `Hi ${name} team,

I came across ${name} while looking at established ${category} providers in ${city}.

As an AI Developer & Automation Architect specializing in LLMs, Python, and Cloud integrations (Huawei Certified Cloud Developer), I help teams eliminate repetitive manual admin work by deploying custom AI agents and end-to-end automated pipelines (lead enrichment, client intake, and data processing).

Given your active operations in ${city}, I put together a quick workflow automation blueprint showing where AI agents can save your team 10-15+ hours weekly.

Can I shoot the outline over? No catch or sales pressure at all, just thought it might be useful for your team.

${sig}`;
  } else if (angle === 'data_science_training') {
    subject = `${name} — Data Science & AI Curriculum / Training`;
    alternativeSubjects = [
      `Data Science & LLM Training for ${name}`,
      `Quick question regarding ${name} technical training`,
      `AI & Python curriculum collaboration for ${name}`,
    ];
    body = `Hi ${name} team,

I came across ${name} while looking at leading training and educational institutions in ${city}.

I am a Data Science Trainer and Huawei Certified Cloud Developer specializing in Python, Large Language Models (LLMs), and Applied AI. I help bootcamps, institutes, and corporate teams deliver hands-on, industry-ready training programs in Data Science, Machine Learning, and Cloud Architecture.

Would your team be open to exploring guest training or collaborating on practical AI/Data Science tracks for your upcoming cohorts? I would be glad to share our curriculum syllabus and past project outlines.

${sig}`;
  } else if (angle === 'mobile_speed') {
    subject = `${name} — quick question`;
    alternativeSubjects = [
      `Quick question regarding ${name}`,
      `Idea for ${name} (${city})`,
      `${name} customer inquiries`,
    ];
    body = `Hi ${name} team,

I came across ${name} earlier today while looking at established ${category} providers in ${city}.

You clearly have great customer feedback and strong local trust, but I noticed a couple of friction points on mobile—specifically page load speed and how prospective clients request an estimate or booking. Most people searching on smartphones prefer requesting a quote online rather than calling, and bounce if they can't book or get a quick estimate in two clicks.

I put together a clean 1-page mobile redesign concept for ${name} with an instant estimate form to show how you can capture more booked inquiries from your traffic.

Can I shoot the preview link over? No catch or sales pressure at all, just thought it might be useful for your team.

${sig}`;
  } else {
    // Default: 'free_mockup' / 'local_search'
    angle = 'free_mockup';
    subject = `Website concept for ${name}`;
    alternativeSubjects = [
      `Quick preview draft for ${name}`,
      `${name} — quick question`,
      `Idea for ${name} in ${city}`,
    ];
    body = `Hi ${name} team,

I came across your profile while looking up established ${category} providers in ${city}. You clearly have a strong local reputation, but I noticed there is currently no active website linked to your business listing.

When local clients search for ${category} on their phones, over 80% choose whichever provider allows them to view services or submit an instant estimate request directly online.

I actually put together a clean 1-page design preview specifically for ${name} to show how you can capture those search inquiries with an instant quote form.

Can I send the preview link over? No catch or sales pressure at all—just thought it would be a useful asset for your team.

${sig}`;
  }

  return {
    subject,
    body,
    modelUsed: 'High-Converting B2B Pitch Engine (Permission & Value First)',
    pitchAngle: angle,
    alternativeSubjects,
  };
}

/**
 * Master Personalized Pitch Generator
 */
export async function generatePersonalizedPitch(ctx: PitchContext): Promise<EmailPitch> {
  // 1. Try Anthropic Claude if key configured
  if (process.env.ANTHROPIC_API_KEY) {
    const claudeResult = await generateWithAnthropic(process.env.ANTHROPIC_API_KEY, ctx);
    if (claudeResult) return claudeResult;
  }

  // 2. Try Gemini if key configured
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    const geminiResult = await generateWithGemini(geminiKey, ctx);
    if (geminiResult) return geminiResult;
  }

  // 3. Heuristic bespoke fallback
  return generateHeuristicPitch(ctx);
}
