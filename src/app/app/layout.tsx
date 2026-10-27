import { Suspense } from "react";

import { BankingShell } from "@/components/banking-shell";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<main className="bank-main"><div className="eyebrow">NOIRBANK</div><p>Loading bank state…</p></main>}>
      <BankingShell>{children}</BankingShell>
    </Suspense>
  );
}
