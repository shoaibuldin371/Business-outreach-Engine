export interface StateOption {
  code: string;
  name: string;
}

export const US_50_STATES: StateOption[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }
];

export const SERVICE_CATEGORIES_LIST = [
  { id: 'all', label: 'All Services', icon: '⚡' },
  { id: 'ai_automation', label: 'AI Development & Automation', icon: '⚡' },
  { id: 'llm_rag_agents', label: 'LLMs, RAG & AI Agents', icon: '🤖' },
  { id: 'python_dev', label: 'Python Development', icon: '🐍' },
  { id: 'huawei_cloud', label: 'Huawei Cloud Development', icon: '☁️' },
  { id: 'data_science_analytics', label: 'Data Science & Analytics', icon: '📊' },
  { id: 'data_science_training', label: 'Data Science Training', icon: '🎓' },
  { id: 'website_digital', label: 'Website & Digital Solutions', icon: '🌐' }
];

export const DEMAND_SIGNALS_LIST = [
  { id: 'all', label: 'All Signals' },
  { id: 'explicit_demand', label: '⚡ Explicit Demand' },
  { id: 'evidence_backed', label: '🔍 Evidence-Backed Need' },
  { id: 'website_opportunity', label: '🌐 Website Opportunity' }
];

export const TARGET_INDUSTRIES_LIST = [
  'All Industries',
  'Small & Medium-Sized Businesses (SMBs)',
  'Growing Startups & Technology Companies',
  'Consulting & Professional Service Firms',
  'E-Commerce & Retail Businesses',
  'Healthcare & Dental Practices',
  'Real Estate & Property Management',
  'Logistics & Transportation',
  'Manufacturing & Industrial Businesses',
  'Financial & Accounting Services',
  'Marketing & Digital Agencies',
  'Education & Training Companies',
  'SaaS Companies & Software Businesses'
];
