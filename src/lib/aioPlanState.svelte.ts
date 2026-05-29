/**
 * Shared, app-level state for the AIO Score "AI action plan".
 *
 * This lives in a module singleton (not inside a tab component) on purpose: the
 * crawl-detail tabs unmount when you switch away (`{#if activeTab === ...}`), so
 * any generation owned by the component would be torn down. Keeping the live
 * Chrome Prompt API session, the streamed messages, and the status here lets the
 * plan keep generating in the background and lets the AIO Score tab pick the
 * conversation back up when you return to it.
 *
 * The on-device session cannot be serialized, so this state is in-memory only —
 * it survives tab switches and client-side navigation, not a full page reload.
 */

export type AioChatMessage = { role: 'user' | 'assistant'; text: string };

/** Context needed to (re)generate a plan, supplied by the AIO Score tab. */
export interface AioPlanContext {
	url: string;
	score: number;
	grade: string;
	/** Pre-formatted, prioritized list of failing checks + suggested fixes. */
	issues: string;
}

/** Resolves Chrome's on-device language model, or null when unavailable. */
export function getLanguageModel(): any {
	if (typeof window === 'undefined') return null;
	const win = window as any;
	return (win.ai && win.ai.languageModel) || win.LanguageModel || null;
}

const SYSTEM_PROMPT = `You are an expert Answer Engine Optimization (AEO / GEO) consultant. You help improve how well a web page is read, understood, and cited by AI engines like ChatGPT, Gemini, and Perplexity. Be concrete and specific. When you produce the action plan, use markdown: a numbered list ordered by impact, where each item names the action, why it helps AI citation, and a quick example or code snippet where useful. No preamble, no restating the score. For follow-up questions, answer directly and stay focused on improving this page's AI discoverability.`;

class AioPlan {
	/** Lifecycle of the current plan. `idle` = nothing generated for `forUrl`. */
	status = $state<'idle' | 'generating' | 'ready' | 'error'>('idle');
	/** The plan + any follow-up chat, as a running conversation. */
	messages = $state<AioChatMessage[]>([]);
	/** True while a response is actively streaming in. */
	isStreaming = $state(false);
	/** Last error message, if status is `error`. */
	error = $state('');
	/** The audited URL this plan belongs to (guards against stale plans). */
	forUrl = $state('');

	#session: any = null;
	#abort: AbortController | null = null;

	/** Generates a fresh action plan, discarding any previous conversation. */
	async start(ctx: AioPlanContext): Promise<void> {
		const lm = getLanguageModel();
		if (!lm) {
			this.status = 'error';
			this.error = 'On-device AI is unavailable in this browser.';
			return;
		}

		this.stop();
		this.messages = [];
		this.error = '';
		this.forUrl = ctx.url;
		this.status = 'generating';

		const userPrompt = `Page: ${ctx.url}
Current AIO Score: ${ctx.score}/100 (grade ${ctx.grade}).
Failing checks, highest impact first:
${ctx.issues}

Write the prioritized action plan now.`;

		try {
			this.#session = await lm.create({ systemPrompt: SYSTEM_PROMPT });
			this.messages = [{ role: 'assistant', text: '' }];
			await this.#run(userPrompt);
			this.status = this.error ? 'error' : 'ready';
		} catch (e: any) {
			console.error('AIO plan: failed to create session', e);
			this.error = `Could not start the on-device model: ${e?.message || e}`;
			this.status = 'error';
		}
	}

	/** Asks a follow-up question on the existing (stateful) session. */
	async ask(question: string): Promise<void> {
		const trimmed = question.trim();
		if (!trimmed || !this.#session || this.isStreaming) return;
		this.messages = [
			...this.messages,
			{ role: 'user', text: trimmed },
			{ role: 'assistant', text: '' }
		];
		await this.#run(trimmed);
		this.status = this.error ? 'error' : 'ready';
	}

	/** Aborts any in-flight stream without discarding the conversation. */
	stop(): void {
		if (this.#abort) {
			this.#abort.abort();
			this.#abort = null;
		}
		this.isStreaming = false;
	}

	/** Clears everything back to idle (also drops the session). */
	clear(): void {
		this.stop();
		this.#session = null;
		this.messages = [];
		this.error = '';
		this.status = 'idle';
		this.forUrl = '';
	}

	/** Streams a prompt into the trailing assistant message placeholder. */
	async #run(prompt: string): Promise<void> {
		this.isStreaming = true;
		this.#abort = new AbortController();
		const signal = this.#abort.signal;
		try {
			const stream = await this.#session.promptStreaming(prompt, { signal });
			let accumulated = '';
			for await (const chunk of stream) {
				// Chrome's stream may emit cumulative snapshots or deltas; handle both.
				if (accumulated.length > 0 && chunk.startsWith(accumulated)) {
					accumulated = chunk;
				} else {
					accumulated += chunk;
				}
				this.messages[this.messages.length - 1].text = accumulated;
				this.messages = [...this.messages];
			}
		} catch (e: any) {
			if (e?.name === 'AbortError') {
				this.messages[this.messages.length - 1].text += '\n\n*Generation stopped.*';
				this.messages = [...this.messages];
			} else {
				console.error('AIO plan: stream failed', e);
				this.error = `Generation failed: ${e?.message || e}`;
			}
		} finally {
			this.isStreaming = false;
			this.#abort = null;
		}
	}
}

export const aioPlan = new AioPlan();
