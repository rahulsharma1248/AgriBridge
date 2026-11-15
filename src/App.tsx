import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, CircleAlert, Leaf, LogOut, Package, Plus, Search, ShieldCheck, Sprout, Truck, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import TransportWorkspace from "./components/TransportWorkspace";
import MandiPrices from "./components/MandiPrices";

type Profile = { id: string; full_name: string | null; account_type: "buyer" | "seller" | "both" };
type Listing = { id: string; seller_id: string; produce_name: string; category: string | null; description: string | null; quantity: number; unit: string; asking_price: number | null; location: string; available_from: string | null; status: string; created_at: string; listing_images?: { object_path: string }[] };
type Requirement = { id: string; buyer_id: string; produce_name: string; category: string | null; description: string | null; quantity: number; unit: string; delivery_location: string; needed_by: string | null; status: string; created_at: string };
type Enquiry = { id: string; listing_id: string; buyer_id: string; seller_id: string; message: string; status: string; created_at: string };

const money = (value: number | null) => value == null ? "Price on discussion" : "₹" + Number(value).toLocaleString("en-IN");
const dateLabel = (value: string | null) => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not specified";

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("market");
  const [listings, setListings] = useState<Listing[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showListingForm, setShowListingForm] = useState(false);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [enquiryTarget, setEnquiryTarget] = useState<Listing | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    if (!supabase) return;
    const [p, l, r, e] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("produce_listings").select("*, listing_images(object_path)").order("created_at", { ascending: false }),
      supabase.from("buyer_requirements").select("*").order("created_at", { ascending: false }),
      supabase.from("enquiries").select("*").order("created_at", { ascending: false })
    ]);
    if (p.error) setError(p.error.message);
    if (p.data) setProfile(p.data as Profile);
    if (l.error) setError(l.error.message); else setListings((l.data ?? []) as Listing[]);
    if (r.error) setError(r.error.message); else setRequirements((r.data ?? []) as Requirement[]);
    if (e.error) setError(e.error.message); else setEnquiries((e.data ?? []) as Enquiry[]);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void loadData(data.session.user.id);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        window.setTimeout(() => void loadData(nextSession.user.id), 0);
      } else {
        setProfile(null); setListings([]); setRequirements([]); setEnquiries([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  const filteredListings = useMemo(() => listings.filter((item) =>
    item.status === "published" &&
    (categoryFilter === "All" || item.category === categoryFilter) &&
    (item.produce_name + " " + (item.location ?? "") + " " + (item.description ?? "")).toLowerCase().includes(search.toLowerCase())
  ), [listings, search, categoryFilter]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    setError(""); setNotice(""); setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      if (authMode === "signup") {
        const full_name = String(form.get("full_name") ?? "").trim();
        const account_type = String(form.get("account_type") ?? "buyer");
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name, account_type } } });
        if (authError) throw authError;
        if (data.session) {
          await supabase.from("profiles").update({ full_name, account_type }).eq("id", data.user!.id);
          setNotice("Your account has been created.");
        } else {
          setNotice("Check your email for the confirmation link. After confirming, return here and log in.");
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const metadata = data.user.user_metadata ?? {};
        const accountType = metadata.account_type;
        if (accountType === "buyer" || accountType === "seller" || accountType === "both") {
          const { error: profileError } = await supabase.from("profiles").update({
            full_name: String(metadata.full_name ?? ""),
            account_type: accountType
          }).eq("id", data.user.id);
          if (profileError) throw profileError;
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function signOut() { if (supabase) await supabase.auth.signOut(); setTab("market"); }

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user) return;
    setError(""); setNotice("");
    const f = new FormData(event.currentTarget);
    const row = { seller_id: session.user.id, produce_name: String(f.get("produce_name")).trim(), category: String(f.get("category")), description: String(f.get("description") ?? "").trim(), quantity: Number(f.get("quantity")), unit: String(f.get("unit")), asking_price: f.get("asking_price") ? Number(f.get("asking_price")) : null, location: String(f.get("location")).trim(), available_from: String(f.get("available_from") || "") || null, status: "published" };
    const { data: createdListing, error: insertError } = await supabase.from("produce_listings").insert(row).select("id").single();
    if (insertError) { setError(insertError.message); return; }
    const photos = Array.from((f.get("photos") as FileList | null) ?? []).filter(file => file.size > 0);
    for (const photo of photos) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5 * 1024 * 1024) {
        setError("Photos must be JPG, PNG or WebP files under 5 MB each."); return;
      }
      const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
      const objectPath = session.user.id + "/" + createdListing.id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("produce-images").upload(objectPath, photo, { contentType: photo.type, upsert: false });
      if (uploadError) { setError("Listing was created, but a photo failed to upload: " + uploadError.message); return; }
      const { error: imageRowError } = await supabase.from("listing_images").insert({ listing_id: createdListing.id, owner_id: session.user.id, object_path: objectPath });
      if (imageRowError) { setError("Photo uploaded, but its listing record failed: " + imageRowError.message); return; }
    }
    setNotice("Your produce listing is now published."); setShowListingForm(false); await loadData(session.user.id);
  }

  async function createRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user) return;
    setError(""); setNotice("");
    const f = new FormData(event.currentTarget);
    const row = { buyer_id: session.user.id, produce_name: String(f.get("produce_name")).trim(), category: String(f.get("category")), description: String(f.get("description") ?? "").trim(), quantity: Number(f.get("quantity")), unit: String(f.get("unit")), delivery_location: String(f.get("delivery_location")).trim(), needed_by: String(f.get("needed_by") || "") || null, status: "published" };
    const { error: insertError } = await supabase.from("buyer_requirements").insert(row);
    if (insertError) setError(insertError.message); else { setNotice("Your buying requirement is now published."); setShowRequirementForm(false); await loadData(session.user.id); }
  }

  async function sendEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user || !enquiryTarget) return;
    const f = new FormData(event.currentTarget);
    const { error: insertError } = await supabase.from("enquiries").insert({ listing_id: enquiryTarget.id, buyer_id: session.user.id, seller_id: enquiryTarget.seller_id, message: String(f.get("message")).trim() });
    if (insertError) setError(insertError.message); else { setNotice("Your enquiry has been sent to the seller."); setEnquiryTarget(null); await loadData(session.user.id); }
  }

  async function analyzeProduce(item: Listing) {
    if (!supabase || !item.listing_images?.[0]) return;
    setAiBusyId(item.id); setError(""); setNotice("");
    const { data, error: invokeError } = await supabase.functions.invoke("analyze-produce", {
      body: { imagePath: item.listing_images[0].object_path, listingId: item.id }
    });
    if (invokeError) setError(invokeError.message);
    else if (data?.analysis) {
      const a = data.analysis as Record<string, unknown>;
      setNotice("AI visual observations (advisory only): " + JSON.stringify(a));
    } else setError(data?.error ?? "AI analysis did not return a result.");
    setAiBusyId(null);
  }

  async function updateListingStatus(item: Listing, status: string) {
    if (!supabase || !session?.user) return;
    const { error: updateError } = await supabase.from("produce_listings").update({ status }).eq("id", item.id);
    if (updateError) setError(updateError.message); else { setNotice("Listing updated."); await loadData(session.user.id); }
  }

  if (!isSupabaseConfigured) return <div className="config-screen"><div className="auth-brand"><span className="brand-mark"><Leaf /></span> AgriBridge</div><div className="auth-card"><CircleAlert size={30} /><h1>Supabase connection needed</h1><p>The website code is ready to connect, but its hosting environment still needs the Supabase Project URL and publishable key.</p><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your Cloudflare Pages environment variables, then redeploy.</p></div></div>;

  if (loading) return <div className="loading-screen"><div className="loader" /><span>Loading AgriBridge…</span></div>;

  if (!session) return (
    <div className="auth-screen">
      <div className="auth-side"><a className="brand auth-brand" href="#"><span className="brand-mark"><Leaf /></span><span>Agri<span>Bridge</span></span></a><div className="auth-message"><span className="eyebrow">AGRICULTURE, CONNECTED</span><h1>Better connections.<br /><em>Stronger harvests.</em></h1><p>Discover produce, share what you grow and connect directly with agricultural buyers and sellers.</p><div className="auth-points"><span><ShieldCheck size={17} /> Secure account access</span><span><Sprout size={17} /> A marketplace built for agriculture</span><span><Truck size={17} /> Clearer coordination</span></div></div><small className="auth-foot">AgriBridge · Bridging agriculture and technology</small></div>
      <div className="auth-main"><form className="auth-card" onSubmit={handleAuth}><div className="auth-mobile-brand"><Leaf size={21} /> AgriBridge</div><span className="eyebrow">{authMode === "signup" ? "JOIN THE AGRIBRIDGE COMMUNITY" : "WELCOME BACK"}</span><h2>{authMode === "signup" ? "Create your account" : "Log in to AgriBridge"}</h2><p className="form-intro">{authMode === "signup" ? "Get started with a free account." : "Enter your details to continue."}</p>
        {authMode === "signup" && <><label>Full name<input name="full_name" autoComplete="name" placeholder="Your full name" required /></label><label>I want to join as<select name="account_type"><option value="buyer">Buyer</option><option value="seller">Seller / Farmer</option><option value="both">Both buyer and seller</option></select></label></>}
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" minLength={6} autoComplete={authMode === "signup" ? "new-password" : "current-password"} placeholder="At least 6 characters" required /></label>
        {error && <div className="alert alert-error"><CircleAlert size={16} />{error}</div>}{notice && <div className="alert alert-success"><CheckCircle2 size={16} />{notice}</div>}
        <button className="button button-primary auth-submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signup" ? "Create account" : "Log in"} <ArrowRight size={17} /></button><p className="auth-switch">{authMode === "signup" ? "Already have an account?" : "New to AgriBridge?"} <button type="button" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setError(""); setNotice(""); }}>{authMode === "signup" ? "Log in" : "Create account"}</button></p><p className="privacy-note"><ShieldCheck size={13} /> Your account is protected by Supabase authentication and database access policies.</p></form></div>
    </div>
  );

  const name = profile?.full_name || session.user.email?.split("@")[0] || "Member";
  const myListings = listings.filter(x => x.seller_id === session.user.id);
  const myRequirements = requirements.filter(x => x.buyer_id === session.user.id);
  const myEnquiries = enquiries.filter(x => x.buyer_id === session.user.id || x.seller_id === session.user.id);

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand sidebar-brand" href="#"><span className="brand-mark"><Leaf /></span><span>Agri<span>Bridge</span></span></a><div className="side-label">WORKSPACE</div><button className={tab === "market" ? "side-link active" : "side-link"} onClick={() => setTab("market")}><Search size={18} /> Explore marketplace</button><button className={tab === "listings" ? "side-link active" : "side-link"} onClick={() => setTab("listings")}><Package size={18} /> My produce listings</button><button className={tab === "requirements" ? "side-link active" : "side-link"} onClick={() => setTab("requirements")}><Sprout size={18} /> My requirements</button><button className={tab === "enquiries" ? "side-link active" : "side-link"} onClick={() => setTab("enquiries")}><BadgeCheck size={18} /> My enquiries</button><button className={tab === "transport" ? "side-link active" : "side-link"} onClick={() => setTab("transport")}><Truck size={18} /> Transport network</button><button className={tab === "prices" ? "side-link active" : "side-link"} onClick={() => setTab("prices")}><BadgeCheck size={18} /> Mandi prices</button><div className="sidebar-bottom"><div className="sidebar-help"><ShieldCheck size={18} /><span><b>Built for clearer trade</b><small>Your data is protected by access policies.</small></span></div><div className="user-block"><span className="avatar">{name.charAt(0).toUpperCase()}</span><span className="user-meta"><b>{name}</b><small>{profile?.account_type ?? "member"}</small></span><button className="icon-button" onClick={signOut} title="Log out"><LogOut size={17} /></button></div></div></aside>
    <main className="workspace"><header className="workspace-top"><div><span className="workspace-kicker">AGRIBRIDGE WORKSPACE</span><h1>{tab === "market" ? "Explore marketplace" : tab === "listings" ? "My produce listings" : tab === "requirements" ? "My buying requirements" : tab === "transport" ? "Transport network" : tab === "prices" ? "Mandi prices" : "My enquiries"}</h1></div><div className="top-user"><span className="avatar">{name.charAt(0).toUpperCase()}</span><span>{name}</span><button className="icon-button" onClick={signOut} title="Log out"><LogOut size={17} /></button></div></header>
      {error && <div className="alert alert-error workspace-alert"><CircleAlert size={16} />{error}<button onClick={() => setError("")}>Dismiss</button></div>}{notice && <div className="alert alert-success workspace-alert"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
      {tab === "market" && <><section className="welcome-banner"><div><span className="eyebrow">YOUR AGRICULTURAL NETWORK</span><h2>Good morning, {name.split(" ")[0]}.</h2><p>Find produce, explore supply and connect with people across the agricultural value chain.</p></div><div className="welcome-art"><Sprout size={70} strokeWidth={1.1} /></div></section><div className="stat-grid"><div className="stat-card"><span>Published produce</span><b>{listings.filter(x => x.status === "published").length}</b><small>Available in the marketplace</small></div><div className="stat-card"><span>Buying requirements</span><b>{requirements.filter(x => x.status === "published").length}</b><small>Active buyer needs</small></div><div className="stat-card"><span>Your conversations</span><b>{myEnquiries.length}</b><small>Enquiries you are part of</small></div></div><section className="content-section"><div className="content-heading"><div><span className="eyebrow">DISCOVER OPPORTUNITIES</span><h2>Available produce</h2><p>Explore published offers from sellers.</p></div><button className="button button-primary" onClick={() => setShowListingForm(true)}><Plus size={17} /> List produce</button></div><div className="filter-row"><div className="search-field"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search produce or location…" /></div><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>All</option><option>Grains & cereals</option><option>Fruits</option><option>Vegetables</option><option>Pulses</option><option>Other</option></select></div><div className="listing-grid">{filteredListings.map(item => <article className="produce-card" key={item.id}>{item.listing_images?.[0] && <img className="produce-photo" src={supabase!.storage.from("produce-images").getPublicUrl(item.listing_images[0].object_path).data.publicUrl} alt={item.produce_name} loading="lazy" />}<div className="produce-card-top"><span className="category-pill">{item.category || "Produce"}</span><span className="status-pill">{item.status}</span></div><h3>{item.produce_name}</h3><p className="produce-description">{item.description || "Contact the seller for more information about this produce."}</p><div className="produce-facts"><span><Package size={15} /> {Number(item.quantity).toLocaleString("en-IN")} {item.unit}</span><span>⌖ {item.location}</span><span>Available: {dateLabel(item.available_from)}</span></div><div className="produce-card-bottom"><b>{money(item.asking_price)}</b>{item.seller_id === session.user.id ? <><button className="button button-outline small-button" onClick={() => updateListingStatus(item, "closed")}>Close listing</button>{item.listing_images?.[0] && <button className="button button-outline small-button" disabled={aiBusyId === item.id} onClick={() => void analyzeProduce(item)}>{aiBusyId === item.id ? "Analysing…" : "AI photo check"}</button>}</> : <button className="button button-primary small-button" onClick={() => setEnquiryTarget(item)}>Contact seller <ArrowRight size={14} /></button>}</div></article>)}{filteredListings.length === 0 && <div className="empty-state"><Package size={27} /><b>No published produce found</b><span>Try another search or be the first to list produce.</span><button className="button button-outline small-button" onClick={() => setShowListingForm(true)}>Create a listing</button></div>}</div></section><section className="content-section"><div className="content-heading"><div><span className="eyebrow">BUYER DEMAND</span><h2>What buyers are looking for</h2><p>Published requirements from buyers.</p></div><button className="button button-outline" onClick={() => setShowRequirementForm(true)}><Plus size={16} /> Post requirement</button></div><div className="requirement-list">{requirements.filter(x => x.status === "published").map(item => <div className="requirement-row" key={item.id}><div className="requirement-icon"><Sprout size={19} /></div><div className="requirement-main"><b>{item.produce_name}</b><span>{Number(item.quantity).toLocaleString("en-IN")} {item.unit} · Delivery: {item.delivery_location}</span></div><div className="requirement-side"><b>{item.category || "Produce"}</b><small>Needed by {dateLabel(item.needed_by)}</small></div></div>)}{requirements.filter(x => x.status === "published").length === 0 && <div className="empty-inline">No buyer requirements have been published yet.</div>}</div></section></>}
      {tab === "listings" && <section className="content-section standalone"><div className="content-heading"><div><span className="eyebrow">SELLER WORKSPACE</span><h2>Manage your produce</h2><p>Create and manage your published produce offers.</p></div><button className="button button-primary" onClick={() => setShowListingForm(true)}><Plus size={17} /> New listing</button></div><div className="listing-grid">{myListings.map(item => <article className="produce-card" key={item.id}><div className="produce-card-top"><span className="category-pill">{item.category || "Produce"}</span><span className="status-pill">{item.status}</span></div><h3>{item.produce_name}</h3><p className="produce-description">{item.description || "No description added."}</p><div className="produce-facts"><span>{Number(item.quantity).toLocaleString("en-IN")} {item.unit}</span><span>{item.location}</span></div><div className="produce-card-bottom"><b>{money(item.asking_price)}</b>{item.status !== "closed" && <button className="button button-outline small-button" onClick={() => updateListingStatus(item, item.status === "published" ? "paused" : "published")}>{item.status === "published" ? "Pause listing" : "Publish listing"}</button>}</div></article>)}{myListings.length === 0 && <div className="empty-state"><Package size={27} /><b>You have not listed produce yet</b><span>Create your first offer to make it visible to buyers.</span><button className="button button-primary small-button" onClick={() => setShowListingForm(true)}>Create listing</button></div>}</div></section>}
      {tab === "requirements" && <section className="content-section standalone"><div className="content-heading"><div><span className="eyebrow">BUYER WORKSPACE</span><h2>Your buying requirements</h2><p>Tell sellers what produce you need.</p></div><button className="button button-primary" onClick={() => setShowRequirementForm(true)}><Plus size={17} /> New requirement</button></div><div className="requirement-list">{myRequirements.map(item => <div className="requirement-row" key={item.id}><div className="requirement-icon"><Sprout size={19} /></div><div className="requirement-main"><b>{item.produce_name} <span className="status-pill">{item.status}</span></b><span>{Number(item.quantity).toLocaleString("en-IN")} {item.unit} · Delivery: {item.delivery_location}</span></div><div className="requirement-side"><b>{item.category || "Produce"}</b><small>Needed by {dateLabel(item.needed_by)}</small></div></div>)}{myRequirements.length === 0 && <div className="empty-state"><Sprout size={27} /><b>No requirements yet</b><span>Post what you need and make your demand visible.</span><button className="button button-primary small-button" onClick={() => setShowRequirementForm(true)}>Post requirement</button></div>}</div></section>}
      {tab === "enquiries" && <section className="content-section standalone"><div className="content-heading"><div><span className="eyebrow">CONVERSATIONS</span><h2>Your enquiries</h2><p>Enquiries you have sent or received.</p></div></div><div className="enquiry-list">{myEnquiries.map(item => <article className="enquiry-card" key={item.id}><div><span className="status-pill">{item.status}</span><b>{item.buyer_id === session.user.id ? "Enquiry sent" : "Enquiry received"}</b></div><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("en-IN")}</small></article>)}{myEnquiries.length === 0 && <div className="empty-state"><BadgeCheck size={27} /><b>No enquiries yet</b><span>Contact a seller from a produce listing to start a conversation.</span></div>}</div></section>}
      {tab === "transport" && <TransportWorkspace userId={session.user.id} />}
      {tab === "prices" && <MandiPrices />}
    </main>
    {showListingForm && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowListingForm(false); }}><form className="modal-card" onSubmit={createListing}><div className="modal-heading"><div><span className="eyebrow">SELLER FORM</span><h2>List your produce</h2></div><button type="button" className="icon-button" onClick={() => setShowListingForm(false)}><X /></button></div><label>Produce name<input name="produce_name" placeholder="e.g. Sharbati wheat" required /></label><div className="form-grid"><label>Category<select name="category"><option>Grains & cereals</option><option>Fruits</option><option>Vegetables</option><option>Pulses</option><option>Other</option></select></label><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" placeholder="e.g. 500" required /></label></div><div className="form-grid"><label>Unit<select name="unit"><option>kg</option><option>quintal</option><option>tonne</option><option>crate</option><option>bag</option></select></label><label>Asking price (₹, optional)<input name="asking_price" type="number" min="0" step="0.01" placeholder="Leave blank to discuss" /></label></div><label>Location<input name="location" placeholder="Village, district, state" required /></label><label>Available from<input name="available_from" type="date" /></label><label>Description<textarea name="description" rows={3} placeholder="Quality, harvest details, packaging or other useful information" /></label><label>Produce photos (JPG, PNG or WebP; max 5 MB each)<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowListingForm(false)}>Cancel</button><button className="button button-primary">Publish listing <ArrowRight size={15} /></button></div></form></div>}
    {showRequirementForm && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowRequirementForm(false); }}><form className="modal-card" onSubmit={createRequirement}><div className="modal-heading"><div><span className="eyebrow">BUYER FORM</span><h2>Post a buying requirement</h2></div><button type="button" className="icon-button" onClick={() => setShowRequirementForm(false)}><X /></button></div><label>Produce needed<input name="produce_name" placeholder="e.g. Basmati rice" required /></label><div className="form-grid"><label>Category<select name="category"><option>Grains & cereals</option><option>Fruits</option><option>Vegetables</option><option>Pulses</option><option>Other</option></select></label><label>Quantity<input name="quantity" type="number" min="0.01" step="0.01" required /></label></div><div className="form-grid"><label>Unit<select name="unit"><option>kg</option><option>quintal</option><option>tonne</option><option>crate</option><option>bag</option></select></label><label>Needed by<input name="needed_by" type="date" /></label></div><label>Delivery location<input name="delivery_location" placeholder="City, district, state" required /></label><label>Additional details<textarea name="description" rows={3} placeholder="Specifications, quality expectations or packaging" /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowRequirementForm(false)}>Cancel</button><button className="button button-primary">Publish requirement <ArrowRight size={15} /></button></div></form></div>}
    {enquiryTarget && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setEnquiryTarget(null); }}><form className="modal-card" onSubmit={sendEnquiry}><div className="modal-heading"><div><span className="eyebrow">CONTACT THE SELLER</span><h2>Enquire about {enquiryTarget.produce_name}</h2></div><button type="button" className="icon-button" onClick={() => setEnquiryTarget(null)}><X /></button></div><p className="form-intro">Your message will be visible to the seller and you in My enquiries.</p><label>Message<textarea name="message" rows={5} maxLength={3000} required placeholder="Hello, I am interested in this produce. Please share more details…" /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setEnquiryTarget(null)}>Cancel</button><button className="button button-primary">Send enquiry <ArrowRight size={15} /></button></div></form></div>}
  </div>;
}

export default App;
