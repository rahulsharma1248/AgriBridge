import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

type TransportProfile = {
  id: string; user_id: string; business_name: string; contact_phone: string;
  vehicle_types: string[]; service_areas: string[]; is_available: boolean; verification_status: string;
};
type TransportRequest = {
  id: string; requester_id: string; provider_id: string | null; pickup_location: string;
  delivery_location: string; cargo_description: string; quantity: number; unit: string;
  pickup_date: string | null; status: string; created_at: string;
};
type Quote = {
  id: string; request_id: string; provider_id: string; quoted_amount: number;
  message: string | null; status: string;
};
type TripLocation = { latitude: number; longitude: number; accuracy_m: number | null; recorded_at: string };

export default function TransportWorkspace({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<TransportProfile | null>(null);
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [locations, setLocations] = useState<Record<string, TripLocation>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  async function refresh() {
    if (!supabase) return;
    const [p, r] = await Promise.all([
      supabase.from("transport_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("transport_requests").select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    if (p.error) setError(p.error.message); else setProfile(p.data as TransportProfile | null);
    if (r.error) { setError(r.error.message); return; }
    const nextRequests = (r.data ?? []) as TransportRequest[];
    setRequests(nextRequests);
    if (nextRequests.length) {
      const { data, error: quoteError } = await supabase.from("transport_quotes")
        .select("*").in("request_id", nextRequests.map(x => x.id)).order("created_at", { ascending: false });
      if (quoteError) setError(quoteError.message); else setQuotes((data ?? []) as Quote[]);
      const activeIds = nextRequests.filter(x => x.status === "accepted" || x.status === "in_transit").map(x => x.id);
      if (activeIds.length) {
        const { data: points, error: locationError } = await supabase.from("transport_locations")
          .select("request_id,latitude,longitude,accuracy_m,recorded_at")
          .in("request_id", activeIds).order("recorded_at", { ascending: false });
        if (locationError && !locationError.message.includes("transport_locations")) setError(locationError.message);
        else {
          const latest: Record<string, TripLocation> = {};
          for (const point of points ?? []) if (!latest[point.request_id]) latest[point.request_id] = point;
          setLocations(latest);
        }
      }
    } else { setQuotes([]); setLocations({}); }
  }

  useEffect(() => { void refresh(); }, [userId]);
  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

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
    else { setNotice("Your logistics profile is saved. It is not verified yet; complete verification before accepting real deliveries."); await refresh(); }
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
    if (e) setError(e.message); else { setNotice("Your transport request has been posted to available logistics providers."); event.currentTarget.reset(); await refresh(); }
    setBusy(false);
  }

  async function sendQuote(request: TransportRequest) {
    if (!supabase || !profile) return;
    const raw = window.prompt("Enter your transport quote in INR:");
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Enter a valid amount greater than zero."); return; }
    const message = window.prompt("Add a note (optional):") ?? "";
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await supabase.from("transport_quotes").insert({
      request_id: request.id, provider_id: profile.id, quoted_amount: amount, message
    });
    if (e) setError(e.message); else { setNotice("Your quote has been sent to the requester."); await refresh(); }
    setBusy(false);
  }

  async function decideQuote(quote: Quote, decision: "accepted" | "declined") {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    if (decision === "accepted") {
      const { error: requestError } = await supabase.from("transport_requests")
        .update({ provider_id: quote.provider_id, status: "accepted" })
        .eq("id", quote.request_id).eq("requester_id", userId).eq("status", "open");
      if (requestError) { setError(requestError.message); setBusy(false); return; }
    }
    const { error: quoteError } = await supabase.from("transport_quotes")
      .update({ status: decision }).eq("id", quote.id);
    if (quoteError) setError(quoteError.message);
    else setNotice(decision === "accepted" ? "Quote accepted. The provider can now start the trip and share location." : "Quote declined.");
    await refresh(); setBusy(false);
  }

  async function updateTripStatus(request: TransportRequest, status: "in_transit" | "delivered") {
    if (!supabase) return;
    setBusy(true); setError(""); setNotice("");
    const { error: e } = await supabase.from("transport_requests").update({ status }).eq("id", request.id);
    if (e) setError(e.message); else { setNotice(status === "in_transit" ? "Delivery marked in transit." : "Delivery marked delivered."); await refresh(); }
    setBusy(false);
  }

  function startTracking(request: TransportRequest) {
    if (!supabase || !profile) return;
    if (!("geolocation" in navigator)) { setError("This browser does not support location sharing."); return; }
    if (!window.isSecureContext) { setError("Live location requires a secure HTTPS connection."); return; }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setError(""); setNotice("Allow location access when your browser asks. Keep this page open while sharing your trip.");
    setTrackingId(request.id);
    watchId.current = navigator.geolocation.watchPosition(async position => {
      const point = {
        request_id: request.id, provider_id: profile.id,
        latitude: position.coords.latitude, longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy
      };
      const { error: e } = await supabase!.from("transport_locations").insert(point);
      if (e) setError("Could not publish live location: " + e.message);
      else setLocations(current => ({ ...current, [request.id]: {
        latitude: point.latitude, longitude: point.longitude,
        accuracy_m: point.accuracy_m, recorded_at: new Date().toISOString()
      }}));
    }, geoError => {
      setError("Location sharing failed: " + geoError.message);
      stopTracking();
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }

  function stopTracking() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null; setTrackingId(null);
    setNotice("Live location sharing stopped.");
  }

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("agribridge-trip-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transport_locations" }, payload => {
        const point = payload.new as TripLocation & { request_id: string };
        setLocations(current => ({ ...current, [point.request_id]: point }));
      }).subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, []);

  const ownRequests = requests.filter(x => x.requester_id === userId);
  const providerRequests = requests.filter(x => profile && x.provider_id === profile.id);
  const openRequests = requests.filter(x => x.status === "open" && x.requester_id !== userId);

  return <section className="content-section standalone transport-workspace">
    <div className="content-heading"><div><span className="eyebrow">THREE-SIDED MARKETPLACE</span><h2>Logistics & transport</h2><p>Buyers and sellers can request deliveries. Logistics businesses can register, receive requests and share trip locations.</p></div></div>
    {error && <div className="alert alert-error">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
    <div className="transport-grid">
      <form className="modal-card transport-form" onSubmit={createRequest}>
        <h3>Find transport</h3><p className="form-intro">Post your pickup and delivery details. Registered providers can send you quotes.</p>
        <label>Pickup location<input name="pickup_location" required placeholder="Village, district, state"/></label>
        <label>Delivery location<input name="delivery_location" required placeholder="Destination, district, state"/></label>
        <label>Cargo / produce<input name="cargo_description" required placeholder="e.g. Wheat bags"/></label>
        <div className="form-grid"><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" required/></label><label>Unit<select name="unit"><option>quintal</option><option>kg</option><option>tonne</option><option>bag</option><option>crate</option></select></label></div>
        <label>Preferred pickup date<input name="pickup_date" type="date"/></label>
        <button className="button button-primary" disabled={busy}>Post transport request</button>
      </form>
      <form className="modal-card transport-form" onSubmit={saveProvider}>
        <h3>{profile ? "Your logistics business" : "Register as a logistics provider"}</h3>
        <p className="form-intro">Use your existing AgriBridge account. Add your business details so customers can request your vehicles. You can also remain a buyer or seller.</p>
        <label>Business / provider name<input name="business_name" defaultValue={profile?.business_name ?? ""} required/></label>
        <label>Contact phone<input name="contact_phone" type="tel" defaultValue={profile?.contact_phone ?? ""} required/></label>
        <label>Vehicle types<input name="vehicle_types" defaultValue={profile?.vehicle_types.join(", ") ?? ""} placeholder="Truck, mini truck, tractor" required/></label>
        <label>Service areas<input name="service_areas" defaultValue={profile?.service_areas.join(", ") ?? ""} placeholder="Agra, Mathura, Delhi" required/></label>
        <label>Additional details<textarea name="description" rows={2}/></label>
        <p className="verification-note">Provider status: <b>{profile?.verification_status ?? "Not registered"}</b>. Listing a business does not mean identity or vehicle documents have been verified.</p>
        <button className="button button-primary" disabled={busy}>{profile ? "Update logistics profile" : "Register logistics business"}</button>
      </form>
    </div>

    <div className="content-heading transport-heading"><div><span className="eyebrow">PROVIDER MARKETPLACE</span><h2>Open delivery requests</h2></div><button className="button button-outline" onClick={() => void refresh()}>Refresh</button></div>
    <div className="transport-request-list">
      {openRequests.map(request => <article className="transport-request" key={request.id}>
        <div><b>{request.cargo_description}</b><span>{request.quantity} {request.unit} · {request.pickup_location} → {request.delivery_location}</span><small>Pickup: {request.pickup_date || "Date flexible"}</small></div>
        {profile && <button className="button button-primary small-button" disabled={busy} onClick={() => void sendQuote(request)}>Send quote</button>}
      </article>)}
      {openRequests.length === 0 && <div className="empty-inline">No open requests available right now.</div>}
    </div>

    <div className="content-heading transport-heading"><div><span className="eyebrow">YOUR DELIVERIES</span><h2>Requests and quotes</h2></div></div>
    <div className="transport-request-list">
      {ownRequests.map(request => <article className="transport-request" key={request.id}>
        <div><b>{request.cargo_description}</b><span>{request.pickup_location} → {request.delivery_location} · {request.quantity} {request.unit}</span><small>Status: {request.status}</small>
          {quotes.filter(q => q.request_id === request.id).map(q => <div className="transport-quote" key={q.id}><span>Quote: <b>₹{Number(q.quoted_amount).toLocaleString("en-IN")}</b> · {q.message || "No note"} · {q.status}</span>{request.status === "open" && q.status === "pending" && <span><button className="button button-primary small-button" disabled={busy} onClick={() => void decideQuote(q, "accepted")}>Accept quote</button> <button className="button button-outline small-button" disabled={busy} onClick={() => void decideQuote(q, "declined")}>Decline</button></span>}</div>)}
          {(request.status === "accepted" || request.status === "in_transit") && locations[request.id] && <p className="verification-note">Latest driver location: {locations[request.id].latitude.toFixed(5)}, {locations[request.id].longitude.toFixed(5)} · {new Date(locations[request.id].recorded_at).toLocaleTimeString("en-IN")} · <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${locations[request.id].latitude},${locations[request.id].longitude}`}>View on map</a></p>}
        </div>
      </article>)}
      {ownRequests.length === 0 && <div className="empty-inline">You have not posted a transport request yet.</div>}
    </div>

    {profile && <><div className="content-heading transport-heading"><div><span className="eyebrow">PROVIDER WORKSPACE</span><h2>Assigned deliveries</h2></div></div>
      <div className="transport-request-list">{providerRequests.map(request => <article className="transport-request" key={request.id}>
        <div><b>{request.cargo_description}</b><span>{request.pickup_location} → {request.delivery_location}</span><small>Delivery status: {request.status}</small></div>
        {request.status === "accepted" && <button className="button button-primary small-button" disabled={busy} onClick={() => void updateTripStatus(request, "in_transit")}>Start delivery</button>}
        {request.status === "in_transit" && <><button className="button button-outline small-button" disabled={busy} onClick={() => trackingId === request.id ? stopTracking() : startTracking(request)}>{trackingId === request.id ? "Stop sharing location" : "Share live location"}</button><button className="button button-primary small-button" disabled={busy} onClick={() => void updateTripStatus(request, "delivered")}>Mark delivered</button></>}
      </article>)}
      {providerRequests.length === 0 && <div className="empty-inline">No deliveries have been assigned to your provider account yet.</div>}</div>
    </>}
    <p className="market-data-footnote">Live location is shared only after the provider explicitly starts it and grants browser location permission. The provider must keep this page open; this is not background GPS tracking. Provider verification is not currently performed by AgriBridge.</p>
  </section>;
}
