// Run: node scripts/splitwise-auth.mjs
// This gets a permanent Splitwise access token for your account

import { OAuth } from "oauth";
import * as readline from "readline";

const CONSUMER_KEY = "bp5e8TsbOMSMoJp4NAqGaoMknMqMJ55QUeB3yPth";
const CONSUMER_SECRET = "pEPPLCqsQK2LwpFO7n6yAHnPYKWUck56c6j2wIug";

const oauth = new OAuth(
  "https://secure.splitwise.com/api/v3.0/get_request_token",
  "https://secure.splitwise.com/api/v3.0/get_access_token",
  CONSUMER_KEY,
  CONSUMER_SECRET,
  "1.0",
  "oob",
  "HMAC-SHA1"
);

// Step 1: Get request token
oauth.getOAuthRequestToken((err, requestToken, requestTokenSecret) => {
  if (err) {
    console.error("Error getting request token:", err);
    process.exit(1);
  }

  const authUrl = `https://secure.splitwise.com/oauth/authorize?oauth_token=${requestToken}`;
  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n2. Authorize the app and copy the PIN/verifier code shown.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("3. Paste the verifier code here: ", (verifier) => {
    rl.close();

    // Step 2: Exchange for access token
    oauth.getOAuthAccessToken(requestToken, requestTokenSecret, verifier.trim(), (err2, accessToken, accessTokenSecret) => {
      if (err2) {
        console.error("Error getting access token:", err2);
        process.exit(1);
      }

      console.log("\n✅ Success! Add these to your .env and Vercel:\n");
      console.log(`SPLITWISE_ACCESS_TOKEN=${accessToken}`);
      console.log(`SPLITWISE_ACCESS_TOKEN_SECRET=${accessTokenSecret}`);
    });
  });
});
