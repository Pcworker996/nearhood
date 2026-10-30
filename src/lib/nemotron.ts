// Chat completions for Discovery and Source checks. Report processing keeps
// its own staged client in report-model.ts.
export function nemotronModel() {
  const model = process.env.NEBIUS_MODEL;
  const key = process.env.NEBIUS_API_KEY;
  if (!key || !model || !/^nvidia\//i.test(model) || !/nemotron/i.test(model))
    throw Error("Configure a qualified NVIDIA Nemotron model and Nebius key");
  return { model, key };
}

export async function nemotronChat(payload: object, timeoutMs: number) {
  const { model, key } = nemotronModel();
  const response = await fetch(
    `${(process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1").replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(Math.max(1000, timeoutMs)),
      body: JSON.stringify({
        model,
        ...(/nemotron-3[-_/]/i.test(model)
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
        temperature: 0,
        ...payload,
      }),
    },
  );
  if (!response.ok)
    throw Error(`Nebius chat completion failed (HTTP ${response.status}).`);
  const body = await response.json();
  const choice = body.choices?.[0];
  if (!choice?.message) throw Error("Nebius returned no message.");
  return {
    message: choice.message as {
      content?: string | null;
      tool_calls?: {
        id: string;
        function: { name: string; arguments: string };
      }[];
    },
    finishReason: choice.finish_reason as string,
  };
}
