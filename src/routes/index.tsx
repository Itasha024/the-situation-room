import { createFileRoute } from "@tanstack/react-router";
import { YemenDesk } from "@/components/yemen-desk";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <YemenDesk />;
}
