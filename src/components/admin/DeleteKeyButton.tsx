"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function DeleteKeyButton({ keyName }: { keyName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);

  const handleDelete = async () => {
    await fetch("/api/admin/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: keyName }),
    });
    router.refresh();
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-300 transition">
          Confirm
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-neutral-500 hover:text-neutral-300 transition">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-neutral-600 hover:text-red-400 transition"
    >
      Delete
    </button>
  );
}