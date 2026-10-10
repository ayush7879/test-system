export default async function apiRequest(url, options = {}, token = "") {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "auth-token": token } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.errors?.[0]?.msg || result.message || "Request failed. Please try again.");
  }
  return result;
}
