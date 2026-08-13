"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Shield, Plus, X, Calendar, Wallet, MapPin, Settings, ChevronLeft, ChevronRight, Car, Users, Ban, Trash2, Check, Pencil, LogOut, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS = ["L","M","M","J","V","S","D"];

const STATUS = {};
const TRANSPORT = {
  conducteur: { label: "Conducteur", icon: Car },
  passager: { label: "Passager", icon: Users },
  aucun: { label: "Aucun", icon: Ban },
};

const C = {
  bg: "#121317", panel: "#1B1D22", panelAlt: "#202228", elevated: "#26282F",
  border: "#3A3C46", borderSoft: "#2A2C34",
  red: "#EA2630", redDim: "rgba(234,38,48,0.16)",
  amber: "#F7B500", amberDim: "rgba(247,181,0,0.16)",
  text: "#F8F8F7", textMid: "#C7C9D1", textDim: "#9497A3",
};

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtEUR(n) { return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n || 0); }
function toHHMM(t) { return t ? t.slice(0, 5) : ""; }
function hoursBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

export default function ShiftCtrlApp({ userEmail }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("calendrier");
  const [sites, setSites] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [notes, setNotes] = useState([]);
  const [rates, setRates] = useState({ taux_jour: 14, taux_nuit: 17, prime: 19 });
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [quickAddDate, setQuickAddDate] = useState(null);
  const [modalDate, setModalDate] = useState(null);
  const [editShift, setEditShift] = useState(null);
  const [siteFormOpen, setSiteFormOpen] = useState(false);
  const [editSite, setEditSite] = useState(null);
  const [noteModalDate, setNoteModalDate] = useState(null);
  const [editNote, setEditNote] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [userId, setUserId] = useState(null);

  const flash = (msg) => { setErrMsg(msg); setTimeout(() => setErrMsg(""), 12000); };
  const flashOk = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(""), 2200); };

  useEffect(() => {
    (async () => {
      const [{ data: sitesData, error: e1 }, { data: shiftsData, error: e2 }, { data: ratesData, error: e3 }, { data: userData }, { data: notesData, error: e4 }] = await Promise.all([
        supabase.from("sites").select("*").order("name"),
        supabase.from("shifts").select("*"),
        supabase.from("rates").select("*").maybeSingle(),
        supabase.auth.getUser(),
        supabase.from("notes").select("*"),
      ]);
      if (!e1 && sitesData) setSites(sitesData);
      if (!e2 && shiftsData) setShifts(shiftsData);
      if (!e3 && ratesData) setRates(ratesData);
      if (userData?.user?.id) setUserId(userData.user.id);
      if (!e4 && notesData) setNotes(notesData);
      if (e1 || e2 || e3) flash("Erreur de chargement: " + (e1?.message || e2?.message || e3?.message || "inconnue"));
      setLoading(false);
    })();
  }, [supabase]);

  const shiftsByDay = useMemo(() => {
    const map = {};
    for (const s of shifts) (map[s.date] ||= []).push(s);
    return map;
  }, [shifts]);

  const notesByDay = useMemo(() => {
    const map = {};
    for (const n of notes) (map[n.date] ||= []).push(n);
    return map;
  }, [notes]);

  const siteById = useMemo(() => Object.fromEntries(sites.map(s => [s.id, s])), [sites]);

  function computeShiftPay(s) {
    const h = hoursBetween(toHHMM(s.start_time), toHHMM(s.end_time));
    const site = siteById[s.site_id];
    let rate, prime, deplacement;
    if (s.special_enabled) {
      rate = Number(s.special_rate) || 0;
      prime = Number(s.special_prime) || 0;
      deplacement = Number(s.special_indemnite) || 0;
    } else {
      const siteSpecial = site?.special_rate_enabled && site?.special_rate != null && site?.special_rate !== "";
      rate = siteSpecial ? Number(site.special_rate) : (s.type === "nuit" ? Number(rates.taux_nuit) : Number(rates.taux_jour));
      prime = Number(rates.prime);
      deplacement = s.transport === "conducteur" && site ? Number(site.indemnite || 0) : 0;
    }
    const base = h * rate;
    return { hours: h, base, prime, deplacement, total: base + prime + deplacement };
  }

  const monthShifts = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    return shifts.filter(s => { const d = new Date(s.date); return d.getFullYear() === y && d.getMonth() === m; });
  }, [shifts, cursor]);

  const monthSummary = useMemo(() => {
    let acquis = { base: 0, prime: 0, deplacement: 0, hj: 0, hn: 0, total: 0 };
    let prevu = { base: 0, prime: 0, deplacement: 0, hj: 0, hn: 0, total: 0 };
    const todayKey = dateKey(new Date());
    for (const s of monthShifts) {
      const p = computeShiftPay(s);
      const bucket = s.date <= todayKey ? acquis : prevu;
      bucket.base += p.base; bucket.prime += p.prime; bucket.deplacement += p.deplacement; bucket.total += p.total;
      if (s.type === "nuit") bucket.hn += p.hours; else bucket.hj += p.hours;
    }
    return { acquis, prevu };
  }, [monthShifts, rates, siteById]);

  // ---- shifts CRUD ----
  function openDay(date) {
    if (sites.length === 0) { setModalDate(date); setEditShift(null); return; }
    setQuickAddDate(date);
  }
  function openFullForm(date) { setQuickAddDate(null); setEditShift(null); setModalDate(date); }
  function openEditShift(s) { setQuickAddDate(null); setEditShift(s); setModalDate(s.date); }
  function closeModal() { setModalDate(null); setEditShift(null); }

  async function quickAdd(site, type, transport, date) {
    const payload = {
      date,
      start_time: type === "nuit" ? (site.night_start || "22:00") : (site.day_start || "08:00"),
      end_time: type === "nuit" ? (site.night_end || "06:00") : (site.day_end || "16:00"),
      site_id: site.id, type, transport, user_id: userId,
    };
    const { data, error } = await supabase.from("shifts").insert(payload).select().single();
    if (error) { flash("Échec ajout shift: " + error.message); return; }
    setShifts(prev => [...prev, data]);
    setQuickAddDate(null);
    flashOk("Shift ajouté");
  }

  async function upsertShift(form) {
    const payload = {
      date: form.date, start_time: form.start, end_time: form.end,
      site_id: form.siteId || null, type: form.type, transport: form.transport,
      special_enabled: !!form.specialEnabled,
      special_rate: form.specialEnabled ? (Number(form.specialRate) || 0) : null,
      special_prime: form.specialEnabled ? (Number(form.specialPrime) || 0) : null,
      special_indemnite: form.specialEnabled ? (Number(form.specialIndemnite) || 0) : null,
    };
    if (editShift) {
      const { data, error } = await supabase.from("shifts").update(payload).eq("id", editShift.id).select().single();
      if (error) { flash("Échec sauvegarde: " + error.message); return; }
      setShifts(prev => prev.map(s => s.id === editShift.id ? data : s));
    } else {
      const { data, error } = await supabase.from("shifts").insert({ ...payload, user_id: userId }).select().single();
      if (error) { flash("Échec sauvegarde: " + error.message); return; }
      setShifts(prev => [...prev, data]);
    }
    closeModal();
    flashOk("Shift enregistré");
  }

  async function deleteShift(id) {
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) { flash("Échec suppression: " + error.message); return; }
    setShifts(prev => prev.filter(s => s.id !== id));
    closeModal();
    flashOk("Shift supprimé");
  }

  // ---- sites CRUD ----
  async function upsertSite(form) {
    const payload = {
      name: form.name.trim(), indemnite: Number(form.indemnite) || 0,
      day_start: form.dayStart, day_end: form.dayEnd,
      night_start: form.nightStart, night_end: form.nightEnd,
      special_rate_enabled: !!form.specialEnabled,
      special_rate: form.specialEnabled ? (Number(form.specialRate) || 0) : null,
    };
    if (editSite) {
      const { data, error } = await supabase.from("sites").update(payload).eq("id", editSite.id).select().single();
      if (error) { flash("Échec sauvegarde client: " + error.message); return; }
      setSites(prev => prev.map(s => s.id === editSite.id ? data : s));
    } else {
      const { data, error } = await supabase.from("sites").insert({ ...payload, user_id: userId }).select().single();
      if (error) { flash("Échec création client: " + error.message); return; }
      setSites(prev => [...prev, data]);
    }
    setSiteFormOpen(false); setEditSite(null);
    flashOk("Client enregistré");
  }

  async function deleteSite(id) {
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) { flash("Échec suppression: " + error.message); return; }
    setSites(prev => prev.filter(s => s.id !== id));
    flashOk("Client supprimé");
  }

  // ---- notes CRUD ----
  function openAddNote(date) { setNoteModalDate(date); setEditNote(null); }
  function openEditNote(n) { setNoteModalDate(n.date); setEditNote(n); }
  function closeNoteModal() { setNoteModalDate(null); setEditNote(null); }

  async function upsertNote(text) {
    if (editNote) {
      const { data, error } = await supabase.from("notes").update({ text }).eq("id", editNote.id).select().single();
      if (error) { flash("Échec sauvegarde note: " + error.message); return; }
      setNotes(prev => prev.map(n => n.id === editNote.id ? data : n));
    } else {
      const { data, error } = await supabase.from("notes").insert({ date: noteModalDate, text, user_id: userId }).select().single();
      if (error) { flash("Échec création note: " + error.message); return; }
      setNotes(prev => [...prev, data]);
    }
    closeNoteModal();
    flashOk("Note enregistrée");
  }

  async function deleteNote(id) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) { flash("Échec suppression note: " + error.message); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
    closeNoteModal();
    flashOk("Note supprimée");
  }

  // ---- rates ----
  async function saveRates(next) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    const payload = { user_id: uid, taux_jour: next.jour, taux_nuit: next.nuit, prime: next.prime };
    const { data, error } = await supabase.from("rates").upsert(payload).select().single();
    if (error) { flash("Échec sauvegarde taux: " + error.message); return false; }
    setRates(data);
    flashOk("Taux enregistrés");
    return true;
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div style={{ background: C.bg }} className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-10 h-10 animate-pulse" style={{ color: C.red }} strokeWidth={1.5} />
          <div className="display text-xs tracking-[0.3em] uppercase" style={{ color: C.textDim }}>Chargement</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text }} className="min-h-screen">
      <Header tab={tab} setTab={setTab} userEmail={userEmail} onLogout={logout} />

      <main className="max-w-5xl mx-auto px-2 pb-24 pt-6">
        {tab === "calendrier" && (
          <CalendarView cursor={cursor} setCursor={setCursor} shiftsByDay={shiftsByDay} notesByDay={notesByDay} siteById={siteById} onDayClick={openDay} onShiftClick={openEditShift} onNoteClick={openEditNote} hasSites={sites.length > 0} />
        )}
        {tab === "salaire" && (
          <SalaryView cursor={cursor} setCursor={setCursor} summary={monthSummary} monthShifts={monthShifts} siteById={siteById} />
        )}
        {tab === "sites" && (
          <SitesView sites={sites} onEdit={(s) => { setEditSite(s); setSiteFormOpen(true); }} onAddNew={() => { setEditSite(null); setSiteFormOpen(true); }} onDelete={deleteSite} />
        )}
        {tab === "reglages" && <SettingsView rates={rates} onSave={saveRates} />}
      </main>

      {quickAddDate && (
        <QuickAddSheet
          date={quickAddDate}
          sites={sites}
          onConfirm={(site, type, transport) => quickAdd(site, type, transport, quickAddDate)}
          onCustom={() => openFullForm(quickAddDate)}
          onAddNote={() => { const d = quickAddDate; setQuickAddDate(null); openAddNote(d); }}
          onClose={() => setQuickAddDate(null)}
        />
      )}

      {modalDate && (
        <ShiftModal
          date={modalDate}
          shift={editShift ? { date: editShift.date, start: toHHMM(editShift.start_time), end: toHHMM(editShift.end_time), siteId: editShift.site_id || "", type: editShift.type, transport: editShift.transport, specialEnabled: !!editShift.special_enabled, specialRate: editShift.special_rate ?? "", specialPrime: editShift.special_prime ?? "", specialIndemnite: editShift.special_indemnite ?? "" } : null}
          sites={sites} onClose={closeModal} onSave={upsertShift}
          onDelete={editShift ? () => deleteShift(editShift.id) : null}
        />
      )}

      {siteFormOpen && (
        <SiteModal
          site={editSite ? { name: editSite.name, indemnite: editSite.indemnite, dayStart: toHHMM(editSite.day_start), dayEnd: toHHMM(editSite.day_end), nightStart: toHHMM(editSite.night_start), nightEnd: toHHMM(editSite.night_end), specialEnabled: !!editSite.special_rate_enabled, specialRate: editSite.special_rate ?? "" } : null}
          onClose={() => { setSiteFormOpen(false); setEditSite(null); }} onSave={upsertSite}
        />
      )}

      {noteModalDate && (
        <NoteModal
          date={noteModalDate}
          note={editNote}
          onClose={closeNoteModal}
          onSave={upsertNote}
          onDelete={editNote ? () => deleteNote(editNote.id) : null}
        />
      )}

      {okMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm px-4 py-2.5 rounded display tracking-wide z-50 flex items-center gap-2" style={{ background: C.elevated, border: `1px solid #2FB86B`, color: C.text }}>
          <Check className="w-4 h-4" style={{ color: "#2FB86B" }} /> {okMsg}
        </div>
      )}

      {errMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm px-4 py-2.5 rounded display tracking-wide z-50 text-center" style={{ background: C.elevated, border: `1px solid ${C.red}`, color: C.text, maxWidth: "90vw" }}>
          {errMsg}
        </div>
      )}
    </div>
  );
}

function Header({ tab, setTab, userEmail, onLogout }) {
  const items = [
    { id: "calendrier", label: "Calendrier", icon: Calendar },
    { id: "salaire", label: "Salaire", icon: Wallet },
    { id: "sites", label: "Clients", icon: MapPin },
    { id: "reglages", label: "Réglages", icon: Settings },
  ];
  return (
    <header className="sticky top-0 z-20" style={{ background: C.bg, borderBottom: `1px solid ${C.borderSoft}` }}>
      <div className="max-w-5xl mx-auto px-2 pt-5 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: C.panel, border: `1px solid ${C.red}` }}>
          <Shield className="w-5 h-5" style={{ color: C.red }} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="display text-lg font-semibold tracking-wide leading-none">SHIFT<span style={{ color: C.red }}>CTRL</span></div>
          <div className="text-[11px] tracking-[0.2em] uppercase mt-1 truncate" style={{ color: C.textDim }}>{userEmail || "Registre de service"}</div>
        </div>
        <button onClick={onLogout} className="focusable p-2 rounded flex-shrink-0" style={{ color: C.textDim }} title="Déconnexion">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      <nav className="max-w-5xl mx-auto px-2 grid grid-cols-4">
        {items.map(it => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="focusable display flex flex-col items-center justify-center gap-1 py-2.5 border-b-2 transition-colors min-w-0"
              style={{ borderColor: active ? C.red : "transparent", color: active ? C.text : C.textDim, fontWeight: active ? 600 : 500 }}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-wide truncate max-w-full px-0.5">{it.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function MonthNav({ cursor, setCursor }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <button className="focusable p-2.5 rounded" style={{ background: C.panel, border: `1px solid ${C.borderSoft}` }} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="w-5 h-5" style={{ color: C.textMid }} /></button>
      <div className="display text-lg tracking-wide uppercase">{MONTHS[cursor.getMonth()]} <span style={{ color: C.textDim }}>{cursor.getFullYear()}</span></div>
      <button className="focusable p-2.5 rounded" style={{ background: C.panel, border: `1px solid ${C.borderSoft}` }} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="w-5 h-5" style={{ color: C.textMid }} /></button>
    </div>
  );
}

function CalendarView({ cursor, setCursor, shiftsByDay, notesByDay, siteById, onDayClick, onShiftClick, onNoteClick, hasSites }) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = dateKey(new Date());
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <MonthNav cursor={cursor} setCursor={setCursor} />
      {!hasSites && (
        <div className="mb-4 px-4 py-3 rounded text-sm" style={{ background: C.amberDim, border: `1px solid ${C.amber}`, color: C.text }}>
          Ajoute d'abord tes clients dans l'onglet <b>Clients</b> pour pouvoir les placer d'un tap sur le calendrier.
        </div>
      )}
      <div className="flex items-center gap-4 mb-2 text-xs uppercase tracking-widest flex-wrap" style={{ color: C.textDim }}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: C.amber }} /> Jour</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: C.red }} /> Nuit</span>
        <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5" /> Conducteur</span>
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Passager</span>
        <span className="flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Note</span>
      </div>

      {/* full-bleed edge-to-edge grid, like the iOS Calendar app */}
      <div className="-mx-2">
        <div className="grid grid-cols-7" style={{ borderTop: `1px solid ${C.borderSoft}`, borderLeft: `1px solid ${C.borderSoft}` }}>
          {DAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-widest py-1.5" style={{ color: C.textDim, borderRight: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ borderLeft: `1px solid ${C.borderSoft}` }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} style={{ borderRight: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}`, minHeight: "150px" }} />;
            const key = `${y}-${pad(m+1)}-${pad(d)}`;
            const dayShifts = shiftsByDay[key] || [];
            const dayNotes = notesByDay[key] || [];
            const isToday = key === today;
            return (
              <div key={i} className="p-1 flex flex-col gap-1" style={{ borderRight: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}`, minHeight: "150px" }}>
                <div className="flex items-center justify-between">
                  <span
                    className="mono text-[15px] font-bold flex items-center justify-center"
                    style={{
                      color: isToday ? "#FFFFFF" : C.textMid,
                      background: isToday ? C.red : "transparent",
                      width: "22px", height: "22px", borderRadius: "6px",
                    }}
                  >
                    {d}
                  </span>
                  <button onClick={() => onDayClick(key)} className="focusable rounded" style={{ color: C.textDim }} title="Ajouter">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {dayShifts.map(s => {
                    const site = siteById[s.site_id];
                    const TransportIcon = s.transport === "conducteur" ? Car : s.transport === "passager" ? Users : null;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onShiftClick(s)}
                        className="focusable w-full text-left px-1.5 py-1 rounded flex items-center gap-1 min-w-0"
                        style={{ background: s.type === "nuit" ? C.redDim : C.amberDim }}
                      >
                        {TransportIcon && <TransportIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.textDim }} />}
                        <span className="text-[13px] leading-tight truncate font-semibold" style={{ color: C.text }}>
                          {site ? site.name : "Perso"}
                        </span>
                      </button>
                    );
                  })}
                  {dayNotes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => onNoteClick(n)}
                      className="focusable w-full text-left px-1.5 py-1 rounded truncate"
                      style={{ background: C.elevated }}
                    >
                      <span className="text-[13px] leading-tight truncate" style={{ color: C.textMid }}>{n.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QuickAddSheet({ date, sites, onConfirm, onCustom, onAddNote, onClose }) {
  const d = new Date(date + "T00:00:00");
  const [selectedSite, setSelectedSite] = useState(null);
  const [type, setType] = useState("jour");
  const [transport, setTransport] = useState("aucun");
  const displayStart = selectedSite ? (type === "nuit" ? toHHMM(selectedSite.night_start) || "22:00" : toHHMM(selectedSite.day_start) || "08:00") : "";
  const displayEnd = selectedSite ? (type === "nuit" ? toHHMM(selectedSite.night_end) || "06:00" : toHHMM(selectedSite.day_end) || "16:00") : "";

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div className="w-full sm:max-w-sm rounded-t-xl sm:rounded-lg p-5 overflow-y-auto" style={{ background: C.panelAlt, border: `1px solid ${C.borderSoft}`, maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="display text-base uppercase tracking-wide">{d.getDate()} {MONTHS[d.getMonth()]}</div>
          <button onClick={onClose} className="focusable" style={{ color: C.textDim }}><X className="w-5 h-5" /></button>
        </div>

        {!selectedSite && (
          <>
            <div className="text-sm mb-4" style={{ color: C.textDim }}>Choisis un client pour placer le shift</div>
            <div className="flex flex-col gap-2">
              {sites.map(s => (
                <button key={s.id} onClick={() => setSelectedSite(s)} className="focusable flex items-center justify-between px-4 py-3.5 rounded-lg text-left" style={{ background: C.elevated, border: `1px solid ${C.borderSoft}` }}>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: C.red }} />
                    <div>
                      <div className="text-[15px] font-medium">{s.name}</div>
                      <div className="text-xs mono mt-0.5" style={{ color: C.textDim }}>{fmtEUR(s.indemnite)} déplacement</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: C.textDim }} />
                </button>
              ))}
            </div>
            <button onClick={onCustom} className="focusable w-full mt-3 py-3 rounded-lg display text-[13px] uppercase tracking-wider" style={{ background: "transparent", border: `1px dashed ${C.border}`, color: C.textMid }}>Shift personnalisé</button>
            <button onClick={onAddNote} className="focusable w-full mt-2 py-3 rounded-lg display text-[13px] uppercase tracking-wider flex items-center justify-center gap-2" style={{ background: "transparent", border: `1px dashed ${C.border}`, color: C.textMid }}>
              <StickyNote className="w-3.5 h-3.5" /> Ajouter une note
            </button>
          </>
        )}

        {selectedSite && (
          <>
            <button onClick={() => setSelectedSite(null)} className="focusable flex items-center gap-1 mb-3 text-xs uppercase tracking-wider" style={{ color: C.textDim }}><ChevronLeft className="w-3.5 h-3.5" /> {selectedSite.name}</button>
            <div className="mb-4">
              <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>Jour ou nuit ?</span>
              <div className="grid grid-cols-2 gap-2.5">
                {["jour", "nuit"].map(t => (
                  <button key={t} type="button" onClick={() => setType(t)} className="focusable py-3 rounded-lg display text-[13px] uppercase tracking-wider font-medium"
                    style={{ background: type === t ? (t === "nuit" ? C.red : C.amber) : C.bg, color: type === t ? "#0F0F10" : C.textMid, border: `1px solid ${type === t ? (t === "nuit" ? C.red : C.amber) : C.border}` }}>
                    {t === "nuit" ? "Nuit" : "Jour"}
                  </button>
                ))}
              </div>
              <div className="text-xs mono mt-2" style={{ color: C.textDim }}>{displayStart}–{displayEnd}</div>
            </div>
            <div className="mb-5">
              <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>Conducteur ou passager ?</span>
              <div className="grid grid-cols-3 gap-2.5">
                {Object.entries(TRANSPORT).map(([key, t]) => {
                  const Icon = t.icon; const active = transport === key;
                  return (
                    <button key={key} type="button" onClick={() => setTransport(key)} className="focusable py-3 rounded-lg flex flex-col items-center gap-1.5" style={{ background: active ? C.elevated : C.bg, border: `1px solid ${active ? C.red : C.border}` }}>
                      <Icon className="w-4 h-4" style={{ color: active ? C.red : C.textDim }} />
                      <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: active ? C.text : C.textDim }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={() => onConfirm(selectedSite, type, transport)} className="focusable w-full py-3.5 rounded-lg display text-[13px] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5" style={{ background: C.red, color: "#FFFFFF" }}>
              <Plus className="w-4 h-4" /> Ajouter le shift
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg p-4" style={{ background: C.panel, border: `1px solid ${C.borderSoft}` }}>
      <div className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>{label}</div>
      <div className="mono text-2xl font-semibold" style={{ color: accent || C.text }}>{value}</div>
      {sub && <div className="text-[12px] mt-1" style={{ color: C.textDim }}>{sub}</div>}
    </div>
  );
}

function SalaryView({ cursor, setCursor, summary, monthShifts, siteById }) {
  const { acquis, prevu } = summary;
  const total = acquis.total + prevu.total;
  return (
    <div>
      <MonthNav cursor={cursor} setCursor={setCursor} />
      <StatCard label="Total du mois (acquis + prévu)" value={fmtEUR(total)} accent={C.red} />
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <StatCard label="Acquis (presté)" value={fmtEUR(acquis.total)} sub={`${acquis.hj.toFixed(1)}h jour · ${acquis.hn.toFixed(1)}h nuit`} />
        <StatCard label="Prévisionnel" value={fmtEUR(prevu.total)} sub={`${prevu.hj.toFixed(1)}h jour · ${prevu.hn.toFixed(1)}h nuit`} />
      </div>
      <div className="mt-6 display text-[13px] uppercase tracking-widest mb-2" style={{ color: C.textDim }}>Détail</div>
      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.borderSoft}` }}>
        {[["Heures (base)", acquis.base + prevu.base], ["Primes journalières", acquis.prime + prevu.prime], ["Indemnités déplacement", acquis.deplacement + prevu.deplacement]].map(([label, val], i) => (
          <div key={label} className="flex justify-between items-center px-4 py-3.5 text-[15px]" style={{ background: i % 2 ? C.panel : C.panelAlt, borderBottom: i < 2 ? `1px solid ${C.borderSoft}` : "none" }}>
            <span style={{ color: C.textMid }}>{label}</span>
            <span className="mono font-medium">{fmtEUR(val)}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 display text-[13px] uppercase tracking-widest mb-2" style={{ color: C.textDim }}>Shifts du mois ({monthShifts.length})</div>
      {monthShifts.length === 0 && <div className="text-sm" style={{ color: C.textDim }}>Aucun shift encodé ce mois-ci.</div>}
      <div className="flex flex-col gap-1.5">
        {[...monthShifts].sort((a,b) => a.date.localeCompare(b.date)).map(s => {
          const site = siteById[s.site_id];
          return (
            <div key={s.id} className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm" style={{ background: C.panel, border: `1px solid ${C.borderSoft}` }}>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.type === "nuit" ? C.red : C.amber }} />
                <span className="mono text-xs" style={{ color: C.textDim }}>{s.date.slice(8,10)}/{s.date.slice(5,7)}</span>
                <span style={{ color: C.textMid }}>{toHHMM(s.start_time)}–{toHHMM(s.end_time)}</span>
                {site && <span className="text-xs" style={{ color: C.textDim }}>· {site.name}</span>}
              </div>
              <span className="text-[11px] uppercase tracking-wider" style={{ color: C.textDim }}>{s.date <= dateKey(new Date()) ? "Presté" : "Prévu"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SitesView({ sites, onEdit, onAddNew, onDelete }) {
  return (
    <div>
      <div className="display text-[13px] uppercase tracking-widest mb-3" style={{ color: C.textDim }}>Clients préconfigurés</div>
      <div className="flex flex-col gap-2 mb-4">
        {sites.map(s => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3.5 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.borderSoft}` }}>
            <button onClick={() => onEdit(s)} className="focusable flex items-center gap-3 text-left flex-1 min-w-0">
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: C.red }} />
              <div className="min-w-0">
                <div className="text-[15px] font-medium flex items-center gap-1.5">
                  {s.name} <Pencil className="w-3 h-3" style={{ color: C.textDim }} />
                  {s.special_rate_enabled && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: C.redDim, color: C.red }}>★ {fmtEUR(s.special_rate)}/h</span>
                  )}
                </div>
                <div className="text-xs mono mt-0.5" style={{ color: C.textDim }}>
                  <span style={{ color: C.amber }}>{toHHMM(s.day_start)}–{toHHMM(s.day_end)}</span>{" · "}
                  <span style={{ color: C.red }}>{toHHMM(s.night_start)}–{toHHMM(s.night_end)}</span>{" · "}{fmtEUR(s.indemnite)}
                </div>
              </div>
            </button>
            <button onClick={() => onDelete(s.id)} className="focusable ml-2 p-2 flex-shrink-0" style={{ color: C.textDim }}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {sites.length === 0 && <div className="text-sm" style={{ color: C.textDim }}>Aucun client enregistré pour l'instant.</div>}
      </div>
      <button onClick={onAddNew} className="focusable w-full flex items-center justify-center gap-2 py-3.5 rounded-lg display text-[13px] uppercase tracking-wider font-medium" style={{ background: C.red, color: "#FFFFFF" }}>
        <Plus className="w-4 h-4" /> Ajouter un client
      </button>
    </div>
  );
}

function SiteModal({ site, onClose, onSave }) {
  const [form, setForm] = useState(() => site || { name: "", indemnite: "", dayStart: "08:00", dayEnd: "16:00", nightStart: "22:00", nightEnd: "06:00", specialEnabled: false, specialRate: "" });
  function submit(e) { e.preventDefault(); if (!form.name.trim()) return; onSave(form); }
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full sm:max-w-sm rounded-t-xl sm:rounded-lg p-5 overflow-y-auto" style={{ background: C.panelAlt, border: `1px solid ${C.borderSoft}`, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="display text-sm uppercase tracking-wider">{site ? "Modifier le client" : "Nouveau client"}</div>
          <button type="button" onClick={onClose} className="focusable" style={{ color: C.textDim }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <Field label="Nom du client / site">
            <input autoFocus required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Bruxelles — Site X" className="w-full rounded-lg px-3.5 py-3 text-[15px]" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </Field>
          <Field label="Indemnité déplacement (€, si conducteur)">
            <input type="number" min="0" step="0.5" value={form.indemnite} onChange={e => setForm({ ...form, indemnite: e.target.value })} placeholder="0" className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
          </Field>
          <div>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.amber }}><span className="w-2 h-2 rounded-full inline-block" style={{ background: C.amber }} /> Horaire de jour</span>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Début"><input type="time" value={form.dayStart} onChange={e => setForm({ ...form, dayStart: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
              <Field label="Fin"><input type="time" value={form.dayEnd} onChange={e => setForm({ ...form, dayEnd: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
            </div>
          </div>
          <div>
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.red }}><span className="w-2 h-2 rounded-full inline-block" style={{ background: C.red }} /> Horaire de nuit</span>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Début"><input type="time" value={form.nightStart} onChange={e => setForm({ ...form, nightStart: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
              <Field label="Fin"><input type="time" value={form.nightEnd} onChange={e => setForm({ ...form, nightEnd: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
            </div>
          </div>

          <div className="pt-1" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, specialEnabled: !form.specialEnabled })}
              className="focusable w-full mt-3.5 flex items-center justify-between px-3.5 py-3 rounded-lg"
              style={{ background: form.specialEnabled ? C.redDim : C.bg, border: `1px solid ${form.specialEnabled ? C.red : C.border}` }}
            >
              <span className="text-[13px] font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: form.specialEnabled ? C.red : C.textDim }} />
                Taux horaire spécial
              </span>
              <span className="text-[11px] uppercase tracking-wider" style={{ color: form.specialEnabled ? C.red : C.textDim }}>{form.specialEnabled ? "Activé" : "Désactivé"}</span>
            </button>
            {form.specialEnabled && (
              <div className="mt-2.5">
                <Field label="Taux horaire spécial (€/h — remplace jour et nuit pour ce client)">
                  <input type="number" min="0" step="0.1" value={form.specialRate} onChange={e => setForm({ ...form, specialRate: e.target.value })} placeholder="0" className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.red}`, color: C.text }} />
                </Field>
              </div>
            )}
          </div>
        </div>
        <button type="submit" className="focusable w-full mt-5 py-3.5 rounded-lg display text-[13px] uppercase tracking-wider font-medium" style={{ background: C.red, color: "#FFFFFF" }}>Enregistrer</button>
      </form>
    </div>
  );
}

function NoteModal({ date, note, onClose, onSave, onDelete }) {
  const [text, setText] = useState(note?.text || "");
  function submit(e) { e.preventDefault(); if (!text.trim()) return; onSave(text.trim()); }
  const d = new Date((note?.date || date) + "T00:00:00");
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full sm:max-w-sm rounded-t-xl sm:rounded-lg p-5" style={{ background: C.panelAlt, border: `1px solid ${C.borderSoft}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="display text-sm uppercase tracking-wider flex items-center gap-2">
            <StickyNote className="w-4 h-4" style={{ color: C.red }} />
            {d.getDate()} {MONTHS[d.getMonth()]}
          </div>
          <button type="button" onClick={onClose} className="focusable" style={{ color: C.textDim }}><X className="w-5 h-5" /></button>
        </div>
        <Field label="Note">
          <textarea autoFocus required value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Ex: Dentiste 14h, RDV urologue…" className="w-full rounded-lg px-3.5 py-3 text-[15px] resize-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
        </Field>
        <div className="flex gap-2.5 mt-4">
          <button type="submit" className="focusable flex-1 py-3.5 rounded-lg display text-[13px] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5" style={{ background: C.red, color: "#FFFFFF" }}><Check className="w-4 h-4" /> Enregistrer</button>
          {onDelete && <button type="button" onClick={onDelete} className="focusable px-4 py-3.5 rounded-lg" style={{ color: C.red, border: `1px solid ${C.red}` }}><Trash2 className="w-4 h-4" /></button>}
        </div>
      </form>
    </div>
  );
}

function SettingsView({ rates, onSave }) {
  const [local, setLocal] = useState({ jour: rates.taux_jour, nuit: rates.taux_nuit, prime: rates.prime });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => setLocal({ jour: rates.taux_jour, nuit: rates.taux_nuit, prime: rates.prime }), [rates]);

  async function handleSave() {
    setSaving(true);
    const ok = await onSave({ jour: Number(local.jour) || 0, nuit: Number(local.nuit) || 0, prime: Number(local.prime) || 0 });
    setSaving(false);
    if (ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    }
  }

  return (
    <div>
      <div className="display text-[13px] uppercase tracking-widest mb-3" style={{ color: C.textDim }}>Taux & primes</div>
      <div className="p-4 rounded-lg flex flex-col gap-3.5" style={{ background: C.panel, border: `1px solid ${C.borderSoft}` }}>
        <Field label="Taux horaire net — jour (€/h)"><input type="number" min="0" step="0.1" value={local.jour} onChange={e => setLocal({ ...local, jour: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
        <Field label="Taux horaire net — nuit (€/h)"><input type="number" min="0" step="0.1" value={local.nuit} onChange={e => setLocal({ ...local, nuit: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
        <Field label="Prime par jour presté (€)"><input type="number" min="0" step="0.5" value={local.prime} onChange={e => setLocal({ ...local, prime: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
        <button
          onClick={handleSave}
          disabled={saving}
          className="focusable mt-1 py-3.5 rounded-lg display text-[13px] uppercase tracking-wider font-medium flex items-center justify-center gap-2"
          style={{ background: justSaved ? "#2FB86B" : C.red, color: "#FFFFFF", opacity: saving ? 0.7 : 1 }}
        >
          {justSaved ? (<><Check className="w-4 h-4" /> Enregistré</>) : saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>{label}</span>{children}</label>;
}

function ShiftModal({ date, shift, sites, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => shift || { date, start: "08:00", end: "16:00", siteId: sites[0]?.id || "", type: "jour", transport: "aucun", specialEnabled: false, specialRate: "", specialPrime: "", specialIndemnite: "" });
  function submit(e) { e.preventDefault(); onSave(form); }
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-xl sm:rounded-lg p-5 overflow-y-auto" style={{ background: C.panelAlt, border: `1px solid ${C.borderSoft}`, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="display text-sm uppercase tracking-wider flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: C.red }} />{form.date.slice(8,10)}/{form.date.slice(5,7)}/{form.date.slice(0,4)}</div>
          <button type="button" onClick={onClose} className="focusable" style={{ color: C.textDim }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Début"><input required type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
            <Field label="Fin"><input required type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} /></Field>
          </div>
          <Field label="Client / site">
            <select value={form.siteId} onChange={e => setForm({ ...form, siteId: e.target.value })} className="w-full rounded-lg px-3.5 py-3 text-[15px]" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>
              <option value="">— Aucun —</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div>
            <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>Type de shift</span>
            <div className="grid grid-cols-2 gap-2.5">
              {["jour", "nuit"].map(t => (
                <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} className="focusable py-3 rounded-lg display text-[13px] uppercase tracking-wider font-medium" style={{ background: form.type === t ? (t === "nuit" ? C.red : C.amber) : C.bg, color: form.type === t ? "#0F0F10" : C.textMid, border: `1px solid ${form.type === t ? (t === "nuit" ? C.red : C.amber) : C.border}` }}>{t === "nuit" ? "Nuit" : "Jour"}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>Transport</span>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(TRANSPORT).map(([key, t]) => {
                const Icon = t.icon; const active = form.transport === key;
                return (
                  <button key={key} type="button" onClick={() => setForm({ ...form, transport: key })} className="focusable py-3 rounded-lg flex flex-col items-center gap-1.5" style={{ background: active ? C.elevated : C.bg, border: `1px solid ${active ? C.red : C.border}` }}>
                    <Icon className="w-4 h-4" style={{ color: active ? C.red : C.textDim }} />
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: active ? C.text : C.textDim }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-1" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, specialEnabled: !form.specialEnabled })}
              className="focusable w-full mt-3.5 flex items-center justify-between px-3.5 py-3 rounded-lg"
              style={{ background: form.specialEnabled ? C.redDim : C.bg, border: `1px solid ${form.specialEnabled ? C.red : C.border}` }}
            >
              <span className="text-[13px] font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: form.specialEnabled ? C.red : C.textDim }} />
                Shift spécial
              </span>
              <span className="text-[11px] uppercase tracking-wider" style={{ color: form.specialEnabled ? C.red : C.textDim }}>{form.specialEnabled ? "Activé" : "Désactivé"}</span>
            </button>
            {form.specialEnabled && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                <div className="text-xs" style={{ color: C.textDim }}>Ces valeurs remplacent entièrement les préréglages (taux, prime, indemnité) pour ce shift uniquement.</div>
                <Field label="Taux horaire (€/h)">
                  <input type="number" min="0" step="0.1" value={form.specialRate} onChange={e => setForm({ ...form, specialRate: e.target.value })} placeholder="0" className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.red}`, color: C.text }} />
                </Field>
                <Field label="Prime pour ce shift (€)">
                  <input type="number" min="0" step="0.5" value={form.specialPrime} onChange={e => setForm({ ...form, specialPrime: e.target.value })} placeholder="0" className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.red}`, color: C.text }} />
                </Field>
                <Field label="Indemnité déplacement (€)">
                  <input type="number" min="0" step="0.5" value={form.specialIndemnite} onChange={e => setForm({ ...form, specialIndemnite: e.target.value })} placeholder="0" className="w-full rounded-lg px-3.5 py-3 text-[15px] mono" style={{ background: C.bg, border: `1px solid ${C.red}`, color: C.text }} />
                </Field>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button type="submit" className="focusable flex-1 py-3.5 rounded-lg display text-[13px] uppercase tracking-wider font-medium flex items-center justify-center gap-1.5" style={{ background: C.red, color: "#FFFFFF" }}><Check className="w-4 h-4" /> Enregistrer</button>
          {onDelete && <button type="button" onClick={onDelete} className="focusable px-4 py-3.5 rounded-lg" style={{ color: C.red, border: `1px solid ${C.red}` }}><Trash2 className="w-4 h-4" /></button>}
        </div>
      </form>
    </div>
  );
}
