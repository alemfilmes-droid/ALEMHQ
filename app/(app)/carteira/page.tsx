import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WalletScreen } from "@/features/wallet/components/wallet-screen";
import { getWallet, WalletAccessError } from "@/features/wallet/queries";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Carteira" };

type SearchParams = Promise<{ pessoa?: string; mes?: string }>;

export default async function WalletPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireProfile();
  const { pessoa, mes } = await searchParams;
  try {
    return <WalletScreen data={await getWallet(profile, pessoa)} viewerId={profile.id} mes={mes} />;
  } catch (error) {
    if (!(error instanceof WalletAccessError)) throw error;
    return (
      <>
        <PageHeader panel="/carteira" eyebrow="Principal" title="Carteira." />
        <p role="alert" className="rounded-lg border-2 border-foreground p-4 text-sm font-semibold">
          Você só pode ver a sua Carteira.{" "}
          <Link href="/carteira" className="underline">
            Abrir a minha
          </Link>
        </p>
      </>
    );
  }
}
