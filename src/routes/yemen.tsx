import { createFileRoute, redirect } from "@tanstack/react-router";

/** The desk's old address: sends readers (and their links, with any #card) to the new one. */
export const Route = createFileRoute("/yemen")({
  beforeLoad: () => {
    throw redirect({ to: "/yemen-conflict-desk", statusCode: 301 });
  },
});
