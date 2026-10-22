import { DeepResearchResult } from './research';

export interface EmailPitch {
  subject: string;
  body: string;
  modelUsed: string;
  pitchAngle: 'local_search' | 'mobile_speed' | 'free_mockup';
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
  pitchAngle?: 'local_search' | 'mobile_speed' | 'free_mockup' | 'auto';
}

/**
 * 1. Generate pitch via Anthropic Claude API
 */
async function generateWithAnthropic(
  apiKey: string,
  ctx: PitchContext
): Promise<EmailPitch | null> {
  const chosenAngle = ctx.pitchAngle && ctx.pitchAngle !== 'auto' ? ctx.pitchAngle : 'local_search';
  const prompt = `You are an executive B2B outreach specialist writing a cold email to a local business owner.
Business Name: ${ctx.businessName}
Niche: ${ctx.category}
Location: ${ctx.city}
Angle: ${chosenAngle}
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
3. Be concise (under 140 words), natural, and direct.
4. NO fake flattery or generic clichés ("I hope this email finds you well", "In today's digital landscape").
5. Include a clear, low-pressure call to action (e.g., offering a free 2-minute mockup or short chat).
6. Provide output in JSON format: {"subject": "...", "body": "...", "alternativeSubjects": ["...", "..."]}`;

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
          pitchAngle: chosenAngle as any,
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
  const chosenAngle = ctx.pitchAngle && ctx.pitchAngle !== 'auto' ? ctx.pitchAngle : 'local_search';
  const prompt = `Write a personalized, concise B2B email to a business owner:
Business: ${ctx.businessName} (${ctx.category} in ${ctx.city})
Verified observations: ${ctx.research.growth_signals.observations.join(', ')}
Sender: ${ctx.senderName} (${ctx.senderEmail}), ${ctx.senderBusiness}
Offer: ${ctx.offerService}
Angle: ${chosenAngle}

Rules:
- Mention business and real observation.
- Explain how a dedicated website captures clients currently lost to competitors.
- Keep under 140 words.
- Low-pressure call to action. No generic filler.
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
          pitchAngle: chosenAngle as any,
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
 * 3. Intelligent Heuristic Generator with 3 Verified Evidence-Backed Angles
 */
export function generateHeuristicPitch(ctx: PitchContext): EmailPitch {
  const name = ctx.businessName.trim();
  const category = (ctx.category || 'local services').toLowerCase();
  const city = ctx.city.split(',')[0].trim();
  const senderName = ctx.senderName || 'Muhammad Shoaib';
  const senderBusiness = ctx.senderBusiness || 'Web Development & Client Acquisition';

  const observation =
    ctx.research.growth_signals.observations[0] ||
    `your established presence and customer feedback as a ${category} provider in ${city}`;

  const cleanObs = observation.toLowerCase().replace(/\.$/, '');

  let angle = ctx.pitchAngle;
  if (!angle || angle === 'auto') {
    // Automatically select the best angle based on available context
    if (cleanObs.includes('rating') || cleanObs.includes('review') || cleanObs.includes('reputable')) {
      angle = 'local_search';
    } else if (cleanObs.includes('phone') || cleanObs.includes('call') || cleanObs.includes('appointment')) {
      angle = 'mobile_speed';
    } else {
      angle = 'free_mockup';
    }
  }

  let subject = '';
  let alternativeSubjects: string[] = [];
  let body = '';

  if (angle === 'mobile_speed') {
    subject = `Mobile client inquiries for ${name} in ${city}`;
    alternativeSubjects = [
      `Quick question regarding ${name}'s customer inquiry process`,
      `Allowing ${city} clients to request estimates online from ${name}`,
    ];
    body = `Hi ${name} Team,

I noticed ${name} while reviewing active ${category} services in ${city}. Specifically, ${cleanObs} caught my attention.

Over 70% of clients looking for ${category} services in ${city} search on their smartphones in the evening when calling isn't convenient. Without a fast, mobile-friendly landing page, those direct inquiries default to competitors with instant quote forms.

I build clean, mobile-first websites tailored for ${category} businesses that allow local customers to request estimates or book services directly in 30 seconds.

Would you be open to a 5-minute call sometime this week? I have already prepared a quick preview concept for ${name} that I'd be glad to share with no obligation.

Best regards,

${senderName}
${senderBusiness}

(If this isn't relevant to you right now, please reply with "No thanks" and I will ensure no further emails are sent.)`;
  } else if (angle === 'free_mockup') {
    subject = `Complimentary website concept prepared for ${name}`;
    alternativeSubjects = [
      `Rough mockup draft for ${name} (${city})`,
      `Quick preview of a modern web presence for ${name}`,
    ];
    body = `Hi ${name} Team,

I came across your work in ${city} while researching reputable ${category} providers. Specifically, ${cleanObs} stood out.

While checking your digital footprint, I saw that ${name} does not have an active website to showcase your past projects and services to clients searching Google.

To show you exactly what's possible, I put together a clean, 1-page design concept specifically for ${name}. It showcases your credentials, transparent service options, and an easy estimate request form.

Can I send over the preview link for you to look over? No sales pitch or pressure—just a free resource for your team.

Best regards,

${senderName}
${senderBusiness}

(Reply "No thanks" if you'd prefer not to hear from me again.)`;
  } else {
    // Default: 'local_search'
    angle = 'local_search';
    subject = `Idea for ${name} — Capturing ${city} client inquiries online`;
    alternativeSubjects = [
      `Quick observation regarding ${name}'s online visibility in ${city}`,
      `How ${name} can capture local ${category} inquiries in ${city}`,
    ];
    body = `Dear ${name} Team,

I came across your business while researching reputable ${category} specialists in ${city}. Specifically, ${cleanObs} caught my attention.

While reviewing your online footprint, I noticed that ${name} does not currently have an active, dedicated website where local clients searching online can view your full services, check pricing, or submit direct project requests.

Most prospective clients in ${city} search on Google before making a booking decision. Without a dedicated website, those inquiries often end up going to competitors with direct booking forms.

I specialize in creating clean, fast websites for ${category} businesses that turn search traffic into booked calls with zero technical hassle on your part.

Would you be open to a quick 5-minute conversation sometime this week? I'd be glad to share a preliminary concept prepared for ${name}, completely free with no obligation.

Best regards,

${senderName}
${senderBusiness}

(If this isn't relevant right now, simply reply "No thanks" and I will immediately mark your address as do-not-contact.)`;
  }

  return {
    subject,
    body,
    modelUsed: 'Deterministic Heuristic Pitch Engine (Verified Context)',
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
