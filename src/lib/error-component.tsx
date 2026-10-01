import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {errorMessage(error)}
      </p>
    </main>
  );
}

/** An address the site does not have: say so, and offer the desk. */
export function AppNotFound() {
  return (
    <main
      style={{ background: "#070b10", color: "#f3efe8" }}
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p style={{ fontFamily: '"Newsreader", Georgia, serif', fontWeight: 600, fontSize: "2.2rem", lineHeight: 1 }}>The Situation Room</p>
      <h1 className="text-lg font-semibold">There is no page at this address</h1>
      <a href="/yemen-conflict-desk" style={{ color: "#f4a58a" }} className="text-base font-semibold underline underline-offset-4">
        Go to the Yemen Conflict Desk
      </a>
    </main>
  );
}
