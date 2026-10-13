import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WalletScreen } from "@/features/wallet/components/wallet-screen";
import { isDemoEnabled } from "@/features/prospeccao/demo";
import { demoWallet } from "@/features/wallet/demo";
import { getWallet, WalletAccessError } from "@/features/wallet/queries";
import { todayInAppZone } from "@/lib/calendar";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Carteira" };

type SearchParams = Promise<{ pessoa?: string; mes?: string; aba?: string; demo?: string }>;

export default async function WalletPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { pessoa, mes, aba, demo } = await searchParams;
  if (isDemoEnabled(demo)) {
    const data = demoWallet({ id: profile.id, name: profile.full_name }, todayInAppZone());
    return <WalletScreen data={data} viewerId={profile.id} mes={mes} aba={aba} />;
  }
  try {
    return <WalletScreen data={await getWallet(profile, pessoa)} viewerId={profile.id} mes={mes} aba={aba} />;
  } catch (error) {
    if (!(error instanceof WalletAccessError)) throw error;
    return (
      <div className="wallet-scope">
        <PageHeader panel="/carteira" eyebrow="Principal" title="Carteira." />
        <p role="alert" className="rounded-lg border-2 border-foreground p-4 text-sm font-semibold">
          Você só pode ver a sua Carteira.{" "}
          <Link href="/carteira" className="underline">
            Abrir a minha
          </Link>
        </p>
      </div>
    );
  }
}
