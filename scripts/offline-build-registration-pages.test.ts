import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const md = readFileSync("site/documentation/offline/build-and-registration.md", "utf8");

test("offline build: production entrypoint и регистрация с origin", () => {
  for (const term of ["sw/sw.ts", "dist/sw.js", "main.tsx", "`/sw.js`", "scope", "`/`", "bun run preview", "import.meta.env.DEV"]) {
    expect(md).toContain(term);
  }
  for (const path of ["vite.config.prod.ts", "src/main.tsx", "sw/sw.ts"]) {
    expect(md).toMatch(new RegExp(`/frontend/blob/[0-9a-f]{40}/apps/client/${path.replaceAll(".", "\\.")}#L[0-9]+`));
  }
  expect(md).not.toContain("virtual:pwa-register");
});

test("offline build: установка и активация показаны отдельно", () => {
  for (const term of ["sequenceDiagram", "cache.addAll", "skipWaiting", "clients.claim", "/offline.html", "CACHE_NAME"]) {
    expect(md).toContain(term);
  }
  expect(md).toContain("](/documentation/offline/)");
  expect(md).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
});
