"use client";

import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  BadgeCheck,
  BookUser,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { AppState } from "@/lib/types";
import { Button } from "@/components/ui/button";

type BankContextValue = {
  state: AppState | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  request: <T,>(url: string, body?: unknown, method?: "POST" | "PUT") => Promise<T>;
};

const BankContext = createContext<BankContextValue | null>(null);
const SIDEBAR_STORAGE_KEY = "noirbank-sidebar-collapsed";

function subscribeToSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("noirbank-sidebar-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("noirbank-sidebar-change", callback);
  };
}

function getSidebarCollapsed() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

function getServerSidebarCollapsed() {
  return false;
}

export function useBank(): BankContextValue {
  const value = useContext(BankContext);
  if (!value) throw new Error("useBank must be used within BankingShell.");
  return value;
}

const navigation = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/accounts", label: "Accounts", icon: WalletCards },
  { href: "/app/approvals", label: "Approvals", icon: BadgeCheck },
  { href: "/app/payees", label: "Payees", icon: BookUser },
  { href: "/app/statements", label: "Statements", icon: ClipboardList },
  { href: "/app/settings", label: "Settings", icon: Settings2 },
];

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/app/accounts/")) return "Account";
  return navigation.find((item) => item.href === pathname)?.label ?? "Overview";
}

export function BankingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const collapsed = useSyncExternalStore(subscribeToSidebar, getSidebarCollapsed, getServerSidebarCollapsed);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/bank", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load bank state.");
    setState(payload as AppState);
    setError(null);
  }, []);

  const request = useCallback(async <T,>(
    url: string,
    body?: unknown,
    method: "POST" | "PUT" = "POST",
  ): Promise<T> => {
    setError(null);
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = payload.error || "The request could not be completed.";
      setError(message);
      throw new Error(message);
    }
    await refresh();
    return payload as T;
  }, [refresh]);

  useEffect(() => {
    void fetch("/api/bank", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load bank state.");
        setState(payload as AppState);
        setError(null);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load bank state."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!state?.wallet.opened) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh, state?.wallet.opened]);

  const toggleSidebar = () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new Event("noirbank-sidebar-change"));
  };
  const context = useMemo(
    () => ({ state, loading, error, clearError: () => setError(null), refresh, request }),
    [state, loading, error, refresh, request],
  );

  return (
    <BankContext.Provider value={context}>
      <div className={`bank-frame ${collapsed ? "bank-frame--collapsed" : ""}`}>
        <aside className="bank-sidebar">
          <Link className="bank-wordmark" href="/app" aria-label="Noirbank overview">
            <span className="brand-mark"><Landmark size={17} strokeWidth={1.8} /></span>
            {!collapsed && <span>noirbank</span>}
          </Link>
          <div className="sidebar-caption">{collapsed ? "NB" : "PRIVATE BANK"}</div>
          <nav className="side-navigation" aria-label="Bank navigation">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = href === "/app"
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              const count = label === "Approvals"
                ? state?.proposals.filter((proposal) => proposal.status === "pending").length
                : undefined;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`side-link ${active ? "side-link--active" : ""}`}
                  title={collapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  {!collapsed && <span>{label}</span>}
                  {!collapsed && count ? <span className="nav-count">{count}</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            {!collapsed && (
              <div className="sidebar-trust">
                <ShieldCheck size={16} />
                <span>Agents propose.<br />You approve.</span>
              </div>
            )}
            <button className="collapse-button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>
        <div className="bank-main">
          <header className="app-topbar">
            <div className="topbar-title">
              <span className="eyebrow">NOIRBANK / TESTNET</span>
              <strong>{pageTitle(pathname)}</strong>
            </div>
            <div className="topbar-tools">
              <span className={`network-pill ${state?.wallet.ready ? "network-pill--ready" : ""}`}>
                <span className="status-dot" />
                {state?.wallet.opened ? "TESTNET · ZECROCKS" : "VAULT NOT OPEN"}
              </span>
              <Link className="help-link" href="/app/settings" aria-label="Settings">
                <CircleHelp size={18} />
              </Link>
            </div>
          </header>
          <main className="app-content">
            {error && (
              <div className="global-alert" role="alert">
                <Activity size={16} />
                <span>{error}</span>
                <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
              </div>
            )}
            {state?.wallet.message && (
              <div className="readiness-banner">
                <ArrowDownLeft size={16} />
                <span>{state.wallet.message}</span>
              </div>
            )}
            {state && !state.wallet.opened && (
              <section className="onboarding-panel">
                <div className="onboarding-symbol"><Landmark size={24} /></div>
                <div className="eyebrow">FIRST, OPEN YOUR BANK</div>
                <h1>Make Treasury yours.</h1>
                <p>
                  Noirbank opens a local age-encrypted wallet on Zcash testnet.
                  Treasury is your first account; agents never receive its keys.
                </p>
                <Button
                  className="nb-button nb-button--primary"
                  disabled={loading || !state.wallet.ready}
                  onClick={() => void request("/api/bank")}
                >
                  Open Treasury <ArrowLeftRight size={16} />
                </Button>
                <div className="onboarding-foot">
                  <ShieldCheck size={15} />
                  <span>The wallet is created only on this self-hosted server.</span>
                </div>
              </section>
            )}
            {children}
          </main>
          <footer className="app-footer">
            <span>NOIRBANK · ZCASH TESTNET</span>
            <span>Software mandates · owner-approved transactions</span>
          </footer>
        </div>
      </div>
    </BankContext.Provider>
  );
}
