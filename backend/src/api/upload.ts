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

  // Build the public URL — use SITE_URL env var (set to https://jetforge.io on VPS)
  const baseUrl =
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    `${req.protocol}://${req.get("host")}`;

  const url = `${baseUrl}/uploads/${req.file.filename}`;
  return res.json({ url });
});
