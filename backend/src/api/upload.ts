import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// Magic bytes for allowed image types
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47]],
  "image/gif":  [[0x47, 0x49, 0x46, 0x38]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (checked with offset 8 = WEBP)
};

function validateMagicBytes(filePath: string, mimetype: string): boolean {
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    const signatures = MAGIC_BYTES[mimetype];
    if (!signatures) return false;
    return signatures.some((sig) => sig.every((byte, i) => buf[i] === byte));
  } catch {
    return false;
  }
}

export const uploadRouter = Router();

// ─── Upload directory ─────────────────────────────────────────────────────────
// Use __dirname (dist/api/) so the path is always relative to the compiled
// file, not process.cwd() which PM2 may set to /root in cluster mode.
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
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
uploadRouter.post("/image", upload.single("image") as any, async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }

  // Validate actual file content against magic bytes (prevents MIME spoofing)
  if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "File content does not match declared image type" });
  }

  // ── Optimise: resize to max 400px and convert to WebP ──────────────────────
  // Images are displayed at 74×74 on the homepage (400px = 5× headroom for
  // retina + token detail page). WebP cuts file size by ~80% vs raw PNG.
  const originalPath = req.file.path;
  const webpFilename  = `${path.basename(req.file.filename, path.extname(req.file.filename))}.webp`;
  const webpPath      = path.join(UPLOAD_DIR, webpFilename);

  try {
    await sharp(originalPath)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(webpPath);

    // Delete the original now that WebP is saved
    fs.unlink(originalPath, () => {});
  } catch (err) {
    // If sharp fails (corrupt file etc.) fall back to serving the original
    console.error("[UPLOAD] sharp processing failed, serving original:", err);
    const siteUrl = process.env.SITE_URL ?? "";
    const isLocalhost = siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const baseUrl = siteUrl && !isLocalhost ? siteUrl : `${req.protocol}://${req.get("host")}`;
    return res.json({ url: `${baseUrl}/uploads/${req.file.filename}` });
  }
  // ───────────────────────────────────────────────────────────────────────────

  // Prefer SITE_URL env var, but ONLY when it points to a real host.
  // If it is localhost/127.0.0.1 (e.g. left over from dev config on the VPS)
  // fall back to the forwarded request host so the stored URL is always
  // the public production URL (requires nginx to set X-Forwarded-Proto + Host).
  const siteUrl = process.env.SITE_URL ?? "";
  const isLocalhost =
    siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
  const baseUrl = siteUrl && !isLocalhost
    ? siteUrl
    : `${req.protocol}://${req.get("host")}`;

  return res.json({ url: `${baseUrl}/uploads/${webpFilename}` });
});
