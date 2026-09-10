import { auth } from "../firebase/firebase.config"

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/quotes$/, "").replace(/\/$/, "")

async function request(path, { method = "GET", body, auth: needsAuth = true, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers["Content-Type"] = "application/json"

  if (needsAuth) {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  postForm: (path, formData) => request(path, { method: "POST", body: formData, isForm: true }),
  public: {
    get: (path) => request(path, { auth: false }),
    post: (path, body) => request(path, { method: "POST", body, auth: false }),
  },
}
