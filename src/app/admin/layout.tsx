import * as React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-medium text-sm">SJB Admin</span>
            <nav className="flex items-center gap-4 text-sm text-neutral-400">
              <a href="/admin" className="hover:text-neutral-100 transition">Dashboard</a>
              <a href="/admin/analytics" className="hover:text-neutral-100 transition">Analytics</a>
              <a href="/admin/keys" className="hover:text-neutral-100 transition">Keys</a>
            </nav>
          </div>
          <form method="POST" action="/api/admin/logout">
            <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-300 transition">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <main className="container mx-auto px-6 py-10">{children}</main>
    </div>
  );
}