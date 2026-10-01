import { createFileRoute, redirect } from "@tanstack/react-router";

/** The Methodology is the whole site's now (user, 1 Oct): the desk's old address sends readers there. */
export const Route = createFileRoute("/yemen-conflict-desk_/methodology")({
  beforeLoad: () => {
    throw redirect({ to: "/methodology", statusCode: 301 });
  },
});
