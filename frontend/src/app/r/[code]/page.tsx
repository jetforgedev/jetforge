import { redirect } from 'next/navigation';

export default function ReferralRedirect({ params }: { params: { code: string } }) {
  // Redirect to homepage with referral code as query param
  // The homepage will store it in localStorage
  redirect(`/?ref=${params.code}`);
}
