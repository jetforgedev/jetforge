import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

export const uploadRouter = Router();

// ─── Upload directory ─────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Magic byte signatures for allowed image types ────────────────────────────
const MAGIC_SIGNATURES: { magic: Buffer; offset: number; ext: string }[] = [
  { magic: Buffer.from([0xff, 0xd8, 0xff]),                         offset: 0, ext: ".jpg" },
  { magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), offset: 0, ext: ".png" },
  { magic: Buffer.from([0x47, 0x49, 0x46, 0x38]),                   offset: 0, ext: ".gif" },
  { magic: Buffer.from([0x52, 0x49, 0x46, 0x46]),                   offset: 0, ext: ".webp" }, // RIFF header (checked with WEBP below)
];

function detectImageType(buf: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const slice = buf.slice(sig.offset, sig.offset + sig.magic.length);
    if (slice.equals(sig.magic)) {
      // Extra check for WebP: bytes 8-11 must be "WEBP"
      if (sig.ext === ".webp") {
        if (buf.length < 12) return null;
        const webpMarker = buf.slice(8, 12);
        if (!webpMarker.equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))) return null;
      }
      return sig.ext;
    }
  }
  return null;
}

// ─── Multer config — memory storage so we can check magic bytes ───────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF and WebP images are allowed"));
    }
  },
});

// POST /api/upload/image
uploadRouter.post("/image", upload.single("image") as any, (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }

  // Verify actual file content via magic bytes (prevents MIME spoofing)
  const ext = detectImageType(req.file.buffer);
  if (!ext) {
    return res.status(400).json({ error: "File content does not match an allowed image type" });
  }

  // Write to disk with UUID filename + safe whitelisted extension
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, req.file.buffer);

  // Build public URL from explicit env var only — never trust request headers
  const apiBase = (process.env.API_URL || process.env.SITE_URL || "https://api.jetforge.io")
    .replace(/\/$/, "");
  const url = `${apiBase}/uploads/${filename}`;
  return res.json({ url });
});
