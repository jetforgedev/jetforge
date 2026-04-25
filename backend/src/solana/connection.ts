import { Connection } from "@solana/web3.js";
import { config } from "../config";

/**
 * Singleton Solana RPC connection per Node process.
 *
 * Creating new Connection objects per request is expensive and increases
 * concurrent socket usage against the RPC provider. Reuse one instance for all
 * backend codepaths that just need read RPC calls.
 */
let _connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (_connection) return _connection;
  _connection = new Connection(config.solana.rpcUrl, {
    wsEndpoint: config.solana.wsUrl,
    commitment: "confirmed",
  });
  return _connection;
}

