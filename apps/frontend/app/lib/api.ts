export function getBackendUrl(): string {
	return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api").replace(
		/\/$/,
		"",
	)
}

export function discordLoginUrl(): string {
	return `${getBackendUrl()}/auth/discord/login`
}

export function osuLinkUrl(): string {
	return `${getBackendUrl()}/auth/osu/login`
}

export function lastfmLinkUrl(): string {
	return `${getBackendUrl()}/auth/lastfm/login`
}

type Envelope<T> = {
	data: T
	meta?: { requestId?: string }
}

export class ApiError extends Error {
	status: number
	body: unknown

	constructor(status: number, message: string, body?: unknown) {
		super(message)
		this.name = "ApiError"
		this.status = status
		this.body = body
	}
}

type FetchOptions = {
	method?: string
	body?: unknown
	signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
	const method = options.method ?? "GET"
	const headers: Record<string, string> = {
		Accept: "application/json",
	}

	if (options.body !== undefined) {
		headers["Content-Type"] = "application/json"
	}

	if (method !== "GET" && method !== "HEAD") {
		headers["X-Requested-With"] = "fetch"
	}

	const res = await fetch(`${getBackendUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
		method,
		headers,
		credentials: "include",
		signal: options.signal,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	})

	if (res.status === 204) {
		return undefined as T
	}

	const text = await res.text()
	let json: unknown = null
	if (text) {
		try {
			json = JSON.parse(text)
		} catch {
			json = text
		}
	}

	if (!res.ok) {
		const message =
			typeof json === "object" &&
			json !== null &&
			"error" in json &&
			typeof (json as { error?: { message?: string } }).error?.message === "string"
				? (json as { error: { message: string } }).error.message
				: `Request failed (${res.status})`
		throw new ApiError(res.status, message, json)
	}

	if (json && typeof json === "object" && "data" in json) {
		return (json as Envelope<T>).data
	}

	return json as T
}
