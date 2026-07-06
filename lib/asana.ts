export async function createAsanaTask(title: string) {
  const res = await fetch("https://app.asana.com/api/1.0/tasks", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.ASANA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        name: title,
        projects: [process.env.ASANA_PROJECT_GID],
      },
    }),
  });
  const json = await res.json();
  console.log("Asana response:", JSON.stringify(json));
  return json.data;
}
