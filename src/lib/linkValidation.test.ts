import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, validateLinks, type LinkItem } from './seoEngine';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Builds a minimal LinkItem in the real shape. */
function makeLink(id: number, href: string): LinkItem {
	return {
		id,
		href,
		text: `link-${id}`,
		isExternal: false,
		isSecure: href.startsWith('https:'),
		status: null,
		statusText: null,
		statusState: 'pending',
		rel: '',
		responseTime: null,
		redirectDestination: null
	};
}

/** Minimal Response-like stub carrying a status + optional X-Status-Code header. */
function fakeResponse(status: number, statusText = 'OK'): Response {
	return {
		status,
		statusText,
		headers: {
			get: () => null
		}
	} as unknown as Response;
}

describe('fetchWithTimeout', () => {
	it('resolves when fetch resolves before the timeout', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(fakeResponse(200)))
		);

		const res = await fetchWithTimeout('https://example.com', {}, 1000);
		expect(res.status).toBe(200);
	});

	it('rejects when fetch never resolves within the timeout', async () => {
		// fetch only settles when its signal aborts; the timeout drives the abort.
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_input: string, init: RequestInit = {}) =>
					new Promise<Response>((_resolve, reject) => {
						const sig = init.signal;
						if (sig) {
							sig.addEventListener('abort', () =>
								reject(new DOMException('Aborted', 'AbortError'))
							);
						}
					})
			)
		);

		await expect(fetchWithTimeout('https://example.com', {}, 10)).rejects.toThrow();
	});

	it('aborts when an external signal aborts before the timeout', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_input: string, init: RequestInit = {}) =>
					new Promise<Response>((_resolve, reject) => {
						init.signal?.addEventListener('abort', () =>
							reject(new DOMException('Aborted', 'AbortError'))
						);
					})
			)
		);

		const controller = new AbortController();
		const p = fetchWithTimeout('https://example.com', { signal: controller.signal }, 5000);
		controller.abort();
		await expect(p).rejects.toThrow();
	});
});

describe('validateLinks', () => {
	it('calls onComplete exactly once and terminalizes every link', async () => {
		const links = [
			makeLink(0, 'https://ok.example.com/'),
			makeLink(1, 'https://notfound.example.com/'),
			makeLink(2, 'https://unreachable.example.com/'),
			makeLink(3, 'https://ok2.example.com/'),
			makeLink(4, 'https://throws.example.com/')
		];

		vi.stubGlobal(
			'fetch',
			vi.fn((input: string) => {
				if (input.includes('notfound')) return Promise.resolve(fakeResponse(404, 'Not Found'));
				if (input.includes('unreachable') || input.includes('throws')) {
					return Promise.reject(new TypeError('Failed to fetch'));
				}
				return Promise.resolve(fakeResponse(200, 'OK'));
			})
		);

		const onComplete = vi.fn();
		const updated: number[] = [];

		await validateLinks(links, '', (link) => updated.push(link.id), onComplete);

		// onComplete fires exactly once, after all workers finish.
		expect(onComplete).toHaveBeenCalledTimes(1);

		// No link is left in a non-terminal state.
		for (const link of links) {
			expect(link.statusState === 'ok' || link.statusState === 'broken').toBe(true);
		}

		// 200 links are ok.
		expect(links[0].statusState).toBe('ok');
		expect(links[0].status).toBe(200);
		expect(links[3].statusState).toBe('ok');

		// 404 link is broken with its real status.
		expect(links[1].statusState).toBe('broken');
		expect(links[1].status).toBe(404);

		// Throwing/unreachable links: status null, statusText 'Unreachable', not 500.
		for (const link of [links[2], links[4]]) {
			expect(link.statusState).toBe('broken');
			expect(link.status).toBeNull();
			expect(link.statusText).toBe('Unreachable');
		}

		// Every link received at least one update callback.
		expect(new Set(updated)).toEqual(new Set([0, 1, 2, 3, 4]));
	});

	it('stops pulling new work once the signal is aborted', async () => {
		const links = Array.from({ length: 20 }, (_, i) => makeLink(i, `https://x${i}.example.com/`));
		const fetchSpy = vi.fn(() => Promise.resolve(fakeResponse(200)));
		vi.stubGlobal('fetch', fetchSpy);

		const controller = new AbortController();
		controller.abort(); // aborted before validation starts

		const onComplete = vi.fn();
		await validateLinks(links, '', () => {}, onComplete, controller.signal);

		// onComplete still fires exactly once even when aborted.
		expect(onComplete).toHaveBeenCalledTimes(1);
		// With the signal already aborted, no work should have been dispatched.
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
