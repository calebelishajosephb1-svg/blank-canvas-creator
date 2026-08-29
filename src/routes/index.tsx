import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blank Canvas" },
      { name: "description", content: "A full-screen HTML5 canvas ready for drawing." },
      { property: "og:title", content: "Blank Canvas" },
      { property: "og:description", content: "A full-screen HTML5 canvas ready for drawing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-screen w-screen">
      <canvas className="block h-full w-full bg-background" />
    </main>
  );
}
