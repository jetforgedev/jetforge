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

// ─── Multer (temp storage for validation only) ────────────────────────────────
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

export const uploadRouter = Router();

// ─── POST /api/upload/image ──────────────────────────────────────────────────
// Uploads a single image to Arweave via Irys.
// Returns: { url: "https://arweave.net/<TX_ID>" }
uploadRouter.post("/image", upload.single("image") as any, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "File content does not match declared image type" });
  }

  try {
    const irys = await getIrys();
    const data = fs.readFileSync(req.file.path);
    const receipt = await irys.upload(data, {
      tags: [
        { name: "Content-Type",        value: req.file.mimetype },
        { name: "App-Name",            value: "JetForge" },
        { name: "App-Version",         value: "1.0.0" },
      ],
    });
    fs.unlink(req.file.path, () => {});
    const url = `https://arweave.net/${receipt.id}`;
    console.log(`[upload] Image → Arweave: ${url}`);
    return res.json({ url });
  } catch (err: any) {
    fs.unlink(req.file.path, () => {});
    console.error("[upload] Irys image upload failed:", err.message);
    return res.status(500).json({ error: "Failed to upload image to Arweave: " + err.message });
  }
});

// ─── POST /api/upload/token ──────────────────────────────────────────────────
// Combined endpoint: accepts image file + token metadata fields.
// 1. Uploads image to Arweave
// 2. Builds Metaplex-standard metadata JSON
// 3. Uploads metadata JSON to Arweave
// Returns: { imageUrl, metadataUri }
// Frontend uses metadataUri as the on-chain `uri` field.
uploadRouter.post("/token", upload.single("image") as any, async (req: Request, res: Response) => {
  const { name, symbol, description, creator, websiteUrl, twitterUrl, telegramUrl } = req.body;

  if (!name || !symbol) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "name and symbol are required" });
  }

  try {
    const irys = await getIrys();
    let imageUrl = "";

    // Step 1: Upload image if provided
    if (req.file) {
      if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: "File content does not match declared image type" });
      }
      const imgData = fs.readFileSync(req.file.path);
      const imgReceipt = await irys.upload(imgData, {
        tags: [
          { name: "Content-Type", value: req.file.mimetype },
          { name: "App-Name",     value: "JetForge" },
          { name: "Type",         value: "token-image" },
          { name: "Token-Symbol", value: symbol },
        ],
      });
      fs.unlink(req.file.path, () => {});
      imageUrl = `https://arweave.net/${imgReceipt.id}`;
      console.log(`[upload] Token image → ${imageUrl}`);
    }

    // Step 2: Build Metaplex-standard metadata JSON
    const metadata = {
      name,
      symbol,
      description: description || `${name} ($${symbol}) — fair-launch token on JetForge, the Solana bonding curve launchpad.`,
      image: imageUrl,
      external_url: "https://jetforge.io",
      attributes: [
        { trait_type: "Platform",  value: "JetForge" },
        { trait_type: "Network",   value: "Solana" },
        { trait_type: "Launch",    value: "Fair-Launch Bonding Curve" },
      ],
      properties: {
        files: imageUrl ? [{ uri: imageUrl, type: req.file?.mimetype ?? "image/png" }] : [],
        category: "image",
        creators: creator ? [{ address: creator, share: 100 }] : [],
      },
      seller_fee_basis_points: 0,
      // Social links as extensions (recognised by some explorers)
      ...(websiteUrl  && { website:  websiteUrl  }),
      ...(twitterUrl  && { twitter:  twitterUrl  }),
      ...(telegramUrl && { telegram: telegramUrl }),
    };

    // Step 3: Upload metadata JSON to Arweave
    const metaBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    const metaReceipt = await irys.upload(metaBuffer, {
      tags: [
        { name: "Content-Type", value: "application/json" },
        { name: "App-Name",     value: "JetForge" },
        { name: "Type",         value: "token-metadata" },
        { name: "Token-Symbol", value: symbol },
      ],
    });
    const metadataUri = `https://arweave.net/${metaReceipt.id}`;
    console.log(`[upload] Token metadata → ${metadataUri}`);

    return res.json({ imageUrl, metadataUri });
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error("[upload] Token upload failed:", err.message);
    return res.status(500).json({ error: "Failed to upload to Arweave: " + err.message });
  }
});

// ─── POST /api/upload/fund ───────────────────────────────────────────────────
// Fund the Irys node from the Arweave wallet. Admin-only (requires secret).
// Body: { secret, winstonAmount }
uploadRouter.post("/fund", async (req: Request, res: Response) => {
  const { secret, winstonAmount } = req.body;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const irys = await getIrys();
    const amount = BigInt(winstonAmount ?? "100000000000"); // default 0.1 AR
    const receipt = await irys.fund(amount);
    const balance = await irys.getLoadedBalance();
    return res.json({ funded: receipt.quantity.toString(), newBalance: balance.toString() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/upload/balance ─────────────────────────────────────────────────
// Returns the current Irys node balance (for monitoring).
uploadRouter.get("/balance", async (_req: Request, res: Response) => {
  try {
    const irys = await getIrys();
    const balance = await irys.getLoadedBalance();
    const price100kb = await irys.getPrice(102400);
    return res.json({
      balance: balance.toString(),
      balanceAR: (Number(balance) / 1e12).toFixed(6),
      price100kbWinston: price100kb.toString(),
      estimatedUploads: Math.floor(Number(balance) / Number(price100kb)),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
