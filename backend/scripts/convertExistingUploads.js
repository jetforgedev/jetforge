/**
 * convertExistingUploads.js
 *
 * One-time script: converts all existing PNG/JPG uploads to WebP (max 400px,
 * quality 82) and updates imageUrl in the DB.
 *
 * Usage (from /var/www/jetforge/backend):
 *   node scripts/convertExistingUploads.js [--dry-run]
 *
 * --dry-run  : prints what would happen without touching any files or DB rows.
 *
 * Safe to re-run: already-.webp files and files with no matching DB row are
 * skipped without error.
 */

require("dotenv").config();
const path  = require("path");
const fs    = require("fs");
const sharp = require("sharp");
const { PrismaClient } = require("@prisma/client");

const prisma  = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// ── Locate uploads dir ────────────────────────────────────────────────────────
// Matches the path used in upload.ts (relative to dist/api/ compiled output).
// From scripts/ we resolve it relative to backend root.
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  console.error(`uploads dir not found at ${UPLOAD_DIR}`);
  process.exit(1);
}

async function main() {
  console.log(`\n=== convertExistingUploads ${DRY_RUN ? "[DRY RUN]" : ""} ===`);
  console.log(`Upload dir: ${UPLOAD_DIR}\n`);

  const files = fs.readdirSync(UPLOAD_DIR);
  const targets = files.filter((f) => /\.(png|jpg|jpeg|gif)$/i.test(f));

  console.log(`Found ${targets.length} non-WebP image(s) to process.\n`);

  let converted = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const filename of targets) {
    const srcPath     = path.join(UPLOAD_DIR, filename);
    const baseName    = path.basename(filename, path.extname(filename));
    const webpName    = `${baseName}.webp`;
    const webpPath    = path.join(UPLOAD_DIR, webpName);

    // Skip if WebP already exists (previous partial run)
    if (fs.existsSync(webpPath)) {
      console.log(`  [SKIP]  ${filename} → WebP already exists`);
      skipped++;
      continue;
    }

    try {
      // ── Find matching DB row(s) ───────────────────────────────────────────
      const tokens = await prisma.token.findMany({
        where: { imageUrl: { contains: filename } },
        select: { mint: true, imageUrl: true },
      });

      if (tokens.length === 0) {
        console.log(`  [SKIP]  ${filename} → no DB row references this file`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        const sizes = fs.statSync(srcPath);
        console.log(
          `  [DRY]   ${filename} (${(sizes.size / 1024).toFixed(0)} KB) → ${webpName}` +
          ` | DB rows: ${tokens.map((t) => t.mint.slice(0, 8)).join(", ")}`
        );
        converted++;
        continue;
      }

      // ── Convert ───────────────────────────────────────────────────────────
      const beforeKB = (fs.statSync(srcPath).size / 1024).toFixed(0);
      await sharp(srcPath)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(webpPath);
      const afterKB = (fs.statSync(webpPath).size / 1024).toFixed(0);

      // ── Update DB ─────────────────────────────────────────────────────────
      for (const token of tokens) {
        const newUrl = token.imageUrl.replace(filename, webpName);
        await prisma.token.update({
          where: { mint: token.mint },
          data:  { imageUrl: newUrl },
        });
      }

      // ── Delete original ───────────────────────────────────────────────────
      fs.unlinkSync(srcPath);

      console.log(
        `  [OK]    ${filename} → ${webpName}  ` +
        `${beforeKB} KB → ${afterKB} KB  ` +
        `(saved ${((1 - afterKB / beforeKB) * 100).toFixed(0)}%)`
      );
      converted++;
    } catch (err) {
      console.error(`  [FAIL]  ${filename}: ${err.message}`);
      // Clean up partial WebP if it was written
      if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Converted : ${converted}`);
  console.log(`Skipped   : ${skipped}`);
  console.log(`Failed    : ${failed}`);
  if (DRY_RUN) console.log(`\n(Dry run — nothing was changed)`);
  console.log();

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Fatal:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
