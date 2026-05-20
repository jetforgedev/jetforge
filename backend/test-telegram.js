// Run with: node test-telegram.js
// Tests that your Telegram bot token and chat ID are working
require('dotenv').config();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env');
  process.exit(1);
}

fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    text: '<b>JetForge Bot Connected!</b>

Your Telegram alerts are working. You will now receive:
New token launches
Big buys (1+ SOL)
Big sells (1+ SOL)
Graduations to Raydium',
    parse_mode: 'HTML',
  }),
})
.then(r => r.json())
.then(d => {
  if (d.ok) console.log('Test message sent successfully!');
  else console.error('Failed:', d.description);
})
.catch(e => console.error('Error:', e.message));
