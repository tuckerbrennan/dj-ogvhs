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

// GitHub Pages keeps the existing Drive iframe fallback, and shows the Cleandrick
// upcoming card. Only the Amplify build selects the AWS-native audio module;
// the GitHub-only teaser disappears in the AWS artifact to avoid duplicate cards.
const mixesPath = join(output, "mixes.html");
let mixesHtml = await readFile(mixesPath, "utf8");
const githubModule = "./src/drive-mixes-github.mjs?v=github-legacy-20261115";
const awsModule = "./src/drive-mixes.mjs?v=aws-native-20261115";
if (!mixesHtml.includes(githubModule)) {
  throw new Error("mixes.html is missing the GitHub Pages-only player module");
}
mixesHtml = mixesHtml.replace(githubModule, awsModule);
const githubStart = "<!-- OGVHS_GITHUB_ONLY_UPCOMING_START -->";
const githubEnd = "<!-- OGVHS_GITHUB_ONLY_UPCOMING_END -->";
const start = mixesHtml.indexOf(githubStart);
const finish = mixesHtml.indexOf(githubEnd);
if (start < 0 || finish <= start) {
  throw new Error("mixes.html is missing GitHub-only upcoming card markers");
}
mixesHtml = mixesHtml.slice(0, start) + mixesHtml.slice(finish + githubEnd.length);
await writeFile(mixesPath, mixesHtml);

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
