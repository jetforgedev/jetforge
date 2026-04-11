import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

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
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
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
uploadRouter.post("/image", upload.single("image") as any, (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }

  // Validate actual file content against magic bytes (prevents MIME spoofing)
  if (!validateMagicBytes(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "File content does not match declared image type" });
  }

  const baseUrl =
    process.env.SITE_URL ||
    `${req.protocol}://${req.get("host")}`;

  const url = `${baseUrl}/uploads/${req.file.filename}`;
  return res.json({ url });
});
