import { notFound } from 'next/navigation';
import { getPersonalizedPageByToken } from '@/lib/server/personalized-page';
import PersonalizedClientView from './PersonalizedClientView';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: {
    token: string;
  };
}

export default async function PersonalizedPage({ params }: Props) {
  const result = await getPersonalizedPageByToken(params.token);

  if (!result) {
    return (
      <div className="min-h-screen bg-[#080c14] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center font-bold text-lg">
            !
          </div>
          <h1 className="text-xl font-bold text-white">Evaluation Link Expired or Inactive</h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            This private technical brief has expired or was revoked in accordance with our 30-day data retention policy.
          </p>
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
            To request an updated technical review, please contact:
            <div className="mt-1 font-mono text-cyan-400">
              Mshoaibawan371@gmail.com
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { page, business_name, city, state, industry, website } = result;

  return (
    <PersonalizedClientView
      token={params.token}
      businessName={business_name}
      city={city}
      state={state}
      industry={industry}
      website={website}
      proposal={page.custom_proposal}
      initialRoi={page.roi_assumptions}
      expiresAt={page.expires_at}
    />
  );
}
