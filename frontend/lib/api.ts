/**
 * API Configuration and Utilities
 * Centralized API client for all backend communication
 */

// Get API URL from environment variable with fallback
export const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return url;
})();

export const WS_URL = (() => {
  const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
  return url;
})();

/**
 * Session Management - Generate and store session ID in browser
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("workflow_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    sessionStorage.setItem("workflow_session_id", sessionId);

    // Cleanup on tab close
    window.addEventListener("beforeunload", () => {
      cleanupSession(sessionId!);
    });
  }
  return sessionId;
}

/**
 * Cleanup session data when tab closes
 */
async function cleanupSession(sessionId: string) {
  try {
    await fetch(apiUrl(`api/workflows/session/${sessionId}`), {
      method: "DELETE",
      keepalive: true, // Important: allows request to complete even after page unload
    });
  } catch {}
}

/**
 * Build API endpoint URL
 */
export function apiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
}

/**
 * Build WebSocket URL
 */
export function wsUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${WS_URL}/${cleanPath}`;
}

/**
 * Fetch wrapper with error handling
 */
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = apiUrl(path);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;

    // Try to parse as JSON, fallback to text
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * API Client with typed methods
 */
export const api = {
  // Workflows
  workflows: {
    list: () => {
      const sessionId = getSessionId();
      return apiFetch(`/api/workflows/?session_id=${sessionId}`);
    },
    get: (id: string) => apiFetch(`/api/workflows/${id}`),
    create: (data: {
      name: string;
      description?: string;
      nodes?: any[];
      edges?: any[];
    }) => {
      const sessionId = getSessionId();
      return apiFetch(`/api/workflows/?session_id=${sessionId}`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    update: (id: string, data: any) =>
      apiFetch(`/api/workflows/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    execute: (id: string, input_data: any) =>
      apiFetch(`/api/workflows/${id}/execute`, {
        method: "POST",
        body: JSON.stringify({ input_data }),
      }),
  },

  // Executions
  executions: {
    get: (id: string) => apiFetch(`/api/executions/${id}`),
    narrate: (id: string) => apiFetch(`/api/executions/${id}/narrate`),
  },

  // Approvals
  approvals: {
    approve: (executionId: string, data: any) =>
      apiFetch(`/api/approvals/${executionId}/approve`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deny: (executionId: string, reason: string) =>
      apiFetch(`/api/approvals/${executionId}/deny`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
  },

  // Node Types
  nodeTypes: {
    list: () => apiFetch("/api/node-types"),
  },

  // Metrics
  metrics: {
    summary: () => apiFetch("/api/metrics/summary"),
    agents: () => apiFetch("/api/metrics/agents"),
    get: () => apiFetch("/api/metrics/summary"),
  },
};
