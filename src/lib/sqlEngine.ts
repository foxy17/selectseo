import type { AuditResults } from './seoEngine';
import initSqlJs from 'sql.js';

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  count: number;
  error?: string;
  executionTimeMs?: number;
}

let SQL: any = null;
let activeDb: any = null;
let activeResults: AuditResults | null = null;

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
 * Sets up and populates the in-memory SQLite database from AuditResults.
 */
function prepareDatabase(results: AuditResults) {
  if (!SQL) {
    throw new Error('SQLite engine is not initialized. Please wait a moment and try again.');
  }

  // If database already exists and results are the same, don't recreate it
  if (activeDb && activeResults === results) {
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
  activeResults = results;
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

    const rows = values.map((rowArr: any[]) => {
      const rowObj: Record<string, any> = {};
      columns.forEach((colName: string, idx: number) => {
        rowObj[colName] = rowArr[idx];
      });
      return rowObj;
    });

    return {
      columns,
      rows,
      count: rows.length,
      executionTimeMs
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      columns: [],
      rows: [],
      count: 0,
      error: err.message || 'Unknown database error',
      executionTimeMs: parseFloat((endTime - startTime).toFixed(2))
    };
  }
}
