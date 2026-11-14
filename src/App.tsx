import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  ChevronDown,
  CircleHelp,
  Globe2,
  Leaf,
  Menu,
  MessageCircle,
  PackageSearch,
  Search,
  ShieldCheck,
  Truck,
  Wheat,
  X
} from "lucide-react";
import { useState } from "react";

const categories = [
  { name: "Grains & cereals", detail: "Wheat, rice, maize and more", icon: Wheat },
  { name: "Fruits", detail: "Fresh seasonal produce", icon: Leaf },
  { name: "Vegetables", detail: "Farm-fresh daily supply", icon: PackageSearch },
  { name: "Logistics", detail: "Move produce with confidence", icon: Truck }
];

const steps = [
  { number: "01", title: "List or discover produce", text: "Sellers share what is available. Buyers describe what they need, with clear quantities and locations." },
  { number: "02", title: "Connect and compare", text: "Explore relevant opportunities, ask questions and compare commercial details before making a decision." },
  { number: "03", title: "Coordinate the movement", text: "Bring transport discussions and delivery updates into a clearer, more organized workflow." }
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="site-shell">
      <div className="announcement">
        <span className="announcement-dot" />
        A clearer way to connect agricultural supply and demand
        <ArrowUpRight size={14} />
      </div>

      <header className="header">
        <a className="brand" href="#home" aria-label="AgriBridge home">
          <span className="brand-mark"><Leaf size={22} strokeWidth={2.2} /></span>
          <span>Agri<span>Bridge</span></span>
        </a>

        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
          {menuOpen ? <X /> : <Menu />}
        </button>

        <nav className={menuOpen ? "nav nav-open" : "nav"}>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#marketplace" onClick={() => setMenuOpen(false)}>Explore</a>
          <a href="#trust" onClick={() => setMenuOpen(false)}>Why AgriBridge</a>
          <a href="#support" onClick={() => setMenuOpen(false)}>Help</a>
        </nav>

        <div className="header-actions">
          <button className="button button-quiet">Log in</button>
          <button className="button button-dark">Get started <ArrowRight size={16} /></button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span /> AGRICULTURE, CONNECTED</div>
            <h1>From the field<br />to the <span>right market.</span></h1>
            <p className="hero-description">
              A more connected agricultural ecosystem. Discover produce, connect with the right people and coordinate what happens next.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#marketplace">Explore AgriBridge <ArrowRight size={17} /></a>
              <a className="text-link" href="#how-it-works">See how it works <ArrowUpRight size={16} /></a>
            </div>
            <div className="hero-proof">
              <div className="proof-icon"><ShieldCheck size={18} /></div>
              <div><strong>Built around clarity and trust</strong><span>Useful information. Clearer coordination.</span></div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Illustration of agricultural fields and harvest">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="sun" />
            <div className="field field-back" />
            <div className="field field-mid" />
            <div className="field field-front" />
            <div className="visual-label label-top"><span className="label-icon"><Wheat size={16} /></span><span><b>Produce supply</b><small>Information that connects</small></span></div>
            <div className="visual-label label-bottom"><span className="label-icon label-truck"><Truck size={17} /></span><span><b>Logistics coordination</b><small>From pickup to delivery</small></span></div>
            <div className="visual-caption">GROWING CONNECTIONS <span>✳</span></div>
          </div>
        </section>

        <section className="value-strip" id="trust">
          <div className="value-item"><span className="value-icon"><Globe2 size={19} /></span><div><b>One connected ecosystem</b><small>Supply, demand and movement</small></div></div>
          <div className="value-item"><span className="value-icon"><BarChart3 size={19} /></span><div><b>Clearer comparisons</b><small>Understand the details that matter</small></div></div>
          <div className="value-item"><span className="value-icon"><MessageCircle size={19} /></span><div><b>Direct coordination</b><small>Bring conversations closer together</small></div></div>
          <div className="value-item"><span className="value-icon"><BadgeCheck size={19} /></span><div><b>Trust by design</b><small>Transparent information and controls</small></div></div>
        </section>

        <section className="section marketplace-section" id="marketplace">
          <div className="section-heading">
            <div><div className="eyebrow">EXPLORE THE ECOSYSTEM</div><h2>What brings you to AgriBridge?</h2><p>Start with what you grow, what you need, or how you move it.</p></div>
            <a className="text-link" href="#how-it-works">Explore the platform <ArrowRight size={16} /></a>
          </div>
          <div className="category-grid">
            {categories.map(({ name, detail, icon: Icon }) => (
              <a className="category-card" href="#how-it-works" key={name}>
                <span className="category-icon"><Icon size={22} /></span>
                <span className="category-copy"><b>{name}</b><small>{detail}</small></span>
                <ArrowUpRight className="category-arrow" size={18} />
              </a>
            ))}
          </div>
          <div className="search-panel">
            <div className="search-panel-copy"><Search size={19} /><span><b>Know what you are looking for?</b><small>Search and discovery tools will be available as the marketplace is built.</small></span></div>
            <button className="button button-outline" disabled>Marketplace coming soon <ChevronDown size={15} /></button>
          </div>
        </section>

        <section className="section how-section" id="how-it-works">
          <div className="how-intro"><div className="eyebrow">A MORE CONNECTED JOURNEY</div><h2>Good connections<br />move things forward.</h2><p>AgriBridge is being designed to make the journey between agricultural supply, demand and transportation easier to understand and coordinate.</p></div>
          <div className="steps">
            {steps.map((step) => <article className="step" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div><ArrowUpRight size={18} /></article>)}
          </div>
        </section>

        <section className="closing-cta" id="support">
          <div className="cta-icon"><CircleHelp size={23} /></div>
          <div><span className="eyebrow">BUILT FOR REAL-WORLD AGRICULTURE</span><h2>A better connection starts with a conversation.</h2><p>AgriBridge is under active development. The next step is building the secure tools behind this experience.</p></div>
          <a className="button button-light" href="mailto:hello@agribridge.in">Contact the team <ArrowUpRight size={16} /></a>
        </section>
      </main>

      <footer className="footer">
        <a className="brand brand-footer" href="#home"><span className="brand-mark"><Leaf size={19} /></span><span>Agri<span>Bridge</span></span></a>
        <p>Bridging agriculture and technology.</p>
        <span className="footer-note">© {new Date().getFullYear()} AgriBridge. Built with purpose.</span>
      </footer>
    </div>
  );
}

export default App;