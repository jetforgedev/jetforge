const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tokens = [
  { name: 'DogePump', symbol: 'DPUMP', description: 'The doge that pumps forever', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=dogepump', mcap: 142000, vol: 38000, trades: 412, holders: 287 },
  { name: 'MoonCat', symbol: 'MCAT', description: 'Cats on the moon, for real this time', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=mooncat', mcap: 89500, vol: 21000, trades: 198, holders: 134 },
  { name: 'SolRocket', symbol: 'SRKT', description: 'Fastest token on Solana 🚀', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=solrocket', mcap: 67200, vol: 15400, trades: 321, holders: 89 },
  { name: 'MemeLord', symbol: 'MLRD', description: 'Supreme ruler of all memes', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=memelord', mcap: 310000, vol: 92000, trades: 874, holders: 612, graduated: true },
  { name: 'PepeSOL', symbol: 'PSOL', description: 'Feels good man, on-chain', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=pepesol', mcap: 55000, vol: 9800, trades: 143, holders: 76 },
  { name: 'WifHat', symbol: 'WIFH', description: 'Dog wif hat on Solana', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=wifhat', mcap: 228000, vol: 61000, trades: 543, holders: 401 },
  { name: 'BonkJr', symbol: 'BJNR', description: 'Son of bonk, ready to bonk', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bonkjr', mcap: 175000, vol: 44000, trades: 389, holders: 267 },
  { name: 'GigaBrain', symbol: 'GBRA', description: 'Only big brains hold this', imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=gigabrain', mcap: 12000, vol: 3200, trades: 47, holders: 23 },
];

function randomAddress() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

async function main() {
  console.log('Seeding mock data...');

  // Clear existing mock data
  await prisma.trade.deleteMany({});
  await prisma.token.deleteMany({});

  const solPrice = 83;

  for (const t of tokens) {
    const mint = randomAddress();
    const creator = randomAddress();
    const mcapSol = t.mcap / solPrice;
    const priceUsd = (t.mcap / 1e9) / solPrice * solPrice; // simplified

    // Derive bonding curve state from market cap
    const realSolReserves = BigInt(Math.floor(mcapSol * 1e9));
    const realTokenReserves = BigInt(700000000000000) - BigInt(Math.floor(t.trades * 100000000));

    const token = await prisma.token.create({
      data: {
        mint,
        name: t.name,
        symbol: t.symbol,
        description: t.description,
        imageUrl: t.imageUrl,
        creator,
        virtualSolReserves: BigInt(30000000000) + realSolReserves,
        virtualTokenReserves: BigInt(1073000191000000),
        realSolReserves,
        realTokenReserves: realTokenReserves > 0n ? realTokenReserves : BigInt(100000000000),
        totalSupply: BigInt(1000000000000000),
        marketCapSol: mcapSol,
        priceUsd: t.mcap / 1_000_000_000,
        volume24h: t.vol / solPrice,
        trades: t.trades,
        holders: t.holders,
        isGraduated: t.graduated || false,
        graduatedAt: t.graduated ? new Date(Date.now() - 3600000) : null,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000),
      },
    });

    // Add some trades
    const tradeCount = Math.min(t.trades, 8);
    for (let i = 0; i < tradeCount; i++) {
      const isBuy = Math.random() > 0.35;
      const solAmount = BigInt(Math.floor((Math.random() * 2 + 0.05) * 1e9));
      await prisma.trade.create({
        data: {
          signature: randomAddress() + randomAddress().slice(0, 44),
          mint,
          trader: randomAddress(),
          type: isBuy ? 'BUY' : 'SELL',
          solAmount,
          tokenAmount: solAmount * BigInt(10000),
          price: t.mcap / 1_000_000_000,
          fee: solAmount / BigInt(100),
          timestamp: new Date(Date.now() - Math.random() * 86400000),
        },
      });
    }

    console.log(`✓ ${t.name} (${t.symbol}) — $${t.mcap.toLocaleString()} mcap`);
  }

  console.log('\nDone! Seeded', tokens.length, 'tokens.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
