import { apiFetch, apiUrl } from "../../config/api";
import catalog from "./counter-catalog.json" with { type: "json" };
import { saveTop10MP4 } from "./download";
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

export function downloadMP4(render, onProgress, projectId) {
  return saveTop10MP4({
    render: { ...render, url: mediaUrl(render?.url) },
    onProgress,
    // Keep long media transfers outside the central JSON timeout/retry policy.
    request: (url, options) => fetch(url, { ...options, credentials: "omit", cache: "no-store" }),
    refreshRender: projectId ? async () => {
      const project = await loadProject(projectId);
      return project.last_render ? { ...project.last_render, url: mediaUrl(project.last_render.url) } : null;
    } : undefined,
  });
}
