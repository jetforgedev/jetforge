import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReferralRedirect({ params }: { params: { code: string } }) {
  // Redirect to homepage with referral code as query param
  // The homepage will store it in localStorage
  redirect(`/?ref=${params.code}`);
}
