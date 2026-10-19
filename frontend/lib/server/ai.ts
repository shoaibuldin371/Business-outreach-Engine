import { DeepResearchResult } from './research';

export interface EmailPitch {
  subject: string;
  body: string;
  modelUsed: string;
}

interface PitchContext {
  businessName: string;
  category: string;
  city: string;
  research: DeepResearchResult;
  offerService?: string;
  senderName?: string;
  senderEmail?: string;
  senderBusiness?: string;
}

/**
 * 1. Generate pitch via Anthropic Claude API
 */
async function generateWithAnthropic(
  apiKey: string,
  ctx: PitchContext
): Promise<EmailPitch | null> {
  const prompt = `You are an executive B2B outreach specialist writing a cold email to a local business owner.
Business Name: ${ctx.businessName}
Niche: ${ctx.category}
Location: ${ctx.city}
Key Verified Research Observations:
${ctx.research.growth_signals.observations.join('\n')}

Sender Profile:
Name: ${ctx.senderName || 'Muhammad Shoaib'}
Email: ${ctx.senderEmail || 'Mshoaibawan371@gmail.com'}
Specialization: ${ctx.senderBusiness || 'Web Development & Client Acquisition'}
Offer: ${ctx.offerService || 'Building a modern, high-converting website and online booking system'}

Strict Requirements:
1. Mention the actual business name and at least one factual research observation (e.g. positive local reputation, active customer interest, lack of dedicated online booking).
2. Explain specifically how an official, modern website will capture local search inquiries that currently go to competitors.
3. Be concise (under 160 words), natural, and direct.
4. NO fake flattery or generic clichés ("I hope this email finds you well", "In today's digital landscape").
5. Include a clear, low-pressure call to action (e.g., offering a free 2-minute mockup or short chat).
6. Provide output in JSON format: {"subject": "...", "body": "..."}`;

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
  const prompt = `Write a personalized, concise B2B email to a business owner:
Business: ${ctx.businessName} (${ctx.category} in ${ctx.city})
Verified observations: ${ctx.research.growth_signals.observations.join(', ')}
Sender: ${ctx.senderName} (${ctx.senderEmail}), ${ctx.senderBusiness}
Offer: ${ctx.offerService}

Rules:
- Mention business and real observation.
- Explain how a dedicated website captures clients currently lost to competitors.
- Keep under 150 words.
- Low-pressure call to action. No generic filler.
Return strictly JSON: {"subject": "...", "body": "..."}`;

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
        };
      }
    }
  } catch (e) {
    console.warn('Gemini API call failed:', e);
  }
  return null;
}

/**
 * 3. Intelligent Heuristic Fallback Generator
 * High-converting, bespoke email based on factual verified observations
 */
function generateHeuristicPitch(ctx: PitchContext): EmailPitch {
  const name = ctx.businessName.trim();
  const category = (ctx.category || 'local services').toLowerCase();
  const city = ctx.city.split(',')[0].trim();
  const senderName = ctx.senderName || 'Muhammad Shoaib';
  const senderEmail = ctx.senderEmail || 'Mshoaibawan371@gmail.com';
  const senderBusiness = ctx.senderBusiness || 'Web Development & Client Acquisition';

  const observation =
    ctx.research.growth_signals.observations[0] ||
    `your established presence and customer feedback as a ${category} provider in ${city}`;

  const subject = `Idea for ${name} — Capturing ${city} client inquiries online`;

  const body = `Dear ${name} Team,

I came across your business while researching reputable ${category} specialists in ${city}. Specifically, ${observation.toLowerCase().replace(/\.$/, '')} caught my attention.

While reviewing your online footprint, I noticed that ${name} does not currently have an active, dedicated website where local clients searching online can view your full services, check pricing, or submit direct project requests.

Most prospective clients in ${city} search on their phones before making an appointment or booking decision. Without a dedicated website, those inquiries often end up going to competitors with direct booking forms.

I specialize in creating clean, fast, and high-converting websites for ${category} businesses that:
• Turn online search traffic into direct customer inquiries and booked calls
• Showcase your verified track record and differentiate you from local competitors
• Require zero technical maintenance or ongoing hassle on your part

Would you be open to a quick 5-minute conversation sometime this week? I have already sketched a preliminary design concept tailored for ${name} that I'd be glad to share with you, completely free with no obligation.

Best regards,

${senderName}
${senderBusiness}
Email: ${senderEmail}

(If this isn't relevant to you right now, please simply reply with "No thanks" and I will ensure no further messages are sent.)`;

  return {
    subject,
    body,
    modelUsed: 'Deterministic Heuristic Pitch Engine (Verified Context)',
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
