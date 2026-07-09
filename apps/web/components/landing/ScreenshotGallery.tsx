const SHOTS: { src: string; title: string; alt: string }[] = [
  {
    src: "/shots/dashboard.png",
    title: "Dashboard",
    alt: "Fancy admin dashboard listing APIs with record and request counters",
  },
  {
    src: "/shots/create.png",
    title: "Create an API",
    alt: "The new-API form with a pasted table ready to submit",
  },
  {
    src: "/shots/success.png",
    title: "Instant success",
    alt: "Success panel showing a freshly generated API's live endpoints",
  },
  {
    src: "/shots/playground.png",
    title: "Query playground",
    alt: "The query playground building a filtered request and showing the JSON response",
  },
];

export function ScreenshotGallery() {
  return (
    <section className="border-t border-white/5 py-20">
      <h2 className="mb-2 text-center text-2xl font-bold text-white">See it in action</h2>
      <p className="mx-auto mb-10 max-w-md text-center text-sm text-white/50">
        From a pasted table to a live, queryable API — the whole flow, screenshot by screenshot.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {SHOTS.map((shot) => (
          <figure key={shot.src} className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <img
                src={shot.src}
                alt={shot.alt}
                loading="lazy"
                width={1440}
                height={900}
                className="block w-full min-w-[320px] border-b border-white/5 object-cover"
              />
            </div>
            <figcaption className="p-4 text-sm font-medium text-white/70">{shot.title}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
