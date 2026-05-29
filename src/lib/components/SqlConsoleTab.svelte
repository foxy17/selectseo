<script lang="ts">
	import { onMount } from 'svelte';
	import type { AuditResults } from '$lib/seoEngine';

	let {
		auditResults,
		sqlQuery = $bindable(),
		sqlResult,
		sqlError,
		runSQLQuery
	}: {
		auditResults: AuditResults;
		sqlQuery: string;
		sqlResult: any;
		sqlError: string;
		runSQLQuery: () => void;
	} = $props();

	// CodeMirror states
	let editorContainer: HTMLDivElement | null = $state(null);
	let editorView: any = null;
	let EditorViewClass: any = null;
	let EditorStateClass: any = null;
	let sqlLang: any = null;
	let keymapExtension: any = null;
	let defaultKeymapArray: any = null;

	// Sidebar toggle state
	let showSchema = $state(true);

	// History panel toggle state
	let showHistory = $state(false);
	let queryHistory = $state<
		Array<{ query: string; timestamp: string; rowsCount: number; error: boolean }>
	>([]);

	// Results table sorting state
	let resultsSortCol = $state<string | null>(null);
	let resultsSortDir = $state<'asc' | 'desc' | 'none'>('none');

	// Load history from localStorage
	onMount(() => {
		const saved = localStorage.getItem('seo_sql_history');
		if (saved) {
			try {
				queryHistory = JSON.parse(saved);
			} catch (e) {
				console.error(e);
			}
		}
	});

	async function loadCodeMirror() {
		const cmView = await import('@codemirror/view');
		const cmState = await import('@codemirror/state');
		const cmLangSql = await import('@codemirror/lang-sql');
		const cmCommands = await import('@codemirror/commands');

		EditorViewClass = cmView.EditorView;
		EditorStateClass = cmState.EditorState;
		sqlLang = cmLangSql.sql;
		keymapExtension = cmView.keymap;
		defaultKeymapArray = cmCommands.defaultKeymap;
	}

	function createEditor() {
		if (!editorContainer || !EditorViewClass || editorView) return;

		// Cyberpunk/neon themed editor
		const theme = EditorViewClass.theme(
			{
				'&': {
					backgroundColor: '#0d0d0f',
					color: '#ffffff',
					border: '1px solid var(--color-hairline)',
					borderRadius: 'var(--rounded-md)',
					fontSize: '14px',
					height: '220px',
					fontFamily: 'var(--font-family-mono)'
				},
				'.cm-content': {
					caretColor: 'var(--color-primary)',
					fontFamily: 'var(--font-family-mono)'
				},
				'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-primary)' },
				'&.cm-focused': {
					outline: 'none',
					borderColor: 'var(--color-primary)'
				},
				'.cm-gutters': {
					backgroundColor: '#08080a',
					color: 'var(--color-muted)',
					borderRight: '1px solid var(--color-hairline)',
					borderRadius: 'var(--rounded-md) 0 0 var(--rounded-md)'
				},
				'.cm-activeLineGutter': {
					backgroundColor: 'rgba(250, 255, 105, 0.1)',
					color: 'var(--color-primary)'
				},
				'.cm-activeLine': {
					backgroundColor: 'rgba(250, 255, 105, 0.04)'
				}
			},
			{ dark: true }
		);

		const startState = EditorStateClass.create({
			doc: sqlQuery,
			extensions: [
				theme,
				sqlLang(),
				keymapExtension.of([
					...defaultKeymapArray,
					{
						key: 'Ctrl-Enter',
						run: () => {
							executeQuery();
							return true;
						}
					}
				]),
				EditorViewClass.updateListener.of((update: any) => {
					if (update.docChanged) {
						sqlQuery = update.state.doc.toString();
					}
				})
			]
		});

		editorView = new EditorViewClass({
			state: startState,
			parent: editorContainer
		});
	}

	// Load editor reactively when container is ready
	$effect(() => {
		if (editorContainer) {
			if (!editorView) {
				if (EditorViewClass) {
					createEditor();
				} else {
					loadCodeMirror().then(() => {
						createEditor();
					});
				}
			}
		}
	});

	// Function to insert text at cursor in CodeMirror
	function insertText(text: string) {
		if (editorView) {
			editorView.dispatch(editorView.state.replaceSelection(text));
			editorView.focus();
		} else {
			sqlQuery = text;
		}
	}

	function setSampleQuery(queryText: string) {
		sqlQuery = queryText;
		if (editorView) {
			editorView.dispatch({
				changes: { from: 0, to: editorView.state.doc.length, insert: queryText }
			});
		}
		executeQuery();
	}

	// Record history log
	function recordHistory(query: string, count: number, isError: boolean) {
		const item = {
			query,
			timestamp: new Date().toLocaleTimeString(),
			rowsCount: count,
			error: isError
		};
		if (queryHistory.length > 0 && queryHistory[0].query === query) return;
		queryHistory = [item, ...queryHistory.slice(0, 19)];
		localStorage.setItem('seo_sql_history', JSON.stringify(queryHistory));
	}

	function executeQuery() {
		runSQLQuery();
		// Wait a tick for query result updates
		setTimeout(() => {
			recordHistory(sqlQuery, sqlResult?.count ?? 0, !!sqlError);
		}, 60);
	}

	function clearHistory() {
		queryHistory = [];
		localStorage.removeItem('seo_sql_history');
	}

	// Sorting results table columns
	function handleSortResults(col: string) {
		if (resultsSortCol === col) {
			if (resultsSortDir === 'asc') resultsSortDir = 'desc';
			else if (resultsSortDir === 'desc') {
				resultsSortDir = 'none';
				resultsSortCol = null;
			} else {
				resultsSortDir = 'asc';
			}
		} else {
			resultsSortCol = col;
			resultsSortDir = 'asc';
		}
	}

	const sortedRows = $derived.by(() => {
		if (!sqlResult || !sqlResult.rows) return [];
		let items = [...sqlResult.rows];

		if (resultsSortCol && resultsSortDir !== 'none') {
			items.sort((a, b) => {
				const valA = a[resultsSortCol!];
				const valB = b[resultsSortCol!];

				if (valA === null || valA === undefined) return 1;
				if (valB === null || valB === undefined) return -1;

				if (typeof valA === 'string') {
					return resultsSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
				} else {
					return resultsSortDir === 'asc' ? valA - valB : valB - valA;
				}
			});
		}

		return items;
	});

	// Export handlers
	function exportCSV() {
		if (!sqlResult || sqlResult.rows.length === 0) return;
		const headers = sqlResult.columns.join(',');
		const rows = sqlResult.rows.map((row: any) =>
			sqlResult.columns
				.map((col: string) => {
					const val = row[col] === null ? 'NULL' : row[col];
					return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
				})
				.join(',')
		);

		const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
		const link = document.createElement('a');
		link.setAttribute('href', encodeURI(csvContent));
		link.setAttribute('download', 'sql-results.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function exportJSON() {
		if (!sqlResult || sqlResult.rows.length === 0) return;
		const jsonStr = JSON.stringify(sqlResult.rows, null, 2);
		const blob = new Blob([jsonStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'sql-results.json';
		link.click();
		URL.revokeObjectURL(url);
	}

	function copyTSV() {
		if (!sqlResult || sqlResult.rows.length === 0) return;
		const headers = sqlResult.columns.join('\t');
		const rows = sqlResult.rows.map((row: any) =>
			sqlResult.columns.map((col: string) => (row[col] === null ? 'NULL' : row[col])).join('\t')
		);
		navigator.clipboard.writeText([headers, ...rows].join('\n'));
		alert('Copied results as Tab-Separated values (TSV) to clipboard!');
	}

	function copyMarkdown() {
		if (!sqlResult || sqlResult.rows.length === 0) return;
		let md = '| ' + sqlResult.columns.join(' | ') + ' |\n';
		md += '| ' + sqlResult.columns.map(() => '---').join(' | ') + ' |\n';
		sqlResult.rows.forEach((row: any) => {
			md +=
				'| ' +
				sqlResult.columns
					.map((col: string) => {
						const val = row[col] === null ? 'NULL' : row[col];
						return String(val).replace(/\|/g, '\\|');
					})
					.join(' | ') +
				' |\n';
		});
		navigator.clipboard.writeText(md);
		alert('Copied results as Markdown table to clipboard!');
	}
</script>

<div class="sql-console-tab font-sans">
	<div class="sql-ide-container">
		<!-- Schema Explorer Sidebar -->
		{#if showSchema}
			<div class="schema-sidebar card-dark font-mono">
				<div class="sidebar-head">
					<span>📋 DATABASE TABLES</span>
				</div>
				<div class="table-tree mt-2">
					<!-- Table: meta -->
					<div class="table-node">
						<button
							class="node-title-btn"
							onclick={() => insertText('SELECT * FROM meta LIMIT 10;')}
						>
							📁 meta <span class="badge badge-pill text-xs">7 rows</span>
						</button>
						<div class="columns-list">
							<button onclick={() => insertText('name')}>name (text)</button>
							<button onclick={() => insertText('content')}>content (text)</button>
							<button onclick={() => insertText('length')}>length (integer)</button>
							<button onclick={() => insertText('status')}>status (text)</button>
							<button onclick={() => insertText('message')}>message (text)</button>
						</div>
					</div>

					<!-- Table: headings -->
					<div class="table-node mt-2">
						<button
							class="node-title-btn"
							onclick={() => insertText('SELECT * FROM headings LIMIT 10;')}
						>
							📁 headings <span class="badge badge-pill text-xs"
								>{auditResults.onPage.headings.h1.length +
									auditResults.onPage.headings.h2.length +
									auditResults.onPage.headings.h3.length} rows</span
							>
						</button>
						<div class="columns-list">
							<button onclick={() => insertText('tag')}>tag (text)</button>
							<button onclick={() => insertText('text')}>text (text)</button>
						</div>
					</div>

					<!-- Table: links -->
					<div class="table-node mt-2">
						<button
							class="node-title-btn"
							onclick={() => insertText('SELECT * FROM links LIMIT 10;')}
						>
							📁 links <span class="badge badge-pill text-xs">{auditResults.links.length} rows</span
							>
						</button>
						<div class="columns-list">
							<button onclick={() => insertText('id')}>id (integer)</button>
							<button onclick={() => insertText('href')}>href (text)</button>
							<button onclick={() => insertText('text')}>text (text)</button>
							<button onclick={() => insertText('type')}>type (text)</button>
							<button onclick={() => insertText('secure')}>secure (integer)</button>
							<button onclick={() => insertText('status')}>status (integer)</button>
							<button onclick={() => insertText('status_state')}>status_state (text)</button>
							<button onclick={() => insertText('rel')}>rel (text)</button>
						</div>
					</div>

					<!-- Table: images -->
					<div class="table-node mt-2">
						<button
							class="node-title-btn"
							onclick={() => insertText('SELECT * FROM images LIMIT 10;')}
						>
							📁 images <span class="badge badge-pill text-xs"
								>{auditResults.onPage.imageAlts.total} rows</span
							>
						</button>
						<div class="columns-list">
							<button onclick={() => insertText('id')}>id (integer)</button>
							<button onclick={() => insertText('src')}>src (text)</button>
							<button onclick={() => insertText('alt')}>alt (text)</button>
							<button onclick={() => insertText('is_missing')}>is_missing (integer)</button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Main SQL workspace area -->
		<div class="workspace-main flex-1">
			<!-- Toolbar -->
			<div class="toolbar-row font-mono mb-2">
				<div class="toolbar-left">
					<span class="row-label">Presets:</span>
					<button
						class="preset-pill"
						onclick={() =>
							setSampleQuery('SELECT href, text, status FROM links WHERE status >= 400;')}
						>Broken Links</button
					>
					<button
						class="preset-pill"
						onclick={() => setSampleQuery('SELECT src, alt FROM images WHERE is_missing = 1;')}
						>Missing Alt</button
					>
					<button
						class="preset-pill"
						onclick={() =>
							setSampleQuery('SELECT tag, COUNT(*) as count FROM headings GROUP BY tag;')}
						>Headings count</button
					>
					<button
						class="preset-pill"
						onclick={() =>
							setSampleQuery('SELECT type, COUNT(*), SUM(secure) FROM links GROUP BY type;')}
						>Secure links</button
					>
				</div>
				<div class="toolbar-right">
					<button class="tool-btn" onclick={() => (showSchema = !showSchema)}
						>{showSchema ? 'Hide Schema' : 'Show Schema'}</button
					>
					<button class="tool-btn" onclick={() => (showHistory = !showHistory)}
						>{showHistory ? 'Hide History' : 'Query History'}</button
					>
				</div>
			</div>

			<!-- CodeMirror container mount -->
			<div class="editor-wrapper">
				<div bind:this={editorContainer} class="cm-mount"></div>
			</div>

			<!-- Execution row -->
			<div class="exec-row mt-2 font-mono">
				<span class="exec-tip text-muted"
					>Press <strong class="text-primary">Ctrl + Enter</strong> to execute</span
				>
				<button class="btn btn-primary run-query-btn" onclick={executeQuery}>Execute Query</button>
			</div>

			<!-- DB exception box -->
			{#if sqlError}
				<div class="sql-error-block mt-2 font-mono">
					<span class="error-prefix text-error">DB_EXCEPTION:</span>
					{sqlError}
				</div>
			{/if}

			<!-- Query history log drawer -->
			{#if showHistory}
				<div class="history-log-panel card-dark mt-2 font-mono">
					<div class="history-head">
						<h4 class="title-sm text-primary">SQL Query History</h4>
						<button class="clear-history-btn" onclick={clearHistory}>Clear Log</button>
					</div>
					<div class="history-list mt-2">
						{#if queryHistory.length === 0}
							<p class="text-muted text-xs">No query history found.</p>
						{:else}
							{#each queryHistory as hist}
								<div class="history-item">
									<button
										class="hist-query-text text-left-align"
										onclick={() => setSampleQuery(hist.query)}>{hist.query}</button
									>
									<div class="hist-meta text-muted">
										<span>{hist.timestamp}</span>
										<span class={hist.error ? 'text-error' : 'text-success'}>
											{hist.error ? 'Failed' : hist.rowsCount + ' rows'}
										</span>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}

			<!-- SQL Results Datatable Output -->
			{#if sqlResult}
				<div class="sql-results-card card-dark mt-4">
					<div class="results-header font-sans">
						<div class="results-header-left">
							<h3 class="title-md">Query Output</h3>
							<span class="results-meta font-mono text-muted">
								({sqlResult.count} rows in set, took {sqlResult.executionTimeMs || 0}ms)
							</span>
						</div>

						{#if sqlResult.count > 0}
							<div class="export-dropdown font-mono">
								<button class="btn btn-secondary btn-sm" onclick={exportCSV}>CSV</button>
								<button class="btn btn-secondary btn-sm" onclick={exportJSON}>JSON</button>
								<button class="btn btn-secondary btn-sm" onclick={copyTSV}>TSV</button>
								<button class="btn btn-secondary btn-sm" onclick={copyMarkdown}>Markdown</button>
							</div>
						{/if}
					</div>

					{#if sqlResult.count === 0}
						<p class="empty-state font-mono mt-2">Empty set (0 rows returned).</p>
					{:else}
						<div class="table-container font-mono mt-2 custom-scroll">
							<table class="data-table sql-data-table">
								<thead>
									<tr>
										{#each sqlResult.columns as col}
											<th class="sortable-results-th" onclick={() => handleSortResults(col)}>
												{col}
												{resultsSortCol === col ? (resultsSortDir === 'asc' ? '▲' : '▼') : ''}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each sortedRows as row}
										<tr>
											{#each sqlResult.columns as col}
												<td class="sql-cell" title={row[col]}
													>{row[col] === null ? 'NULL' : row[col]}</td
												>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.sql-console-tab {
		width: 100%;
	}

	.sql-ide-container {
		display: flex;
		gap: var(--spacing-md);
		align-items: flex-start;
	}

	/* Sidebar */
	.schema-sidebar {
		width: 260px;
		padding: var(--spacing-sm) !important;
		border-right: 1px solid var(--color-hairline);
		max-height: 480px;
		overflow-y: auto;
		flex-shrink: 0;
	}

	.sidebar-head {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-muted);
		letter-spacing: 0.5px;
		border-bottom: 1px solid var(--color-hairline);
		padding-bottom: 4px;
	}

	.node-title-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-body-strong);
		display: inline-flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		text-align: left;
	}

	.node-title-btn:hover {
		color: var(--color-primary);
	}

	.text-xs {
		font-size: 9px;
		padding: 1px 6px;
	}

	.columns-list {
		display: flex;
		flex-direction: column;
		padding-left: var(--spacing-md);
		margin-top: 2px;
	}

	.columns-list button {
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		font-size: 11px;
		color: var(--color-muted);
		padding: 2px 0;
		width: 100%;
	}

	.columns-list button:hover {
		color: var(--color-primary-active);
	}

	.flex-1 {
		flex: 1;
	}

	/* Toolbar */
	.toolbar-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.row-label {
		color: var(--color-muted);
		font-weight: 600;
	}

	.preset-pill {
		background-color: var(--color-surface-soft);
		border: 1px solid var(--color-hairline);
		color: var(--color-body-strong);
		padding: 2px 8px;
		border-radius: var(--rounded-pill);
		cursor: pointer;
		font-size: 11px;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.preset-pill:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.toolbar-right {
		display: flex;
		gap: var(--spacing-xs);
	}

	.tool-btn {
		background: none;
		border: 1px solid var(--color-hairline);
		color: var(--color-muted);
		padding: 2px 8px;
		border-radius: var(--rounded-sm);
		cursor: pointer;
		font-size: 11px;
		transition: color 0.15s ease;
	}

	.tool-btn:hover {
		color: var(--color-primary);
		border-color: var(--color-hairline-strong);
	}

	/* Editor wrapper */
	.editor-wrapper {
		background-color: #0d0d0f;
		border-radius: var(--rounded-md);
		overflow: hidden;
	}

	.cm-mount {
		width: 100%;
	}

	/* Exec row */
	.exec-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.exec-tip {
		font-size: 12px;
	}

	.run-query-btn {
		height: 36px;
		padding: 0 var(--spacing-md);
	}

	.sql-error-block {
		background-color: rgba(239, 68, 68, 0.05);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: var(--rounded-md);
		padding: var(--spacing-sm);
		font-size: 13px;
		color: #e6e6e6;
	}

	.error-prefix {
		font-weight: 700;
	}

	/* History Log */
	.history-log-panel {
		padding: var(--spacing-sm) !important;
	}

	.history-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--color-hairline);
		padding-bottom: 4px;
	}

	.clear-history-btn {
		background: none;
		border: none;
		color: var(--color-error);
		cursor: pointer;
		font-size: 11px;
		font-weight: 600;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 180px;
		overflow-y: auto;
	}

	.history-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		border-bottom: 1px dashed var(--color-hairline);
		padding-bottom: 4px;
	}

	.hist-query-text {
		background: none;
		border: none;
		color: var(--color-body);
		font-family: var(--font-family-mono);
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 70%;
	}

	.hist-query-text:hover {
		color: var(--color-primary);
	}

	.hist-meta {
		display: flex;
		gap: var(--spacing-xs);
		font-size: 11px;
	}

	.text-left-align {
		text-align: left;
	}

	/* Output panel */
	.sql-results-card {
		padding: var(--spacing-md) !important;
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.results-header-left {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.results-meta {
		font-size: 12px;
	}

	.export-dropdown {
		display: flex;
		gap: var(--spacing-xxs);
	}

	.btn-sm {
		height: 26px;
		padding: 0 var(--spacing-xs);
		font-size: 11px;
	}

	.empty-state {
		font-size: 13px;
		color: var(--color-muted);
	}

	/* Table sorting results */
	.sortable-results-th {
		cursor: pointer;
		user-select: none;
	}

	.sortable-results-th:hover {
		color: var(--color-primary);
		background-color: rgba(255, 255, 255, 0.02);
	}

	.sql-cell {
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.custom-scroll {
		overflow: auto;
		max-height: 350px;
	}

	@media (max-width: 768px) {
		.sql-ide-container {
			flex-direction: column;
		}
		.schema-sidebar {
			width: 100%;
			max-height: 200px;
		}
	}
</style>
