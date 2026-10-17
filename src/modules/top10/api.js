import { apiFetch, apiUrl } from "../../config/api";
import catalog from "./counter-catalog.json" with { type: "json" };
async function read(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Falha na operação do TOP 10",
    );
  return data;
}
const request = (path, options = {}) =>
  apiFetch(apiUrl(`/api/top10${path}`), options).then(read);
const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const listProjects = () => request("/projects");
export const loadProject = (id) => request(`/projects/${id}`);
export const createProject = (title) =>
  request("/projects", json("POST", { title }));
export const importForgeMax = (videoId, clipIds, title) => request("/imports/forge-max", {
  ...json("POST", { video_id: videoId, clip_ids: clipIds, title }),
  timeoutMs: 120000,
});
export const saveProject = (id, body) =>
  request(`/projects/${id}`, json("PUT", body));
export const generateSceneHeadline = (id, slot, body) => request(`/projects/${id}/scenes/${slot}/generate-headline`, {
  ...json('POST', body), timeoutMs: 150000, retries: 0,
});
export const deleteProject = (id) =>
  request(`/projects/${id}`, { method: "DELETE" });
export const deleteAsset = (id, asset) =>
  request(`/projects/${id}/assets/${asset}`, { method: "DELETE" });
export const uploadAsset = (id, kind, slot, file) => {
  const body = new FormData();
  body.append("file", file);
  return request(
    `/projects/${id}/assets?kind=${kind}${slot == null ? "" : `&slot=${slot}`}`,
    { method: "POST", body },
  );
};
export const startExport = (id, revision) =>
  request(`/projects/${id}/exports`, json("POST", { revision }));
export const getExport = (id, job) => request(`/projects/${id}/exports/${job}`);
export const cancelExport = (id, job) =>
  request(`/projects/${id}/exports/${job}/cancel`, { method: "POST" });
export const mediaUrl = (value) => (value ? apiUrl(value) : "");
export const counterUrl = (model, rank) =>
  apiUrl(`/api/top10/counters/${model}/${rank}.mp4?v=${catalog.revision}`);

export async function downloadMP4(render, onProgress) {
  const url = mediaUrl(render.url);
  // The picker must be opened synchronously inside the user's click.
  const handlePromise = window.showSaveFilePicker?.({
    suggestedName: render.filename,
    types: [{ description: "Vídeo MP4", accept: { "video/mp4": [".mp4"] } }],
  });
  if (!handlePromise) {
    const anchor = document.createElement("a");
    anchor.href = `${url}${url.includes("?") ? "&" : "?"}download=true`;
    anchor.download = render.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return "started";
  }
  let file, reader;
  try {
    const handle = await handlePromise;
    const response = await apiFetch(url);
    if (
      !response.ok ||
      !(response.headers.get("content-type") || "").startsWith("video/mp4")
    )
      throw new Error("Não foi possível baixar o MP4");
    file = await handle.createWritable();
    reader = response.body.getReader();
    let size = 0;
    const length = Number(response.headers.get("content-length"));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await file.write(value);
      size += value.length;
      onProgress?.(length > 0 ? Math.round((size / length) * 100) : 0);
    }
    if (!size || (length > 0 && size !== length))
      throw new Error("Download incompleto. O arquivo parcial foi descartado.");
    await file.close();
    return "saved";
  } catch (error) {
    await file?.abort().catch(() => {});
    await reader?.cancel().catch(() => {});
    if (error.name === "AbortError") return "cancelled";
    throw error;
  } finally {
    reader?.releaseLock();
  }
}
