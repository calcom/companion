export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateDeliveryEnv } = await import("./lib/env");
  validateDeliveryEnv();
}
