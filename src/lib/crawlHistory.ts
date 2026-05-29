import { STORAGE_KEYS } from './storageKeys';
import type { AuditResults } from './seoEngine';

/**
 * A single persisted crawl entry. `timestamp` mirrors `AuditResults.timestamp`
 * (an ISO date string); `new Date(timestamp)` is used when rendering it.
 */
export interface CrawlHistoryItem {
	url: string;
	timestamp: string;
	score: number;
	grade: string;
	errorCount: number;
	warningCount: number;
	results: AuditResults;
}

export const MAX_HISTORY = 6;

/** Read the persisted crawl history. SSR/prerender-safe. */
export function loadHistory(): CrawlHistoryItem[] {
	if (typeof localStorage === 'undefined') return [];
	const saved = localStorage.getItem(STORAGE_KEYS.history);
	if (saved) {
		try {
			return JSON.parse(saved) as CrawlHistoryItem[];
		} catch (e) {
			console.error('Failed to parse crawl history:', e);
		}
	}
	return [];
}

/** Persist the crawl history. SSR/prerender-safe. */
export function saveHistory(items: CrawlHistoryItem[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(items));
	} catch (e) {
		console.warn('Failed to save crawl to history:', e);
	}
}

/**
 * Insert/replace an item by URL, keeping it newest-first and capping the list
 * at MAX_HISTORY, then persist. Returns the updated list.
 */
export function upsert(item: CrawlHistoryItem): CrawlHistoryItem[] {
	const list = loadHistory().filter((i) => i.url !== item.url);
	const updated = [item, ...list].slice(0, MAX_HISTORY);
	saveHistory(updated);
	return updated;
}

/** Remove an item by URL and persist. Returns the updated list. */
export function deleteHistoryItem(url: string): CrawlHistoryItem[] {
	const updated = loadHistory().filter((i) => i.url !== url);
	saveHistory(updated);
	return updated;
}
