"use client";
import React, { useState } from "react";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = "/";
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setMessage("Compte créé — vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded flex items-center justify-center mb-3" style={{ background: "var(--panel)", border: "1px solid var(--red)" }}>
            <Shield className="w-6 h-6" style={{ color: "var(--red)" }} />
          </div>
          <div className="display text-xl font-semibold tracking-wide">SHIFT<span style={{ color: "var(--red)" }}>CTRL</span></div>
          <div className="text-xs tracking-[0.2em] uppercase mt-1" style={{ color: "var(--text-dim)" }}>Registre de service</div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3.5 p-5 rounded-lg" style={{ background: "var(--panel)", border: "1px solid var(--border-soft)" }}>
          <div className="flex gap-2 mb-1">
            <button type="button" onClick={() => setMode("signin")} className="focusable flex-1 py-2 rounded-lg display text-xs uppercase tracking-wider font-medium"
              style={{ background: mode === "signin" ? "var(--red)" : "transparent", color: mode === "signin" ? "#fff" : "var(--text-dim)", border: `1px solid ${mode === "signin" ? "var(--red)" : "var(--border)"}` }}>
              Connexion
            </button>
            <button type="button" onClick={() => setMode("signup")} className="focusable flex-1 py-2 rounded-lg display text-xs uppercase tracking-wider font-medium"
              style={{ background: mode === "signup" ? "var(--red)" : "transparent", color: mode === "signup" ? "#fff" : "var(--text-dim)", border: `1px solid ${mode === "signup" ? "var(--red)" : "var(--border)"}` }}>
              Créer un compte
            </button>
          </div>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--text-dim)" }}>Email</span>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-lg px-3.5 py-3 text-[15px]" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </label>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--text-dim)" }}>Mot de passe</span>
            <input required type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg px-3.5 py-3 text-[15px]" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} />
          </label>

          {error && <div className="text-sm px-3 py-2 rounded" style={{ background: "var(--red-dim)", color: "var(--text)", border: "1px solid var(--red)" }}>{error}</div>}
          {message && <div className="text-sm px-3 py-2 rounded" style={{ background: "var(--amber-dim)", color: "var(--text)", border: "1px solid var(--amber)" }}>{message}</div>}

          <button disabled={loading} type="submit" className="focusable py-3 rounded-lg display text-xs uppercase tracking-wider font-medium mt-1" style={{ background: "var(--red)", color: "#fff", opacity: loading ? 0.6 : 1 }}>
            {loading ? "…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}
