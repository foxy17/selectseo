import type { AuditResults } from './seoEngine';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';

/**
 * A scalar cell in a query result. sql.js's own `SqlValue` also permits
 * `Uint8Array` (BLOBs), but every column in our materialized schema is
 * TEXT/INTEGER/NULL, so the rendered/exported result is always one of these.
 */
export type CellValue = string | number | null;

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, CellValue>[];
  count: number;
  error?: string;
  executionTimeMs?: number;
}

let SQL: SqlJsStatic | null = null;
let activeDb: Database | null = null;
/**
 * Content-aware cache key for the currently materialized database (see
 * `cacheKeyFor`). `null` means no database has been built yet.
 */
let activeCacheKey: string | null = null;

/**
 * Initializes the sql.js engine by loading the WASM binary.
 * Should be called once during app startup (e.g. in onMount).
 */
export async function initSqlEngine(): Promise<void> {
  if (SQL) return;
  
  // Initialize sql.js, fetching the WASM file from the root where it's served as a static asset.
  SQL = await initSqlJs({
    locateFile: (file) => `/${file}`
  });
}

/**
 * Builds a cheap, content-aware cache key for an audit so we only rebuild the
 * in-memory database when the data it would contain has actually changed.
 *
 * Reference equality is insufficient: `validateLinks()` mutates link statuses
 * IN PLACE on the same array, and loading a deep-cloned history item produces a
 * NEW object for identical data. The key therefore combines:
 *   - url + timestamp  -> distinguishes different audits (incl. re-clones)
 *   - links.length     -> total links materialized into the `links` table
 *   - validatedCount   -> number of links whose status has resolved, so the db
 *                         is rebuilt after async link validation completes (the
 *                         `status_state` column would otherwise be stale)
 */
export function cacheKeyFor(results: AuditResults): string {
  const validatedCount = results.links.filter(l => l.statusState !== 'pending').length;
  return `${results.url}|${results.timestamp}|${results.links.length}|${validatedCount}`;
}

/**
 * Sets up and populates the in-memory SQLite database from AuditResults.
 */
function prepareDatabase(results: AuditResults): Database {
  if (!SQL) {
    throw new Error('SQLite engine is not initialized. Please wait a moment and try again.');
  }

  // Reuse the existing database when its content-aware key is unchanged.
  const cacheKey = cacheKeyFor(results);
  if (activeDb && activeCacheKey === cacheKey) {
    return activeDb;
  }

  // Close old database if exists to free memory
  if (activeDb) {
    try {
      activeDb.close();
    } catch (e) {
      console.error('Error closing database:', e);
    }
  }

  const db = new SQL.Database();

  // 1. Create and populate `meta` table
  db.run(`
    CREATE TABLE meta (
      name TEXT,
      content TEXT,
      length INTEGER,
      status TEXT,
      message TEXT
    );
  `);

  const metaStmt = db.prepare(`INSERT INTO meta (name, content, length, status, message) VALUES (?, ?, ?, ?, ?)`);
  
  const metaRows = [
    {
      name: 'title',
      content: results.onPage.title.text || '',
      length: results.onPage.title.length || 0,
      status: results.onPage.title.status || 'missing',
      message: results.onPage.title.message || ''
    },
    {
      name: 'description',
      content: results.onPage.description.text || '',
      length: results.onPage.description.length || 0,
      status: results.onPage.description.status || 'missing',
      message: results.onPage.description.message || ''
    },
    {
      name: 'canonical',
      content: results.onPage.canonical.url || '',
      length: (results.onPage.canonical.url || '').length,
      status: results.onPage.canonical.status || 'missing',
      message: results.onPage.canonical.message || ''
    },
    {
      name: 'robots',
      content: results.onPage.robots || '',
      length: (results.onPage.robots || '').length,
      status: 'ok',
      message: 'Robots meta instructions.'
    },
    {
      name: 'og:title',
      content: results.onPage.openGraph.title || '',
      length: (results.onPage.openGraph.title || '').length,
      status: results.onPage.openGraph.status || 'missing',
      message: results.onPage.openGraph.message || ''
    },
    {
      name: 'og:description',
      content: results.onPage.openGraph.description || '',
      length: (results.onPage.openGraph.description || '').length,
      status: results.onPage.openGraph.status || 'missing',
      message: results.onPage.openGraph.message || ''
    },
    {
      name: 'og:image',
      content: results.onPage.openGraph.image || '',
      length: (results.onPage.openGraph.image || '').length,
      status: results.onPage.openGraph.status || 'missing',
      message: results.onPage.openGraph.message || ''
    }
  ];

  metaRows.forEach(row => {
    metaStmt.run([row.name, row.content, row.length, row.status, row.message]);
  });
  metaStmt.free();

  // 2. Create and populate `headings` table
  db.run(`
    CREATE TABLE headings (
      tag TEXT,
      text TEXT
    );
  `);
  
  const headingStmt = db.prepare(`INSERT INTO headings (tag, text) VALUES (?, ?)`);
  const addHeadings = (tag: string, list: string[]) => {
    if (!list) return;
    list.forEach(text => {
      headingStmt.run([tag, text || '']);
    });
  };
  addHeadings('h1', results.onPage.headings.h1);
  addHeadings('h2', results.onPage.headings.h2);
  addHeadings('h3', results.onPage.headings.h3);
  addHeadings('h4', results.onPage.headings.h4);
  addHeadings('h5', results.onPage.headings.h5);
  addHeadings('h6', results.onPage.headings.h6);
  headingStmt.free();

  // 3. Create and populate `links` table
  db.run(`
    CREATE TABLE links (
      id INTEGER PRIMARY KEY,
      href TEXT,
      text TEXT,
      type TEXT,
      secure INTEGER,
      status INTEGER,
      status_state TEXT,
      rel TEXT
    );
  `);

  const linksStmt = db.prepare(`INSERT INTO links (id, href, text, type, secure, status, status_state, rel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  if (results.links && Array.isArray(results.links)) {
    results.links.forEach(l => {
      linksStmt.run([
        l.id,
        l.href || '',
        l.text || '',
        l.isExternal ? 'external' : 'internal',
        l.isSecure ? 1 : 0,
        l.status || null,
        l.statusState || null,
        l.rel || ''
      ]);
    });
  }
  linksStmt.free();

  // 4. Create and populate `images` table
  db.run(`
    CREATE TABLE images (
      id INTEGER PRIMARY KEY,
      src TEXT,
      alt TEXT,
      is_missing INTEGER
    );
  `);

  const imagesStmt = db.prepare(`INSERT INTO images (id, src, alt, is_missing) VALUES (?, ?, ?, ?)`);
  if (results.onPage.imageAlts && results.onPage.imageAlts.details) {
    results.onPage.imageAlts.details.forEach((img, index) => {
      imagesStmt.run([
        index,
        img.src || '',
        img.alt || '',
        img.isMissing ? 1 : 0
      ]);
    });
  }
  imagesStmt.free();

  activeDb = db;
  activeCacheKey = cacheKey;
  return db;
}

/**
 * Executes a raw SQL query on the SQLite database representing the current audit results.
 */
export function executeSQLQuery(query: string, results: AuditResults): SQLQueryResult {
  const startTime = performance.now();
  
  if (!SQL) {
    return {
      columns: [],
      rows: [],
      count: 0,
      error: 'SQLite Engine is not initialized. Please wait a moment and run again.',
      executionTimeMs: 0
    };
  }

  try {
    const db = prepareDatabase(results);
    
    // Execute query via sql.js
    const res = db.exec(query);
    const endTime = performance.now();
    const executionTimeMs = parseFloat((endTime - startTime).toFixed(2));

    if (res.length === 0) {
      return {
        columns: [],
        rows: [],
        count: 0,
        executionTimeMs
      };
    }

    // sql.js format: [{ columns: ['col1', 'col2'], values: [['val1', 'val2'], ...] }]
    const columns = res[0].columns;
    const values = res[0].values;

    const rows = values.map((rowArr: SqlValue[]) => {
      const rowObj: Record<string, CellValue> = {};
      columns.forEach((colName: string, idx: number) => {
        const cell = rowArr[idx];
        // Our schema never stores BLOBs; coerce defensively to keep CellValue honest.
        rowObj[colName] = cell instanceof Uint8Array ? `[${cell.length} bytes]` : cell;
      });
      return rowObj;
    });

    return {
      columns,
      rows,
      count: rows.length,
      executionTimeMs
    };
  } catch (err: unknown) {
    const endTime = performance.now();
    return {
      columns: [],
      rows: [],
      count: 0,
      error: err instanceof Error ? err.message : 'Unknown database error',
      executionTimeMs: parseFloat((endTime - startTime).toFixed(2))
    };
  }
}
