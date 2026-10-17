import { createFileRoute, redirect } from "@tanstack/react-router";

/** The Yemen desk's old Methodology page: the site has one now (user, 17 Oct), with the Yemen desk's part first. */
export const Route = createFileRoute("/yemen-conflict-desk_/methodology")({
  beforeLoad: () => {
    throw redirect({ href: "/methodology#yemen", statusCode: 301 });
  },
});
