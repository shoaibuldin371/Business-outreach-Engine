import { DeepResearchResult } from './research';
import type { ServiceCategory, DemandSignalType } from './types';

export type PitchAngle =
  | 'ai_automation'
  | 'llm_rag_agents'
  | 'python_dev'
  | 'huawei_cloud'
  | 'data_science_analytics'
  | 'data_science_training'
  | 'website_digital'
  | 'local_search'
  | 'mobile_speed'
  | 'free_mockup';

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
  serviceCategory?: ServiceCategory;
  signalType?: DemandSignalType;
  demandEvidence?: string;
  evidenceUrl?: string;
  state?: string;
  industry?: string;
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
  const chosenAngle = ctx.serviceCategory || (ctx.pitchAngle && ctx.pitchAngle !== 'auto' ? ctx.pitchAngle : 'ai_automation');
  const prompt = `You are an elite B2B outreach specialist writing a personalized cold email to a business leader.
Business Name: ${ctx.businessName}
Niche: ${ctx.category} (${ctx.industry || 'Technology Services'})
Location: ${ctx.city}, ${ctx.state || 'US'}
Angle: ${chosenAngle}
Verified Demand Evidence: ${ctx.demandEvidence || 'Verified operational opportunity during business audit.'}
Key Research Observations:
${ctx.research.growth_signals.observations.join('\n')}

Sender Profile:
Name: ${ctx.senderName || 'Muhammad Shoaib'}
Email: ${ctx.senderEmail || 'Mshoaibawan371@gmail.com'}
Specialization: AI Developer & Automation Architect | Huawei Certified Cloud Developer | LLMs & Python | Data Science Trainer
Offer: ${ctx.offerService || 'AI Automation, Custom LLM Workflows, Python Backends & Cloud Architecture'}

Strict Requirements:
1. Mention the actual business name and cite the verified demand observation.
2. Align specifically with the Angle:
   - 'ai_automation': Automating repetitive manual workflows (intake, document processing, API/n8n/Make pipelines) using custom AI agents and Python.
   - 'llm_rag_agents': Custom RAG systems, role-based document search, and tool-using AI agents querying internal SOPs/docs.
   - 'python_dev': Backend/API development (FastAPI), automated ETL data pipelines, task automation, and external API integrations.
   - 'huawei_cloud': Huawei Certified Cloud Developer deployment, ECS/OBS/CCE architecture, and cross-cloud migration.
   - 'data_science_analytics': Automated business intelligence, SQL/Python data pipelines, KPI dashboards, and predictive forecasting.
   - 'data_science_training': Corporate Python training, hands-on Data Science/AI workshops, and guest instructor collaboration for cohorts.
   - 'website_digital': High-converting mobile landing pages, instant quote forms, and automated inquiry capture.
3. Be concise (under 120 words), natural, polite, and direct.
4. NO generic clichés or fake flattery ("I hope this email finds you well", "In today's fast-paced world").
5. Include a low-pressure permission-based call to action (offering to share a quick preview or outline).
6. NEVER include any opt-out text or lines like "reply no thanks" or "if not interested reply no thanks".
7. Sign off with:
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
  let rawCategory = (ctx.category || 'technology services').toLowerCase().replace(/_/g, ' ');
  if (rawCategory === 'business' || rawCategory === 'local business' || !rawCategory.trim()) {
    rawCategory = 'technology services';
  }
  const category = rawCategory;
  const city = ctx.city.split(',')[0].trim();
  const state = ctx.state || (ctx.city.includes(',') ? ctx.city.split(',')[1].trim() : 'US');
  const senderName = ctx.senderName || 'Muhammad Shoaib';
  const senderEmail = ctx.senderEmail || 'Mshoaibawan371@gmail.com';
  const sig = DEFAULT_SIGNATURE(senderName, senderEmail);

  // Determine angle from service_category or pitchAngle or keyword inference
  let angle: PitchAngle = 'ai_automation';

  if (ctx.serviceCategory) {
    angle = ctx.serviceCategory;
  } else if (ctx.pitchAngle && ctx.pitchAngle !== 'auto') {
    angle = ctx.pitchAngle;
  } else {
    const catLower = category.toLowerCase();
    if (catLower.includes('training') || catLower.includes('bootcamp') || catLower.includes('academy') || catLower.includes('institute') || catLower.includes('college')) {
      angle = 'data_science_training';
    } else if (catLower.includes('rag') || catLower.includes('llm') || catLower.includes('agent') || catLower.includes('knowledge') || catLower.includes('assistant')) {
      angle = 'llm_rag_agents';
    } else if (catLower.includes('python') || catLower.includes('etl') || catLower.includes('api') || catLower.includes('scraping') || catLower.includes('backend')) {
      angle = 'python_dev';
    } else if (catLower.includes('huawei') || catLower.includes('cloud deployment') || catLower.includes('cross-cloud')) {
      angle = 'huawei_cloud';
    } else if (catLower.includes('analytics') || catLower.includes('data science') || catLower.includes('dashboard') || catLower.includes('forecast') || catLower.includes('bi')) {
      angle = 'data_science_analytics';
    } else if (catLower.includes('website') || catLower.includes('redesign') || catLower.includes('landing') || catLower.includes('intake')) {
      angle = 'website_digital';
    } else {
      angle = 'ai_automation';
    }
  }

  // Use explicit evidence if available
  const evidenceSnippet = ctx.demandEvidence?.trim() 
    ? ctx.demandEvidence.split('.')[0] + '.'
    : (ctx.research.growth_signals.observations[0] || `operational initiatives in ${city}`);

  let subject = '';
  let alternativeSubjects: string[] = [];
  let body = '';

  if (angle === 'ai_automation') {
    subject = `quick question regarding ${name} workflows`;
    alternativeSubjects = [
      `automation idea for ${name}`,
      `${name} x custom AI workflows`,
      `workflow automation question for ${name}`,
    ];
    body = `Hi ${name} team,

I came across ${name} in ${city}, ${state} while reviewing technology initiatives in the ${ctx.industry || category} space.

${evidenceSnippet}

I am an AI Developer & Automation Architect (Huawei Certified Cloud Developer, Python/LLMs). I build bespoke workflow automations, custom AI intake agents, and multi-system API pipelines (n8n, Make, Zapier, and Python) that connect fragmented business tools and eliminate 10-15+ hours of repetitive manual data entry every week.

I mapped out a quick 2-minute workflow breakdown showing a couple of areas where automated AI agents could plug right into your stack.

Would you be open to me sharing the outline? (No sales pitch or expectation at all, just thought it'd be genuinely helpful for your team.)

${sig}`;
  } else if (angle === 'llm_rag_agents') {
    subject = `question on internal knowledge / LLM assistant for ${name}`;
    alternativeSubjects = [
      `RAG / document search idea for ${name}`,
      `${name} x custom AI knowledge assistant`,
      `quick question for ${name} engineering`,
    ];
    body = `Hi ${name} team,

I came across ${name} in ${city} and was following your work in ${ctx.industry || category}.

${evidenceSnippet}

I specialize in building custom RAG (Retrieval-Augmented Generation) systems, enterprise knowledge assistants, and tool-using AI agents that query internal documentation, tickets, or SOPs with strict accuracy and source citations.

Instead of generic chatbot responses, I build domain-specific vector search pipelines that allow your team to instantly search complex documentation and automate repetitive customer inquiries.

Would you be open to a quick 2-minute architecture preview showing how a specialized RAG assistant could integrate with your systems?

${sig}`;
  } else if (angle === 'python_dev') {
    subject = `Python backend & API pipeline question for ${name}`;
    alternativeSubjects = [
      `Python ETL / backend idea for ${name}`,
      `${name} x Python API pipelines`,
      `quick technical question for ${name}`,
    ];
    body = `Hi ${name} team,

I was looking into ${name} in ${city}, ${state} and noticed your technical footprint in ${ctx.industry || category}.

${evidenceSnippet}

I am an AI Developer & Python Specialist (Huawei Certified Cloud Developer). I build robust FastAPI microservices, asynchronous ETL data pipelines, third-party API integrations, and task automations that replace fragile spreadsheets and legacy scripts with reliable, monitored services.

I put together a quick technical outline showing how an automated Python data pipeline could handle this workflow with zero manual overhead.

Would you be open to me sending over the outline and a couple of relevant GitHub examples?

${sig}`;
  } else if (angle === 'huawei_cloud') {
    subject = `cloud architecture & deployment for ${name}`;
    alternativeSubjects = [
      `cloud infrastructure question for ${name}`,
      `${name} x enterprise cloud architecture`,
      `Huawei Cloud & deployment inquiry for ${name}`,
    ];
    body = `Hi ${name} team,

I came across ${name} in ${city} while researching cloud deployment and infrastructure initiatives in ${ctx.industry || category}.

${evidenceSnippet}

I am a Huawei Certified Cloud Developer and backend systems architect. I help companies configure, containerize, and deploy secure workloads on Huawei Cloud infrastructure (ECS, OBS, CCE, and multi-cloud API gateways), ensuring high availability, streamlined CI/CD, and optimized cloud compute costs.

Would you be open to a quick high-level review of your current cloud deployment setup to see if there are opportunities to optimize latency or infrastructure overhead?

${sig}`;
  } else if (angle === 'data_science_analytics') {
    subject = `data pipeline & reporting dashboards for ${name}`;
    alternativeSubjects = [
      `analytics & reporting idea for ${name}`,
      `${name} x automated data intelligence`,
      `quick question on ${name} reporting pipelines`,
    ];
    body = `Hi ${name} team,

I came across ${name} in ${city}, ${state} while reviewing analytics and reporting operations in ${ctx.industry || category}.

${evidenceSnippet}

I build automated business intelligence pipelines, SQL/Python data transformation routines, and interactive dashboards that turn disparate operational records into real-time KPI visibility and predictive forecasts.

I put together a quick 2-minute preview showing how an automated metrics pipeline and executive dashboard could eliminate manual reporting for your team.

Would you be open to me sharing the preview? No catch or sales pressure at all, just thought it would provide immediate value.

${sig}`;
  } else if (angle === 'data_science_training') {
    subject = `curriculum / AI & Python training for ${name}`;
    alternativeSubjects = [
      `Data Science & LLM Training for ${name}`,
      `technical training collaboration for ${name}`,
      `${name} — guest instructor for AI & Python`,
    ];
    body = `Hi ${name} team,

I came across ${name} while looking at leading tech and training organizations in ${city}, ${state}.

${evidenceSnippet}

I am a Data Science Trainer and Huawei Certified Cloud Developer specializing in Python, Large Language Models (LLMs), and practical Machine Learning. I help academies and corporate teams deliver hands-on, job-ready training modules and practical lab exercises for students and technical professionals.

Are you currently looking for guest trainers, curriculum mentors, or practical lab instructors for your upcoming Python, Data Science, or AI cohorts?

I'd be glad to share our syllabus and past cohort project outlines if you're open to a quick look.

${sig}`;
  } else if (angle === 'website_digital' || angle === 'mobile_speed') {
    subject = `${name} — quick question regarding client inquiry flow`;
    alternativeSubjects = [
      `Quick question regarding ${name}`,
      `Idea for ${name} (${city})`,
      `${name} customer inquiries`,
    ];
    body = `Hi ${name} team,

I came across ${name} earlier today while looking at established ${category} providers in ${city}, ${state}.

${evidenceSnippet}

I noticed a couple of friction points on mobile—specifically page load speed and how prospective clients request an estimate or booking. Most people searching on smartphones prefer requesting a quote online rather than calling, and bounce if they can't submit an inquiry in two clicks.

I put together a clean 1-page mobile redesign concept for ${name} with an instant estimate form to show how you can capture more booked inquiries from your search traffic.

Can I shoot the preview link over? No catch or sales pressure at all, just thought it might be useful for your team.

${sig}`;
  } else {
    // Default fallback
    subject = `Website concept for ${name}`;
    alternativeSubjects = [
      `Quick preview draft for ${name}`,
      `${name} — quick question`,
      `Idea for ${name} in ${city}`,
    ];
    body = `Hi ${name} team,

I came across your profile while looking up established ${category} providers in ${city}, ${state}.

${evidenceSnippet}

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
