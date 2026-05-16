import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// ─── Magic-byte validation ────────────────────────────────────────────────────
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif":  [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};
function validateMagicBytes(filePath: string, mimetype: string): boolean {
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    const sigs = MAGIC_BYTES[mimetype];
    if (!sigs) return false;
    return sigs.some((sig) => sig.every((b, i) => buf[i] === b));
  } catch { return false; }
}

// ─── Image compression with Sharp ────────────────────────────────────────────
// Compress and resize before Arweave upload to minimise storage costs.
// Target: max 500×500px, JPEG/WebP ≤ 150 KB.
// This keeps every upload in the lowest Arweave price tier (~$0.005/upload).
async function compressImage(inputPath: string, mimetype: string): Promise<{ buffer: Buffer; mime: string }> {
  let sharp: any;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    // Sharp unavailable — return raw file
    return { buffer: fs.readFileSync(inputPath), mime: mimetype };
  }

  const isGif = mimetype === "image/gif";
  if (isGif) {
    // GIFs: keep as-is (Sharp doesn't handle animated GIFs well)
    return { buffer: fs.readFileSync(inputPath), mime: mimetype };
  }

  const pipeline = sharp(inputPath)
    .resize(500, 500, { fit: "inside", withoutEnlargement: true });

  let buffer: Buffer;
  let outMime: string;

  // Convert everything to WebP for best size/quality ratio
  // WebP is ~30% smaller than JPEG at equivalent quality
  try {
    buffer = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer();
    outMime = "image/webp";
  } catch {
    // Fallback to JPEG
    buffer = await pipeline.jpeg({ quality: 82, progressive: true }).toBuffer();
    outMime = "image/jpeg";
  }

  const originalSize = fs.statSync(inputPath).size;
  const ratio = ((1 - buffer.length / originalSize) * 100).toFixed(0);
  console.log(`[compress] ${originalSize} → ${buffer.length} bytes (${ratio}% reduction)`);

  return { buffer, mime: outMime };
}

// ─── Irys client (lazy-init, cached) ─────────────────────────────────────────
let irysInstance: any = null;
async function getIrys() {
  if (irysInstance) return irysInstance;
  const { default: Irys } = await import("@irys/sdk");
  const keyPath = process.env.ARWEAVE_KEY_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error("ARWEAVE_KEY_PATH not set or file missing");
  }
  const key = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  const node = process.env.ARWEAVE_NODE ?? "https://node2.irys.xyz";
  irysInstance = new Irys({ url: node, token: "arweave", key });
  return irysInstance;
}

// ─── Multer (temp storage only) ───────────────────────────────────────────────
const TMP_DIR = path.join(process.cwd(), "tmp-uploads");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename:    (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".png"}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max raw
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPEG, PNG, GIF and WebP allowed"));
  },
});

export const uploadRouter = Router();

// ─── POST /api/upload/image ──────────────────────────────────────────────────
uploadRouter.post("/image", upload.single("image") as any, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "File content does not match declared image type" });
  }
  try {
    const { buffer, mime } = await compressImage(req.file.path, req.file.mimetype);
    fs.unlink(req.file.path, () => {});

    const irys = await getIrys();
    const receipt = await irys.upload(buffer, {
      tags: [
        { name: "Content-Type", value: mime },
        { name: "App-Name",     value: "JetForge" },
      ],
    });
    const url = `https://arweave.net/${receipt.id}`;
    console.log(`[upload] image → ${url} (${buffer.length} bytes, ${mime})`);
    return res.json({ url });
  } catch (err: any) {
    fs.unlink(req.file.path, () => {});
    console.error("[upload] image error:", err.message);
    return res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

// ─── POST /api/upload/token ──────────────────────────────────────────────────
// Uploads image + metadata JSON to Arweave via Irys in 2 transactions.
// Returns: { imageUrl, metadataUri }
uploadRouter.post("/token", upload.single("image") as any, async (req: Request, res: Response) => {
  const { name, symbol, description, creator, websiteUrl, twitterUrl, telegramUrl } = req.body;
  if (!name || !symbol) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "name and symbol are required" });
  }

  let imageUrl = "";
  let imageMime = "image/png";

  try {
    const irys = await getIrys();

    // Step 1: compress + upload image
    if (req.file) {
      if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "File content does not match image type" });
      }
      const { buffer, mime } = await compressImage(req.file.path, req.file.mimetype);
      fs.unlink(req.file.path, () => {});
      imageMime = mime;

      const imgReceipt = await irys.upload(buffer, {
        tags: [
          { name: "Content-Type", value: mime },
          { name: "App-Name",     value: "JetForge" },
          { name: "Type",         value: "token-image" },
          { name: "Token-Symbol", value: symbol },
        ],
      });
      imageUrl = `https://arweave.net/${imgReceipt.id}`;
      console.log(`[upload] token image → ${imageUrl}`);
    }

    // Step 2: build + upload metadata JSON
    const metadata = {
      name,
      symbol,
      description: description || `${name} ($${symbol}) — fair-launch token on JetForge.`,
      image: imageUrl,
      external_url: "https://jetforge.io",
      attributes: [
        { trait_type: "Platform", value: "JetForge" },
        { trait_type: "Network",  value: "Solana" },
        { trait_type: "Launch",   value: "Fair-Launch Bonding Curve" },
      ],
      properties: {
        files: imageUrl ? [{ uri: imageUrl, type: imageMime }] : [],
        category: "image",
        creators: creator ? [{ address: creator, share: 100 }] : [],
      },
      seller_fee_basis_points: 0,
      ...(websiteUrl  && { website:  websiteUrl  }),
      ...(twitterUrl  && { twitter:  twitterUrl  }),
      ...(telegramUrl && { telegram: telegramUrl }),
    };

    const metaBuffer = Buffer.from(JSON.stringify(metadata));
    const metaReceipt = await irys.upload(metaBuffer, {
      tags: [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name",     value: "JetForge" },
        { name: "Type",         value: "token-metadata" },
        { name: "Token-Symbol", value: symbol },
      ],
    });
    const metadataUri = `https://arweave.net/${metaReceipt.id}`;
    console.log(`[upload] token metadata → ${metadataUri}`);

    return res.json({ imageUrl, metadataUri });
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error("[upload] token error:", err.message);
    return res.status(500).json({ error: "Arweave upload failed: " + err.message });
  }
});

// ─── GET /api/upload/balance ─────────────────────────────────────────────────
uploadRouter.get("/balance", async (_req: Request, res: Response) => {
  try {
    const irys = await getIrys();
    const balance = await irys.getLoadedBalance();
    const price100kb = await irys.getPrice(102400);
    const pricePerLaunch = await irys.getPrice(51200 + 2048); // 50KB image + 2KB metadata
    return res.json({
      balance: balance.toString(),
      balanceAR: (Number(balance) / 1e12).toFixed(8),
      price100kbWinston: price100kb.toString(),
      pricePerLaunchWinston: pricePerLaunch.toString(),
      pricePerLaunchAR: (Number(pricePerLaunch) / 1e12).toFixed(8),
      estimatedLaunches: Math.floor(Number(balance) / Number(pricePerLaunch)),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/upload/fund ───────────────────────────────────────────────────
// Fund the Irys node. winstonAmount defaults to 50B (0.05 AR).
uploadRouter.post("/fund", async (req: Request, res: Response) => {
  const { secret, winstonAmount } = req.body;
  if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  try {
    const irys = await getIrys();
    const amount = BigInt(winstonAmount ?? "50000000000"); // default 0.05 AR
    const receipt = await irys.fund(amount);
    const balance = await irys.getLoadedBalance();
    return res.json({ funded: receipt.quantity.toString(), newBalance: balance.toString() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
