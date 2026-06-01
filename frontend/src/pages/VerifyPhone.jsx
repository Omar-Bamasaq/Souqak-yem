import React, { useState } from "react";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";

export default function VerifyPhone() {
  const api = useApi();
  const { user, login } = useAuth();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setMsg("");
    setErr("");
    try {
      await api.post("/phone/send-otp");
      setMsg("OTP sent via SMS (simulated)");
    } catch {
      setErr("Failed to send OTP");
    }
  };

  const verify = async () => {
    setMsg("");
    setErr("");
    setLoading(true);
    try {
      const res = await api.post("/phone/verify-otp", { code });
      if (res.data?.user) {
        const token = localStorage.getItem("token");
        login(token, res.data.user);
      }
      setMsg("Phone verified");
    } catch {
      setErr("Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Verify Phone</h2>
      <div className="text-sm text-gray-600">Phone: {user?.phone || "Not set"}</div>
      {msg && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}
      {err && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="flex gap-2">
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50" onClick={send}>Send OTP</button>
      </div>
      <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Enter 6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
      <button disabled={loading} className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60" onClick={verify}>
        {loading ? "Verifying..." : "Verify"}
      </button>
    </div>
  );
}
