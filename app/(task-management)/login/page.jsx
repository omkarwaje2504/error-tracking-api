"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    role: "team-member",
    team: "graphic",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm({ ...form, [k]: v });

  async function submit() {
    setError("");
    setLoading(true);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "Something went wrong");
    if (mode === "register") {
      setMode("login");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-6 text-5xl font-extrabold flex justify-center">
          IOne
        </div>

        {/* Heading */}
        <h1 className="bg-gradient-to-r from-neutral-400 via-white to-neutral-400 bg-clip-text text-center text-[28px] font-bold tracking-tight text-transparent">
          {mode === "login" ? "Welcome to Task Tracker" : "Create your account"}
        </h1>
        <p className="mb-8 mt-1.5 text-center text-sm text-neutral-500">
          {mode === "login" ? "Welcome back!" : "Get started in a minute"}
        </p>

        {mode === "register" && (
          <>
            <Field label="Name">
              <input
                className="field"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="Mobile">
              <input
                className="field"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
              />
            </Field>
            <div className="mb-4 flex gap-3">
              <Field label="Role" className="mb-0 flex-1">
                <select
                  className="field"
                  value={form.role}
                  onChange={(e) => update("role", e.target.value)}
                >
                  <option value="team-member">Team Member</option>
                  <option value="lead">Team Lead</option>
                  <option value="head">Head</option>
                </select>
              </Field>
              <Field label="Team" className="mb-0 flex-1">
                <select
                  className="field"
                  value={form.team}
                  onChange={(e) => update("team", e.target.value)}
                >
                  <option value="graphic">Graphic</option>
                  <option value="video">Video</option>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="app">App</option>
                  <option value="all">All</option>
                </select>
              </Field>
            </div>
          </>
        )}

        <Field label="Email">
          <input
            className="field"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>

        <Field label="Password">
          <div className="relative">
            <input
              className="field pr-11"
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              aria-label="Toggle password"
            >
              {showPass ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </Field>

        {mode === "login" && (
          <label className="mb-5 mt-1 flex cursor-pointer items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line bg-panel2 accent-white"
            />
            Stay logged in
          </label>
        )}

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl bg-neutral-400 py-3 font-medium text-black transition-colors hover:bg-neutral-300 disabled:opacity-50"
        >
          {loading ? "..." : mode === "login" ? "Log in" : "Register"}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-500">
          {mode === "login"
            ? "Don't you have an account? "
            : "Have an account? "}
          <span
            className="cursor-pointer font-semibold text-neutral-200 hover:text-white"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </span>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children, className = "mb-4" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold text-neutral-200">
        {label}
      </label>
      {children}
    </div>
  );
}

function Eye() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
