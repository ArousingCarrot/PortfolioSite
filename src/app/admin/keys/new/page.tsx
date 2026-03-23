import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";

interface CloudflareEnv {
  ANALYTICS_DB: D1Database;
}

async function createKey(formData: FormData) {
  "use server";
  const ctx = await getCloudflareContext();
  const env = ctx.env as unknown as CloudflareEnv;
  const db = env.ANALYTICS_DB;

  const key = formData.get("key")?.toString().trim();
  const label = formData.get("label")?.toString().trim() || null;
  const company = formData.get("company")?.toString().trim() || null;
  const role = formData.get("role")?.toString().trim() || null;
  const channel = formData.get("channel")?.toString().trim() || null;

  if (!key) return;

  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO referral_keys (key, label, company, role, channel, created_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .bind(key, label, company, role, channel, now)
    .run();

  redirect("/admin/keys");
}

export default function NewKeyPage() {
  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">New Referral Key</h1>
        <a href="/admin/keys" className="text-sm text-neutral-400 hover:text-neutral-200 transition">Back to keys</a>
      </div>

      <form action={createKey} className="space-y-4">
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Key</label>
          <input name="key" required placeholder="e.g. google-swe-2025" className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-yellow-300/40" />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Label</label>
          <input name="label" placeholder="e.g. Google SWE Application" className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-yellow-300/40" />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Company</label>
          <input name="company" placeholder="e.g. Google" className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-yellow-300/40" />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Role</label>
          <input name="role" placeholder="e.g. Software Engineer Intern" className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-yellow-300/40" />
        </div>
        <div>
          <label className="block text-sm text-neutral-300 mb-1">Channel</label>
          <input name="channel" placeholder="e.g. linkedin, email, referral" className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-yellow-300/40" />
        </div>
        <button type="submit" className="rounded-xl border border-yellow-300/40 bg-yellow-300/10 px-5 py-2 text-sm text-yellow-100 hover:bg-yellow-300/15 transition">
          Create key
        </button>
      </form>
    </div>
  );
}