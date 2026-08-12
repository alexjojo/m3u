const fs = require("fs");
const path = require("path");

const sourcePath = path.resolve(__dirname, "..", "manifest.xml");
const outputPath = path.resolve(__dirname, "..", "manifest.production.xml");
const localhostOrigin = "https://localhost:3000";

const rawOrigin = process.argv[2];

function usage() {
  console.error("Usage: npm run manifest:production -- https://add-in.example.com");
}

if (!rawOrigin) {
  usage();
  process.exit(1);
}

let productionOrigin;
try {
  productionOrigin = new URL(rawOrigin);
} catch {
  console.error(`Invalid URL: ${rawOrigin}`);
  usage();
  process.exit(1);
}

if (productionOrigin.protocol !== "https:") {
  console.error("Production manifest URL must use https.");
  process.exit(1);
}

productionOrigin.pathname = productionOrigin.pathname.replace(/\/+$/, "");
productionOrigin.search = "";
productionOrigin.hash = "";

const normalizedOrigin = productionOrigin.toString().replace(/\/$/, "");

if (normalizedOrigin === localhostOrigin) {
  console.error("Production manifest URL must not be localhost.");
  process.exit(1);
}

const manifest = fs.readFileSync(sourcePath, "utf8");
const replaced = manifest.replaceAll(localhostOrigin, normalizedOrigin);

if (manifest === replaced) {
  console.error(`No ${localhostOrigin} URLs found in manifest.xml.`);
  process.exit(1);
}

fs.writeFileSync(outputPath, replaced, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), outputPath)} with origin ${normalizedOrigin}`);
