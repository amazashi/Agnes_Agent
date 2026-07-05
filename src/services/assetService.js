import { refreshOssAssetUrl } from "../oss/bitifulClient.js";

export function refreshRunAssets(run) {
  if (!run?.response) return run;
  const response = { ...run.response };
  if (Array.isArray(response.ossImages)) response.ossImages = response.ossImages.map(refreshOssAssetUrl);
  if (response.ossVideo) response.ossVideo = refreshOssAssetUrl(response.ossVideo);
  if (response.inputImage) response.inputImage = refreshOssAssetUrl(response.inputImage);
  if (Array.isArray(response.transitionFrames)) {
    response.transitionFrames = response.transitionFrames.map((item) => ({
      ...item,
      frame: refreshOssAssetUrl(item.frame),
    }));
  }
  if (Array.isArray(response.videoSegments)) {
    response.videoSegments = response.videoSegments.map((segment) => ({
      ...segment,
      ossVideo: refreshOssAssetUrl(segment.ossVideo),
    }));
  }
  if (response.imageResult?.ossImages) {
    response.imageResult = {
      ...response.imageResult,
      ossImages: response.imageResult.ossImages.map(refreshOssAssetUrl),
    };
  }
  if (response.videoResult?.ossVideo) {
    response.videoResult = {
      ...response.videoResult,
      ossVideo: refreshOssAssetUrl(response.videoResult.ossVideo),
    };
  }
  return { ...run, response };
}
