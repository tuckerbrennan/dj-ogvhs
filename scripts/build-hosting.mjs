import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// Build exactly the public-facing DJ OGVHS frontend for AWS Amplify.
// Do not publish docs, tests, Git metadata, developer tools or CNAME.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");
const pages = ["index.html", "about.html", "mixes.html", "thanks.html", "privacy.html"];
const directories = ["src", "public"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const page of pages) {
  await stat(join(root, page)); // fail the build if a required page is absent
  await cp(join(root, page), join(output, page));
}
for (const directory of directories) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}

// Phase 1 AWS migration is hosting-only. Keep the exact working Google Drive
// iframe player in the Amplify build. The native AWS audio player is a later
// feature gated on verified media URLs, tracked separately in issue #23.
const mixesHtml = await readFile(join(output, "mixes.html"), "utf8");
if (!mixesHtml.includes('src/drive-mixes-github.mjs') ||
    !mixesHtml.includes('id="hot-mixes"') ||
    mixesHtml.includes("COMING WITH OUR AWS LAUNCH")) {
  throw new Error("Expected four-embed published Mixes page was not found");
}

// Hidden AWS-only marker lets us prove the public domain has switched
// away from GitHub Pages without changing the user-visible design.
const indexPath = join(output, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
if (!indexHtml.includes("</body>")) {
  throw new Error("index.html is missing </body>");
}
await writeFile(
  indexPath,
  indexHtml.replace(
    "</body>",
    "  <!-- OGVHS_AWS_AMPLIFY_BUILD -->\n</body>"
  )
);

const entries = await readdir(output);
console.log("DJ OGVHS static website ready for Amplify:", entries.join(", "));
