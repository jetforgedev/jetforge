import { Router, Request, Response } from "express";
import * as telegram from "../services/telegramService";
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
async function compressImage(inputPath: string, mimetype: string): Promise<{ buffer: Buffer; mime: string }> {
  let sharp: any;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return { buffer: fs.readFileSync(inputPath), mime: mimetype };
  }

  if (mimetype === "image/gif") {
    return { buffer: fs.readFileSync(inputPath), mime: mimetype };
  }

  const pipeline = sharp(inputPath)
    .resize(500, 500, { fit: "inside", withoutEnlargement: true });

  let buffer: Buffer;
  let outMime: string;

  try {
    buffer = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer();
    outMime = "image/webp";
  } catch {
    buffer = await pipeline.jpeg({ quality: 82, progressive: true }).toBuffer();
    outMime = "image/jpeg";
  }

  const originalSize = fs.statSync(inputPath).size;
  const ratio = ((1 - buffer.length / originalSize) * 100).toFixed(0);
  console.log(`[compress] ${originalSize} → ${buffer.length} bytes (${ratio}% reduction)`);

  return { buffer, mime: outMime };
}

// ─── Local permanent storage ──────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const API_BASE = process.env.API_BASE_URL || "https://api.jetforge.io";

function saveLocally(buffer: Buffer, mime: string): { localPath: string; localUrl: string } {
  const ext = mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const filename = `${uuidv4()}.${ext}`;
  const localPath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(localPath, buffer);
  return { localPath, localUrl: `${API_BASE}/uploads/${filename}` };
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

// Upload buffer to Arweave via Irys (non-throwing — returns null on failure)
async function uploadToArweave(
  buffer: Buffer,
  mime: string,
  tags: { name: string; value: string }[]
): Promise<string | null> {
  try {
    const irys = await getIrys();
    const receipt = await irys.upload(buffer, { tags });
    return `https://arweave.net/${receipt.id}`;
  } catch (err: any) {
    console.warn("[upload] Arweave upload failed:", err.message?.slice(0, 100));
    return null;
  }
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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPEG, PNG, GIF and WebP allowed"));
  },
});

// ─── Arweave balance monitor ─────────────────────────────────────────────────
const ARWEAVE_WALLET = "4lWeUCmse28Ps6AkpJdMGw49YHJegYp5ox5o2R9YimU";
const LOW_BALANCE_THRESHOLD = 20; // alert when fewer than 20 launches remain
let lastAlertAt = 0;

async function checkArweaveBalance(): Promise<void> {
  try {
    const irys = await getIrys();
    const balance = await irys.getLoadedBalance();
    const pricePerLaunch = await irys.getPrice(51200 + 2048);
    const launches = Math.floor(Number(balance) / Number(pricePerLaunch));
    const balanceAR = (Number(balance) / 1e12).toFixed(6);
    console.log(`[arweave] Balance: ${balanceAR} AR (~${launches} launches left)`);
    const now = Date.now();
    if (launches < LOW_BALANCE_THRESHOLD && now - lastAlertAt > 12 * 3_600_000) {
      lastAlertAt = now;
      await telegram.notifyLowArweaveBalance({ balanceAR, estimatedLaunches: launches, walletAddress: ARWEAVE_WALLET });
      console.log(`[arweave] Low balance Telegram alert sent (${launches} launches left)`);
    }
  } catch (err: any) {
    console.warn("[arweave] Balance check failed:", err.message?.slice(0, 80));
  }
}

// Check every 6 hours
setInterval(() => { checkArweaveBalance().catch(() => {}); }, 6 * 60 * 60 * 1000);
// First check 30s after startup
setTimeout(() => { checkArweaveBalance().catch(() => {}); }, 30_000);

export const uploadRouter = Router();

// ─── POST /api/upload/image ──────────────────────────────────────────────────
// Returns { url } immediately (local URL). Arweave upload happens in background.
uploadRouter.post("/image", upload.single("image") as any, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "File content does not match declared image type" });
  }
  try {
    const { buffer, mime } = await compressImage(req.file.path, req.file.mimetype);
    fs.unlink(req.file.path, () => {});

    // Save locally — instant, always available
    const { localUrl } = saveLocally(buffer, mime);

    // Upload to Arweave in background — don't block the response
    uploadToArweave(buffer, mime, [
      { name: "Content-Type", value: mime },
      { name: "App-Name",     value: "JetForge" },
    ]).then((arweaveUrl) => {
      if (arweaveUrl) console.log(`[upload] image → Arweave ${arweaveUrl} (${buffer.length} bytes)`);
    });

    console.log(`[upload] image saved locally → ${localUrl}`);
    return res.json({ url: localUrl });
  } catch (err: any) {
    fs.unlink(req.file.path, () => {});
    console.error("[upload] image error:", err.message);
    return res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

// ─── POST /api/upload/token ──────────────────────────────────────────────────
// Strategy:
//   1. Compress image
//   2. Save to local disk immediately → imageUrl (fast, always available)
//   3. Upload image to Arweave (with timeout fallback to local URL)
//   4. Build metadata JSON pointing to Arweave image (or local if Arweave failed)
//   5. Upload metadata to Arweave → metadataUri (on-chain permanent URI)
// Returns: { imageUrl, metadataUri }
uploadRouter.post("/token", upload.single("image") as any, async (req: Request, res: Response) => {
  const { name, symbol, description, creator, websiteUrl, twitterUrl, telegramUrl } = req.body;
  if (!name || !symbol) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "name and symbol are required" });
  }

  let imageUrl = "";    // local URL — goes into DB, shown immediately on site
  let imageMime = "image/png";
  let arweaveImageUrl = ""; // Arweave URL — goes into metadata JSON

  try {
    // Step 1: compress + dual-store image
    if (req.file) {
      if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "File content does not match image type" });
      }
      const { buffer, mime } = await compressImage(req.file.path, req.file.mimetype);
      fs.unlink(req.file.path, () => {});
      imageMime = mime;

      // 1a. Save locally — instant
      const { localUrl } = saveLocally(buffer, mime);
      imageUrl = localUrl;

      // 1b. Upload to Arweave — may take time, use local as fallback
      const awUrl = await uploadToArweave(buffer, mime, [
        { name: "Content-Type", value: mime },
        { name: "App-Name",     value: "JetForge" },
        { name: "Type",         value: "token-image" },
        { name: "Token-Symbol", value: symbol },
      ]);
      arweaveImageUrl = awUrl ?? localUrl; // fallback to local if Arweave fails
      if (awUrl) console.log(`[upload] token image → Arweave ${awUrl}`);
      else       console.log(`[upload] token image → local only ${localUrl} (Arweave failed)`);
    }

    // Step 2: build + upload metadata JSON
    const metadata = {
      name,
      symbol,
      description: description || `${name} ($${symbol}) — fair-launch token on JetForge.`,
      image: arweaveImageUrl || imageUrl,
      external_url: "https://jetforge.io",
      attributes: [
        { trait_type: "Platform", value: "JetForge" },
        { trait_type: "Network",  value: "Solana" },
        { trait_type: "Launch",   value: "Fair-Launch Bonding Curve" },
      ],
      properties: {
        files: (arweaveImageUrl || imageUrl) ? [{ uri: arweaveImageUrl || imageUrl, type: imageMime }] : [],
        category: "image",
        creators: creator ? [{ address: creator, share: 100 }] : [],
      },
      seller_fee_basis_points: 0,
      ...(websiteUrl  && { website:  websiteUrl  }),
      ...(twitterUrl  && { twitter:  twitterUrl  }),
      ...(telegramUrl && { telegram: telegramUrl }),
    };

    const metaBuffer = Buffer.from(JSON.stringify(metadata));
    let metadataUri = "";
    const metaArweaveUrl = await uploadToArweave(metaBuffer, "application/json", [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name",     value: "JetForge" },
      { name: "Type",         value: "token-metadata" },
      { name: "Token-Symbol", value: symbol },
    ]);
    if (metaArweaveUrl) {
      metadataUri = metaArweaveUrl;
      console.log(`[upload] token metadata → Arweave ${metadataUri}`);
    } else {
      // Fallback: serve metadata locally
      const { localUrl: metaLocalUrl } = saveLocally(metaBuffer, "application/json");
      metadataUri = metaLocalUrl;
      console.log(`[upload] token metadata → local ${metadataUri} (Arweave failed)`);
    }

    return res.json({ imageUrl, arweaveImageUrl, metadataUri });
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error("[upload] token error:", err.message);
    return res.status(500).json({ error: "Upload failed: " + err.message });
  }
});

// ─── GET /api/upload/balance ─────────────────────────────────────────────────
uploadRouter.get("/balance", async (_req: Request, res: Response) => {
  try {
    const irys = await getIrys();
    const balance = await irys.getLoadedBalance();
    const price100kb = await irys.getPrice(102400);
    const pricePerLaunch = await irys.getPrice(51200 + 2048);
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
uploadRouter.post("/fund", async (req: Request, res: Response) => {
  const { secret, winstonAmount } = req.body;
  if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: "Forbidden" });
  try {
    const irys = await getIrys();
    const amount = BigInt(winstonAmount ?? "50000000000");
    const receipt = await irys.fund(amount);
    const balance = await irys.getLoadedBalance();
    return res.json({ funded: receipt.quantity.toString(), newBalance: balance.toString() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
