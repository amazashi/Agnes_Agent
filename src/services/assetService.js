import { refreshOssAssetUrl } from "../oss/bitifulClient.js";

export function refreshRunAssets(run) {
  if (!run?.response) return run;
  const response = { ...run.response };
  if (Array.isArray(response.ossImages)) response.ossImages = response.ossImages.map(refreshOssAssetUrl);
  if (response.ossVideo) response.ossVideo = refreshOssAssetUrl(response.ossVideo);
  if (response.inputImage) response.inputImage = refreshOssAssetUrl(response.inputImage);
  return { ...run, response };
}
