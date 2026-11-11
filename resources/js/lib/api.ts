/**
 * JSON calls to the admin endpoints (same session cookie as the pages).
 * Laravel checks CSRF through the XSRF-TOKEN cookie it sets on every page.
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

function xsrf(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

export async function api<T>(
    method: 'GET' | 'POST',
    url: string,
    body?: unknown,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(url, {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': xsrf(),
            },
            ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
        });
    } catch {
        throw new ApiError('network', 0);
    }

    const data = (await response.json().catch(() => ({}))) as {
        message?: string;
    };

    if (!response.ok) {
        throw new ApiError(data.message ?? 'server', response.status);
    }

    return data as T;
}
