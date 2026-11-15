import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type TransportProfile = { id: string; user_id: string; business_name: string; contact_phone: string; vehicle_types: string[]; service_areas: string[]; is_available: boolean; verification_status: string };
type TransportRequest = { id: string; requester_id: string; provider_id: string | null; pickup_location: string; delivery_location: string; cargo_description: string; quantity: number; unit: string; pickup_date: string | null; status: string };

export default function TransportWorkspace({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<TransportProfile | null>(null);
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    if (!supabase) return;
    const [p, r] = await Promise.all([
      supabase.from("transport_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("transport_requests").select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    if (p.error) setError(p.error.message); else setProfile(p.data as TransportProfile | null);
    if (r.error) setError(r.error.message); else setRequests((r.data ?? []) as TransportRequest[]);
  }
  useEffect(() => { void refresh(); }, [userId]);

  async function saveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const f = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const row = {
      user_id: userId, business_name: String(f.get("business_name")).trim(),
      contact_phone: String(f.get("contact_phone")).trim(),
      vehicle_types: String(f.get("vehicle_types")).split(",").map(x => x.trim()).filter(Boolean),
      service_areas: String(f.get("service_areas")).split(",").map(x => x.trim()).filter(Boolean),
      description: String(f.get("description") ?? "").trim()
    };
    const result = profile
      ? await supabase.from("transport_profiles").update(row).eq("id", profile.id)
      : await supabase.from("transport_profiles").insert(row);
    if (result.error) setError(result.error.message);
    else { setNotice("Transport provider profile saved. Verification is still pending."); await refresh(); }
    setBusy(false);
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const f = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await supabase.from("transport_requests").insert({
      requester_id: userId, pickup_location: String(f.get("pickup_location")).trim(),
      delivery_location: String(f.get("delivery_location")).trim(),
      cargo_description: String(f.get("cargo_description")).trim(),
      quantity: Number(f.get("quantity")), unit: String(f.get("unit")),
      pickup_date: String(f.get("pickup_date") || "") || null
    });
    if (e) setError(e.message); else { setNotice("Your transport request is visible to available providers."); event.currentTarget.reset(); await refresh(); }
    setBusy(false);
  }

  async function sendQuote(request: TransportRequest) {
    if (!supabase || !profile) return;
    const raw = window.prompt("Enter your transport quote in INR:");
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) { setError("Enter a valid non-negative amount."); return; }
    const message = window.prompt("Add a note (optional):") ?? "";
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await supabase.from("transport_quotes").insert({ request_id: request.id, provider_id: profile.id, quoted_amount: amount, message });
    if (e) setError(e.message); else setNotice("Your quote has been submitted.");
    setBusy(false);
  }

  return <section className="content-section standalone transport-workspace">
    <div className="content-heading"><div><span className="eyebrow">LOGISTICS NETWORK</span><h2>Transport coordination</h2><p>Connect cargo owners with transport providers. Quotes are proposals, not confirmed bookings.</p></div></div>
    {error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
    <div className="transport-grid">
      <form className="modal-card transport-form" onSubmit={createRequest}><h3>Request transport</h3><label>Pickup location<input name="pickup_location" required placeholder="Village, district, state"/></label><label>Delivery location<input name="delivery_location" required placeholder="Destination, district, state"/></label><label>Cargo / produce<input name="cargo_description" required placeholder="e.g. Wheat bags"/></label><div className="form-grid"><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" required/></label><label>Unit<select name="unit"><option>quintal</option><option>kg</option><option>tonne</option><option>bag</option><option>crate</option></select></label></div><label>Preferred pickup date<input name="pickup_date" type="date"/></label><button className="button button-primary" disabled={busy}>Post transport request</button></form>
      <form className="modal-card transport-form" onSubmit={saveProvider}><h3>{profile ? "Your provider profile" : "Register as a transport provider"}</h3><label>Business / provider name<input name="business_name" defaultValue={profile?.business_name ?? ""} required/></label><label>Contact phone<input name="contact_phone" defaultValue={profile?.contact_phone ?? ""} required/></label><label>Vehicle types (comma-separated)<input name="vehicle_types" defaultValue={profile?.vehicle_types.join(", ") ?? ""} placeholder="Truck, mini truck"/></label><label>Service areas (comma-separated)<input name="service_areas" defaultValue={profile?.service_areas.join(", ") ?? ""} placeholder="Agra, Mathura, Delhi"/></label><label>Additional details<textarea name="description" rows={2}/></label><p className="verification-note">Verification status: <b>{profile?.verification_status ?? "Not registered"}</b>. A profile is not an endorsement or identity verification.</p><button className="button button-primary" disabled={busy}>Save provider profile</button></form>
    </div>
    <div className="content-heading transport-heading"><div><span className="eyebrow">OPEN REQUESTS</span><h2>Transport opportunities</h2></div><button className="button button-outline" onClick={() => void refresh()}>Refresh</button></div>
    <div className="transport-request-list">{requests.map(request => <article className="transport-request" key={request.id}><div><b>{request.cargo_description}</b><span>{request.quantity} {request.unit} · {request.pickup_location} → {request.delivery_location}</span><small>Pickup: {request.pickup_date || "Date flexible"} · Status: {request.status}</small></div>{profile && request.requester_id !== userId && request.status === "open" && <button className="button button-primary small-button" disabled={busy} onClick={() => void sendQuote(request)}>Submit quote</button>}{request.requester_id === userId && <span className="status-pill">Your request</span>}</article>)}{requests.length === 0 && <div className="empty-inline">No transport requests have been posted yet.</div>}</div>
  </section>;
}
