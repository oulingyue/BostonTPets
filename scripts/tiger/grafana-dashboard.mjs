// Builds tiger/grafana-dashboard.json from the queries in tiger/dashboard.sql.
// Import it in Grafana: Dashboards > New > Import, then pick your Tiger PostgreSQL data source.
// Run with `npm run tiger:dashboard` after editing dashboard.sql.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SQL = path.join(ROOT, 'tiger', 'dashboard.sql');
const OUT = path.join(ROOT, 'tiger', 'grafana-dashboard.json');

// "-- name: <title> (<kind>)" headers split the file into one query per panel.
const queries = new Map();
for (const part of readFileSync(SQL, 'utf8').split(/^-- name: /m).slice(1)) {
  const header = part.slice(0, part.indexOf('\n'));
  const title = header.replace(/\s*\([^)]*\)\s*$/, '').trim();
  queries.set(title, part.slice(header.length).trim().replace(/;\s*$/, ''));
}
const sql = (title) => {
  const q = queries.get(title);
  if (!q) throw new Error(`No query named "${title}" in dashboard.sql`);
  return q;
};

const ds = { type: 'grafana-postgresql-datasource', uid: '${DS_TIGER}' };
const target = (title, format) => ({
  refId: 'A',
  datasource: ds,
  editorMode: 'code',
  rawQuery: true,
  format,
  rawSql: sql(title),
});

let nextId = 1;
const panel = (title, type, gridPos, format, extra = {}) => ({
  id: nextId++,
  title,
  type,
  datasource: ds,
  gridPos,
  targets: [target(title, format)],
  ...extra,
});

const panels = [
  {
    id: nextId++,
    type: 'text',
    title: '',
    gridPos: { h: 3, w: 24, x: 0, y: 0 },
    options: {
      mode: 'markdown',
      content:
        '**BostonTPets on Tiger Data.** Every pet pull scanned at a T station, copied from Supabase every minute. ' +
        'Use the **source** filter: `live` is real players; `simulated` is a generated week of commute-shaped traffic ' +
        'that fills the charts. Demo booth accounts are left out of the drop-rate check.',
    },
  },
  panel('Scans per hour by line', 'timeseries', { h: 9, w: 16, x: 0, y: 3 }, 'time_series', {
    fieldConfig: {
      defaults: { custom: { drawStyle: 'line', lineWidth: 2, fillOpacity: 10, stacking: { mode: 'normal' } } },
      overrides: [
        ['red', '#DA291C'],
        ['orange', '#ED8B00'],
        ['green', '#00843D'],
        ['blue', '#003DA5'],
        ['silver', '#7C878E'],
      ].map(([name, color]) => ({
        matcher: { id: 'byName', options: name },
        properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: color } }],
      })),
    },
  }),
  panel('Columnstore savings', 'stat', { h: 9, w: 8, x: 16, y: 3 }, 'table', {
    options: {
      reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '' },
      colorMode: 'none',
      graphMode: 'none',
      textMode: 'value_and_name',
    },
    fieldConfig: {
      defaults: { unit: 'bytes' },
      overrides: [
        {
          matcher: { id: 'byName', options: 'Smaller by' },
          properties: [
            { id: 'unit', value: 'suffix:×' },
            { id: 'decimals', value: 1 },
          ],
        },
      ],
    },
  }),
  panel('Busiest stations', 'barchart', { h: 9, w: 12, x: 0, y: 12 }, 'table', {
    options: { orientation: 'horizontal', xField: 'station_name', showValue: 'auto', legend: { showLegend: false } },
  }),
  panel(
    'Rush-hour profile, average scans per hour of day in Boston',
    'barchart',
    { h: 9, w: 12, x: 12, y: 12 },
    'table',
    { options: { xField: 'hour', showValue: 'never', legend: { showLegend: true, placement: 'bottom' } } },
  ),
  panel('Drop-rate check', 'table', { h: 12, w: 12, x: 0, y: 21 }, 'table', {
    description:
      'Observed share of each rarity per line vs the catalog odds. z_score = (observed - expected) / standard error. ' +
      '|z| under 3 is ordinary randomness; with 20 cells, one near ±3 now and then is expected by chance. ' +
      'Blank until a line has enough pulls.',
    fieldConfig: {
      defaults: {},
      overrides: [
        {
          matcher: { id: 'byName', options: 'z_score' },
          properties: [
            { id: 'custom.cellOptions', value: { type: 'color-background', mode: 'basic' } },
            {
              id: 'thresholds',
              value: {
                mode: 'absolute',
                steps: [
                  { color: 'red', value: null },
                  { color: 'green', value: -3 },
                  { color: 'red', value: 3 },
                ],
              },
            },
          ],
        },
        ...['observed_share', 'expected_share'].map((name) => ({
          matcher: { id: 'byName', options: name },
          properties: [
            { id: 'unit', value: 'percentunit' },
            { id: 'decimals', value: 1 },
          ],
        })),
      ],
    },
  }),
  panel('Live scan feed, newest real scans', 'table', { h: 12, w: 12, x: 12, y: 21 }, 'table'),
  panel('Riders per day', 'timeseries', { h: 8, w: 24, x: 0, y: 33 }, 'time_series', {
    fieldConfig: { defaults: { custom: { drawStyle: 'bars', fillOpacity: 60 } } },
  }),
];

const dashboard = {
  __inputs: [
    {
      name: 'DS_TIGER',
      label: 'Tiger',
      description: 'PostgreSQL data source for your Tiger service',
      type: 'datasource',
      pluginId: 'grafana-postgresql-datasource',
      pluginName: 'PostgreSQL',
    },
  ],
  title: 'BostonTPets on Tiger Data',
  uid: 'bostontpets-tiger',
  timezone: 'America/New_York',
  refresh: '10s',
  time: { from: 'now-7d', to: 'now' },
  schemaVersion: 39,
  tags: ['bostontpets', 'tiger'],
  templating: {
    list: [
      {
        name: 'source',
        label: 'source',
        type: 'custom',
        query: 'live,simulated',
        multi: true,
        includeAll: false,
        current: { selected: true, text: ['live', 'simulated'], value: ['live', 'simulated'] },
        options: [
          { selected: true, text: 'live', value: 'live' },
          { selected: true, text: 'simulated', value: 'simulated' },
        ],
      },
    ],
  },
  panels,
};

writeFileSync(OUT, `${JSON.stringify(dashboard, null, 2)}\n`);
console.log(`Wrote ${panels.length} panels to ${path.relative(ROOT, OUT)}`);
