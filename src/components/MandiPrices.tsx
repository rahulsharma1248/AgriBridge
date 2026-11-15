import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type PriceRow = { id: number; state: string; district: string | null; market: string; commodity: string; variety: string | null; arrival_date: string; min_price: number | null; max_price: number | null; modal_price: number | null; source_name: string; fetched_at: string };

export default function MandiPrices() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    if (!supabase) return;
    setLoading(true); setError("");
    const { data, error: e } = await supabase.from("mandi_prices").select("*").order("arrival_date", { ascending: false }).limit(500);
    if (e) setError(e.message); else setRows((data ?? []) as PriceRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  const states = useMemo(() => ["All", ...Array.from(new Set(rows.map(x => x.state))).sort()], [rows]);
  const filtered = useMemo(() => rows.filter(x =>
    (state === "All" || x.state === state) &&
    [x.commodity, x.variety ?? "", x.market, x.district ?? "", x.state].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [rows, state, query]);
  return <section className="content-section standalone">
    <div className="content-heading"><div><span className="eyebrow">MARKET INTELLIGENCE</span><h2>Mandi price reference</h2><p>Daily reported wholesale prices. Compare the report date before making a trade decision.</p></div><button className="button button-outline" onClick={() => void load()}>Refresh data</button></div>
    <div className="market-data-note">Source: AGMARKNET / data.gov.in · Prices are reported market observations, not guaranteed offers or real-time quotes.</div>
    <div className="filter-row"><div className="search-field"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search crop, variety, market or district…"/></div><select value={state} onChange={e => setState(e.target.value)}><option value="All">All states</option>{states.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select></div>
    {loading ? <div className="empty-inline">Loading market data…</div> : error ? <div className="alert alert-error">{error}</div> : filtered.length === 0 ? <div className="empty-state"><b>No market prices available yet</b><span>The market-price sync function must be configured and run before records appear.</span></div> : <div className="mandi-table-wrap"><table className="mandi-table"><thead><tr><th>Commodity / variety</th><th>Market</th><th>Min ₹/quintal</th><th>Max ₹/quintal</th><th>Modal ₹/quintal</th><th>Report date</th></tr></thead><tbody>{filtered.map(x => <tr key={x.id}><td><b>{x.commodity}</b><small>{x.variety || "Variety not specified"}</small></td><td>{x.market}<small>{[x.district,x.state].filter(Boolean).join(", ")}</small></td><td>{x.min_price?.toLocaleString("en-IN") ?? "—"}</td><td>{x.max_price?.toLocaleString("en-IN") ?? "—"}</td><td><b>{x.modal_price?.toLocaleString("en-IN") ?? "—"}</b></td><td>{new Date(x.arrival_date + "T00:00:00").toLocaleDateString("en-IN")}<small>Fetched {new Date(x.fetched_at).toLocaleString("en-IN")}</small></td></tr>)}</tbody></table></div>}
  </section>;
}
