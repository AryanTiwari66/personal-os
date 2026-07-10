const BASE = "https://secure.splitwise.com/api/v3.0";

async function swFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SPLITWISE_API_KEY}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const json = await res.json();
  console.log("Splitwise response:", JSON.stringify(json));
  return json;
}

export async function getBalances(): Promise<string> {
  const json = await swFetch("/get_current_user");
  if (!json.user) return "Could not fetch Splitwise data.";

  const friends = await swFetch("/get_friends");
  if (!friends.friends || friends.friends.length === 0) return "No friends found on Splitwise.";

  const lines: string[] = [];
  for (const f of friends.friends) {
    const balance = f.balance?.[0];
    if (balance && parseFloat(balance.amount) !== 0) {
      const amount = parseFloat(balance.amount);
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
  const friends = await swFetch("/get_friends");
  if (!friends.friends) return "Could not fetch friends list.";

  const friend = friends.friends.find((f: { first_name: string; last_name?: string }) =>
    `${f.first_name} ${f.last_name || ""}`.toLowerCase().includes(friendName.toLowerCase())
  );

  if (!friend) return `Couldn't find "${friendName}" in your Splitwise friends.`;

  const currentUser = await swFetch("/get_current_user");
  const myId = currentUser.user?.id;
  const half = Math.round((amount / 2) * 100) / 100;

  const body = {
    cost: amount.toString(),
    description,
    currency_code: "INR",
    users__0__user_id: myId,
    users__0__paid_share: amount.toString(),
    users__0__owed_share: half.toString(),
    users__1__user_id: friend.id,
    users__1__paid_share: "0",
    users__1__owed_share: half.toString(),
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
