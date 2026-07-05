export function agnesEndpoint(baseUrl, path) {
  const cleanBase = String(baseUrl || "").replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return cleanBase.endsWith("/v1") ? `${cleanBase}/${cleanPath.replace(/^v1\//, "")}` : `${cleanBase}/${cleanPath}`;
}
