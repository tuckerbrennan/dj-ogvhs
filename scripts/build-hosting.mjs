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

// AWS Amplify uses its native HTML5 lossless player. Source mixes.html keeps
// the Google Drive embed module for the GitHub Pages rollback site.
const mixesPath = join(output, "mixes.html");
const mixesHtml = await readFile(mixesPath, "utf8");
if (!mixesHtml.includes('src/drive-mixes-github.mjs') ||
    !mixesHtml.includes('id="hot-mixes"') ||
    mixesHtml.includes("COMING WITH OUR AWS LAUNCH")) {
  throw new Error("Expected curated Mixes page not found");
}
const awsMixesHtml = mixesHtml.replace(
  /src\/drive-mixes-github\.mjs\?v=[^"]+/,
  "src/drive-mixes.mjs?v=lossless-native-20261116"
);
if (awsMixesHtml === mixesHtml || !awsMixesHtml.includes("src/drive-mixes.mjs")) {
  throw new Error("Native AWS audio switch failed");
}
await writeFile(mixesPath, awsMixesHtml);

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

// AWS uses its API only in the hosting artifact. GitHub Pages retains its
// source configuration as an independent rollback origin.
if (process.env.OGVHS_API_URL) {
  const api = new URL(process.env.OGVHS_API_URL);
  if (api.protocol !== "https:" || api.pathname !== "/" || api.search || api.hash || api.username || api.password) {
    throw new Error("OGVHS_API_URL must be an HTTPS API origin");
  }
  await writeFile(join(output,"public","app-config.json"), JSON.stringify({apiUrl:api.origin},null,2)+"\n");
}

const entries = await readdir(output);
console.log("DJ OGVHS static website ready for Amplify:", entries.join(", "));
