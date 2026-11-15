import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

type PriceRow = {
  id: number;
  state: string;
  district: string | null;
  market: string;
  commodity: string;
  variety: string | null;
  grade?: string | null;
  arrival_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
  source_name: string;
  source_url?: string;
  fetched_at: string;
};

const formatPrice = (value: number | null) =>
  value == null ? "—" : "₹" + Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const formatDate = (value: string | null) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  }) : "Not available";

export default function MandiPrices() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("All");
  const [district, setDistrict] = useState("All");
  const [market, setMarket] = useState("All");
  const [commodity, setCommodity] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("mandi_prices")
      .select("id,state,district,market,commodity,variety,grade,arrival_date,min_price,max_price,modal_price,source_name,source_url,fetched_at")
      .order("arrival_date", { ascending: false })
      .limit(2000);
    if (loadError) {
      setError(loadError.message);
    } else {
      const loaded = (data ?? []) as PriceRow[];
      setRows(loaded);
      setLastLoaded(new Date().toISOString());
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const states = useMemo(() => ["All", ...Array.from(new Set(rows.map(x => x.state).filter(Boolean))).sort()], [rows]);
  const districts = useMemo(() => ["All", ...Array.from(new Set(rows
    .filter(x => state === "All" || x.state === state)
    .map(x => x.district).filter((x): x is string => Boolean(x)))).sort()], [rows, state]);
  const markets = useMemo(() => ["All", ...Array.from(new Set(rows
    .filter(x => (state === "All" || x.state === state) && (district === "All" || x.district === district))
    .map(x => x.market).filter(Boolean))).sort()], [rows, state, district]);
  const commodities = useMemo(() => ["All", ...Array.from(new Set(rows
    .filter(x => (state === "All" || x.state === state) && (district === "All" || x.district === district))
    .map(x => x.commodity).filter(Boolean))).sort()], [rows, state, district]);

  const filtered = useMemo(() => rows.filter(x =>
    (state === "All" || x.state === state) &&
    (district === "All" || x.district === district) &&
    (market === "All" || x.market === market) &&
    (commodity === "All" || x.commodity === commodity) &&
    [x.commodity, x.variety ?? "", x.grade ?? "", x.market, x.district ?? "", x.state]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ), [rows, state, district, market, commodity, query]);

  const latestDate = filtered.reduce<string | null>((latest, row) =>
    !latest || row.arrival_date > latest ? row.arrival_date : latest, null);
  const latestFetched = filtered.reduce<string | null>((latest, row) =>
    !latest || row.fetched_at > latest ? row.fetched_at : latest, null);
  const latestModal = filtered.find(x => x.arrival_date === latestDate && x.modal_price != null)?.modal_price ?? null;
  const averageModal = useMemo(() => {
    const values = filtered.filter(x => x.arrival_date === latestDate && x.modal_price != null)
      .map(x => Number(x.modal_price));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [filtered, latestDate]);
  const clearFilters = () => {
    setState("All"); setDistrict("All"); setMarket("All"); setCommodity("All"); setQuery("");
  };

  return <section className="content-section standalone">
    <div className="content-heading">
      <div>
        <span className="eyebrow">MARKET INTELLIGENCE</span>
        <h2>Daily mandi prices</h2>
        <p>Compare reported wholesale market observations by crop and location.</p>
      </div>
      <button className="button button-outline" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh data"}
      </button>
    </div>

    <div className="market-data-note">
      <b>Official source:</b> AGMARKNET data published through data.gov.in. Prices are reported daily observations in ₹ per quintal, not live bids or guaranteed transaction prices.
      {latestFetched && <span> Latest record fetched: {new Date(latestFetched).toLocaleString("en-IN")}</span>}
    </div>

    <div className="stat-grid mandi-stat-grid">
      <div className="stat-card"><span>Price observations</span><b>{filtered.length.toLocaleString("en-IN")}</b><small>Matching current filters</small></div>
      <div className="stat-card"><span>Latest report date</span><b>{formatDate(latestDate)}</b><small>Arrival / report date</small></div>
      <div className="stat-card"><span>Latest modal price</span><b>{formatPrice(latestModal)}</b><small>First matching latest observation</small></div>
      <div className="stat-card"><span>Average modal price</span><b>{formatPrice(averageModal)}</b><small>Latest date, filtered records</small></div>
    </div>

    <div className="filter-row mandi-filters">
      <div className="search-field"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search crop, variety, grade or market…" /></div>
      <select value={state} onChange={e => { setState(e.target.value); setDistrict("All"); setMarket("All"); }}><option value="All">All states</option>{states.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select>
      <select value={district} onChange={e => { setDistrict(e.target.value); setMarket("All"); }}><option value="All">All districts</option>{districts.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select>
      <select value={market} onChange={e => setMarket(e.target.value)}><option value="All">All markets</option>{markets.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select>
      <select value={commodity} onChange={e => setCommodity(e.target.value)}><option value="All">All commodities</option>{commodities.filter(x => x !== "All").map(x => <option key={x}>{x}</option>)}</select>
      <button className="button button-outline small-button" onClick={clearFilters}>Clear filters</button>
    </div>

    {loading ? <div className="empty-inline">Loading reported mandi prices…</div>
      : error ? <div className="alert alert-error">{error}</div>
      : filtered.length === 0 ? <div className="empty-state">
        <b>{rows.length === 0 ? "No mandi records have been imported yet" : "No prices match these filters"}</b>
        <span>{rows.length === 0
          ? "The daily data import must be configured and run before prices appear. No sample prices are shown as real data."
          : "Try clearing one or more filters to broaden your search."}</span>
        {rows.length > 0 && <button className="button button-outline small-button" onClick={clearFilters}>Clear filters</button>}
      </div>
      : <div className="mandi-table-wrap">
        <table className="mandi-table">
          <thead><tr><th>Commodity / variety</th><th>Market location</th><th>Min ₹/quintal</th><th>Max ₹/quintal</th><th>Modal ₹/quintal</th><th>Report date</th></tr></thead>
          <tbody>{filtered.map(x => <tr key={x.id}>
            <td><b>{x.commodity}</b><small>{[x.variety, x.grade].filter(Boolean).join(" · ") || "Variety not specified"}</small></td>
            <td>{x.market}<small>{[x.district, x.state].filter(Boolean).join(", ")}</small></td>
            <td>{formatPrice(x.min_price)}</td><td>{formatPrice(x.max_price)}</td><td><b>{formatPrice(x.modal_price)}</b></td>
            <td>{formatDate(x.arrival_date)}<small>Fetched {new Date(x.fetched_at).toLocaleString("en-IN")}</small></td>
          </tr>)}</tbody>
        </table>
      </div>}
    <p className="market-data-footnote">Showing up to 2,000 most recent records. Market prices can vary by quality, grade, arrivals, quantity and negotiation. Verify the latest local quote before trading.</p>
  </section>;
}
