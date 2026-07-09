import { Tabs } from "@/components/ui/Tabs";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { GITHUB_REPO_URL } from "@/components/NavBar";

const DOCKER_CODE = `cp .env.example .env\nmake up\n# open http://localhost:3000`;
const DEV_CODE = `make install\nmake seed\nmake dev\n# open http://localhost:3000`;

export function InstallSection() {
  return (
    <section className="border-t border-white/5 py-20">
      <h2 className="mb-2 text-center text-2xl font-bold text-white">How to install</h2>
      <p className="mx-auto mb-10 max-w-md text-center text-sm text-white/50">
        One SQLite file, one Next.js app. Running in under a minute, self-hosted or on your own
        PaaS.
      </p>
      <div className="mx-auto max-w-2xl">
        <Tabs
          tabs={[
            {
              id: "docker",
              label: "Docker",
              content: (
                <div className="space-y-2">
                  <CodeBlock label="bash" code={DOCKER_CODE} />
                  <p className="text-xs text-white/40">
                    Builds the image, starts the stack, and seeds a demo API on first boot.
                  </p>
                </div>
              ),
            },
            {
              id: "local",
              label: "Local dev",
              content: (
                <div className="space-y-2">
                  <CodeBlock label="bash" code={DEV_CODE} />
                  <p className="text-xs text-white/40">
                    Installs dependencies, seeds the local sqlite file, then runs{" "}
                    <code className="rounded bg-white/10 px-1 py-0.5 font-mono">next dev</code>.
                  </p>
                </div>
              ),
            },
            {
              id: "paas",
              label: "Dokploy / Coolify",
              content: (
                <div className="card p-5 text-sm text-white/60">
                  Deploying to Dokploy or Coolify? Both are supported —{" "}
                  <a
                    href={`${GITHUB_REPO_URL}#deploy-on-dokploy--coolify`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline decoration-dotted underline-offset-4 hover:text-brand-cyan"
                  >
                    see the deploy guide in the README →
                  </a>
                  </div>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
