import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../index";

export const metadataRouter = Router();

// GET /api/metadata/:mint
// Returns Metaplex-standard metadata JSON for a token.
// This URL is stored as the `uri` in the on-chain createToken instruction.
// When the Anchor program is upgraded to create a Metaplex metadata account,
// blockchain explorers will fetch this URL and display name + image automatically.
metadataRouter.get("/:mint", async (req: Request, res: Response) => {
  const { mint } = req.params;

  try {
    const token = await prisma.token.findUnique({ where: { mint } });

    if (!token) {
      return res.status(404).json({ error: "Token not found" });
    }

    // Metaplex Token Metadata standard format
    const metadata = {
      name: token.name,
      symbol: token.symbol,
      description: token.description || `${token.name} ($${token.symbol}) — a fair-launch token on JetForge, the Solana bonding curve launchpad.`,
      image: token.imageUrl || "",
      external_url: `https://jetforge.io/token/${mint}`,
      attributes: [
        { trait_type: "Platform", value: "JetForge" },
        { trait_type: "Network", value: "Solana" },
        { trait_type: "Graduated", value: token.isGraduated ? "Yes" : "No" },
      ],
      properties: {
        files: token.imageUrl
          ? [{ uri: token.imageUrl, type: "image/png" }]
          : [],
        category: "image",
        creators: [{ address: token.creator, share: 100 }],
      },
      // Standard fields for Solana explorers
      seller_fee_basis_points: 0,
      collection: null,
    };

    // ETag based on content hash — allows clients/CDNs to skip unchanged metadata
    const etag = `"${crypto.createHash("md5").update(JSON.stringify({ n: token.name, s: token.symbol, i: token.imageUrl, u: token.updatedAt.getTime() })).digest("hex")}"`;
    if (req.get("if-none-match") === etag) return res.status(304).end();

    // Allow cross-origin so Metaplex validators and explorers can fetch it
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", token.updatedAt.toUTCString());
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(metadata);
  } catch (error) {
    console.error("GET /metadata/:mint error:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});
