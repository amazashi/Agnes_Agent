export function buildVideoPrompt(input) {
  if (input.prompt) return String(input.prompt).trim();
  return [
    input.scene || "clean modern workspace",
    input.subject || "an AI video editing dashboard",
    input.action || "interface panels animate smoothly",
    input.camera || "slow cinematic push-in, stable composition",
    input.lighting || "bright soft studio lighting, premium calm atmosphere",
  ].map((part) => String(part || "").trim()).filter(Boolean).join(", ");
}
