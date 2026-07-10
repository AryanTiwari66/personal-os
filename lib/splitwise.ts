import crypto from "crypto";

const BASE = "https://secure.splitwise.com/api/v3.0";
const CONSUMER_KEY = process.env.SPLITWISE_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.SPLITWISE_CONSUMER_SECRET!;
const ACCESS_TOKEN = process.env.SPLITWISE_ACCESS_TOKEN!;
const ACCESS_TOKEN_SECRET = process.env.SPLITWISE_ACCESS_TOKEN_SECRET!;

function signRequest(method: string, url: string): string {
  const params: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(CONSUMER_SECRET)}&${encodeURIComponent(ACCESS_TOKEN_SECRET)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  params.oauth_signature = signature;

  return (
    "OAuth " +
    Object.keys(params)
      .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
      .join(", ")
  );
}

async function swFetch(path: string, options?: RequestInit) {
  const url = `${BASE}${path}`;
  const method = (options?.method || "GET").toUpperCase();
  const authHeader = signRequest(method, url);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = await res.json();
  console.log("Splitwise response:", JSON.stringify(json));
  return json;
}

export async function getBalances(): Promise<string> {
  const friends = await swFetch("/get_friends");
  if (!friends.friends || friends.friends.length === 0) return "No friends found on Splitwise.";

  const lines: string[] = [];
  for (const f of friends.friends) {
    if (!f.balance || f.balance.length === 0) continue;
    for (const b of f.balance) {
      const amount = parseFloat(b.amount);
      if (amount === 0) continue;
      const name = `${f.first_name} ${f.last_name || ""}`.trim();
      lines.push(amount > 0 ? `${name} owes you ₹${Math.abs(amount)}` : `You owe ${name} ₹${Math.abs(amount)}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "All settled up!";
}

export async function createSplitExpense(
  description: string,
  amount: number,
  friendName: string
): Promise<string> {
  const [friendsRes, currentUserRes] = await Promise.all([
    swFetch("/get_friends"),
    swFetch("/get_current_user"),
  ]);

  if (!friendsRes.friends) return "Could not fetch friends list.";

  const friend = friendsRes.friends.find((f: { first_name: string; last_name?: string }) =>
    `${f.first_name} ${f.last_name || ""}`.toLowerCase().includes(friendName.toLowerCase())
  );

  if (!friend) return `Couldn't find "${friendName}" in your Splitwise friends.`;

  const myId = currentUserRes.user?.id;
  const half = Math.round((amount / 2) * 100) / 100;

  const body = {
    cost: amount.toFixed(2),
    description,
    currency_code: "INR",
    users__0__user_id: myId,
    users__0__paid_share: amount.toFixed(2),
    users__0__owed_share: half.toFixed(2),
    users__1__user_id: friend.id,
    users__1__paid_share: "0.00",
    users__1__owed_share: half.toFixed(2),
  };

  const res = await swFetch("/create_expense", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (res.errors && Object.keys(res.errors).length > 0) {
    return `Failed to create expense: ${JSON.stringify(res.errors)}`;
  }

  return `Split ₹${amount} for "${description}" with ${friend.first_name}. They owe you ₹${half}.`;
}
