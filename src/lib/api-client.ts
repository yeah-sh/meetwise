// Helpers for calling the app's own API routes from client components. Browser-safe: no secrets
// and no server-only imports.
import type { ApiError } from "@/types";

// Parses an API response; for an error status, throws with the server's message.
// A response without a JSON body (e.g. 204 No Content) resolves to null.
export async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as Partial<ApiError> | null)?.error;
    throw new Error(message ?? `The server answered with HTTP ${response.status}.`);
  }
  return body as T;
}

// fetch() rejects with a TypeError when the server cannot be reached at all.
export function errorText(error: unknown): string {
  if (error instanceof TypeError) return "Cannot reach the app's server. Check that it is running.";
  return error instanceof Error ? error.message : String(error);
}
