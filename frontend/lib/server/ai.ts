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
    subject = `${name} — quick question`;
    alternativeSubjects = [
      `Capturing evening customer inquiries for ${name}`,
      `Estimate request page for ${name} (${city})`,
      `Quick question regarding ${name} (${city})`,
    ];
    body = `Hi ${name} team,

I was reviewing local ${category} services in ${city} and noticed ${name} on Google Maps.

Most local clients look for ${category} specialists on their smartphones during evenings and weekends when calling isn't practical. Without a fast mobile page where they can submit project details in 30 seconds, those direct inquiries often default to competitors.

I build clean, mobile-first websites tailored for ${category} businesses that turn search visitors into booked jobs with zero technical hassle on your part.

Would it be alright if I sent over a quick 2-minute concept I prepared for ${name}? No commitment or sales pitch—just wanted to share what's working for similar providers.

Best regards,

${senderName}
${senderBusiness}

(Reply "No thanks" if you'd prefer not to hear from me again.)`;
  } else if (angle === 'free_mockup') {
    subject = `Website concept for ${name}`;
    alternativeSubjects = [
      `Quick preview draft for ${name}`,
      `${name} — quick question (${city})`,
      `Idea for ${name} in ${city}`,
    ];
    body = `Hi ${name} team,

I came across your profile while looking up established ${category} providers in ${city}. You clearly have a strong local reputation, but I noticed there is currently no active website linked to your Google business listing.

When local clients search for ${category} on their phones, over 80% choose whichever provider allows them to view services or submit an instant estimate request directly online.

I actually put together a clean 1-page design preview specifically for ${name} to show how you can capture those search inquiries with an instant quote form.

Can I send the preview link over? No catch or sales pressure at all—just thought it would be a useful asset for your team.

Best regards,

${senderName}
${senderBusiness}

(If this isn't relevant right now, simply reply "No thanks" and I won't follow up.)`;
  } else {
    // Default: 'local_search'
    angle = 'local_search';
    subject = `Idea for ${name} (${city})`;
    alternativeSubjects = [
      `${name} — Google search observation`,
      `Quick question regarding ${name}`,
      `Capturing local inquiries for ${name} in ${city}`,
    ];
    body = `Hi ${name} team,

I came across ${name} while researching top ${category} providers in ${city}.

While reviewing your local presence, I noticed that ${name} does not currently have a dedicated website attached to your Google listing. When customers in ${city} search online, they typically expect to see services and an easy contact form before picking up the phone.

I specialize in building sleek, high-converting websites for ${category} businesses that ensure local search traffic turns into booked inquiries for your team.

I have already put together a preliminary concept for ${name}. Would you be open to taking a look at the preview link?

Best regards,

${senderName}
${senderBusiness}

(If this isn't relevant to your team, please reply "No thanks" and I will remove your email immediately.)`;
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
