import * as React from "react";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-100 mb-6">
          Admin login
        </h1>

        <form method="POST" action="/api/admin/login">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm text-neutral-400 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoFocus
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-600"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-700 transition"
            >
              Sign in
            </button>
          </div>
        </form>

        {/* Error message rendered server-side via searchParams */}
        <React.Suspense fallback={null}>
          <ErrorMessage searchParams={searchParams} />
        </React.Suspense>
      </div>
    </div>
  );
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (!params.error) return null;
  return (
    <p className="mt-4 text-sm text-red-400">
      Incorrect password. Try again.
    </p>
  );
}