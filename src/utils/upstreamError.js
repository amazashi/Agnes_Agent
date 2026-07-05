export async function readUpstreamError(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text || `HTTP ${response.status}`;
  }
}
