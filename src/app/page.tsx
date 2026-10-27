import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-photo" />
        <div className="landing-shade" />
        <header className="landing-nav">
          <Link href="/" className="landing-wordmark">
            <span className="brand-mark"><span>n</span></span>
            noirbank
          </Link>
          <nav aria-label="Main navigation">
            <a href="#accounts">THE ACCOUNTS</a>
            <a href="#approvals">OWNER CONTROL</a>
            <a href="#trust">TRUST MODEL</a>
          </nav>
          <Link className="landing-nav-cta" href="/app">OPEN YOUR BANK <span>↗</span></Link>
        </header>
        <div className="hero-copy">
          <p className="hero-eyebrow"><span>■</span> PRIVATE AGENTIC BANKING ON ZCASH</p>
          <h1>Private banking<br />for your AI agents.</h1>
          <p className="hero-subtitle">
            Open accounts for your agents on Zcash. Set their mandates, approve what they pay, and keep every balance shielded.
          </p>
          <div className="hero-actions">
            <Link className="hero-button hero-button--light" href="/app">OPEN YOUR BANK <span>↗</span></Link>
            <a className="hero-button hero-button--orange" href="#how-it-works">HOW IT WORKS <span>↓</span></a>
          </div>
        </div>
        <div className="hero-bottomline">
          <span>SHIELDED BY ZCASH. APPROVED BY YOU.</span>
          <span>LIVE ON ZCASH TESTNET <i>↘</i></span>
        </div>
      </section>

      <section className="landing-story" id="how-it-works">
        <div className="story-intro">
          <p className="eyebrow">AGENTIC BANKING, PRIVATE BY DEFAULT</p>
          <h2>Your agents bank here.<br /><em>You stay in charge.</em></h2>
          <p className="story-lead">
            Every agent gets its own shielded account with a mandate. Agents request payments. You approve them.
          </p>
        </div>

        <div className="product-frame" aria-label="Noirbank account interface preview">
          <div className="product-frame-top">
            <div className="frame-brand"><span className="brand-mark brand-mark--small">n</span> noirbank</div>
            <div className="frame-network"><span className="status-dot status-dot--green" /> ZCASH TESTNET</div>
            <span className="frame-owner">OWNER VIEW</span>
          </div>
          <div className="frame-body">
            <div className="frame-sidebar">
              <span className="frame-active">◫ &nbsp; Overview</span>
              <span>▣ &nbsp; Accounts</span>
              <span>✓ &nbsp; Approvals</span>
              <span>≡ &nbsp; Statements</span>
            </div>
            <div className="frame-content">
              <div className="frame-overview-eyebrow">PRIVATE BANKING / TESTNET</div>
              <div className="frame-content-head">
                <div><h3>Treasury</h3><p>Chain balance appears after opening your bank.</p></div>
                <span className="frame-sync">LIVE ON TESTNET</span>
              </div>
              <div className="frame-divider" />
              <div className="frame-lower">
                <div><small>AGENT ACCOUNTS</small><span>Separate shielded accounts, each with a mandate.</span></div>
                <div><small>OWNER APPROVAL</small><span>Requests wait here until you decide.</span></div>
              </div>
              <div className="frame-honesty"><ShieldIcon /> No sample balances or synthetic transactions.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-grid" id="accounts">
        <article className="feature-card">
          <div className="feature-index">01 / ACCOUNTS & MANDATES</div>
          <div className="feature-rule" />
          <h3>One account per agent.</h3>
          <p>Payroll clerk, tips bot, API spender — each gets its own shielded Zcash account and a mandate you set.</p>
          <span className="feature-icon">↗</span>
        </article>
        <article className="feature-card" id="approvals">
          <div className="feature-index">02 / APPROVAL QUEUE</div>
          <div className="feature-rule" />
          <h3>Propose freely.<br />Broadcast carefully.</h3>
          <p>Every proposal is checked again against its mandate and spendable balance before you approve a real send.</p>
          <span className="feature-icon">⌁</span>
        </article>
        <article className="feature-card">
          <div className="feature-index">03 / STATEMENTS</div>
          <div className="feature-rule" />
          <h3>Private by default.<br />Auditable on request.</h3>
          <p>Statements read from the chain, a full audit trail, and viewing keys you share only when you choose.</p>
          <span className="feature-icon">◉</span>
        </article>
      </section>

      <section className="trust-strip" id="trust">
        <div className="trust-strip-label"><span>■</span> A STRAIGHTFORWARD TRUST MODEL</div>
        <p><strong>Agents never hold keys.</strong> Your bank runs on your own server. Noirbank checks every mandate before a payment, and every payment needs your approval.</p>
        <Link href="/app/settings">READ THE TRUST MODEL <span>↗</span></Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-wordmark"><span className="brand-mark"><span>n</span></span>noirbank</Link>
        <span>PRIVATE AGENTIC BANKING ON ZCASH</span>
        <Link href="/app">OPEN YOUR BANK <span>↗</span></Link>
      </footer>
    </main>
  );
}

function ShieldIcon() {
  return <span aria-hidden="true">◈</span>;
}
