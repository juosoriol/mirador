import { describe, expect, it } from 'vitest';
import {
  CHART_COLORS,
  countChartValues,
  getChartEligibleColumns,
  prepareChartSeries,
  sliceChartTopN,
  sortChartEntries,
} from '../../src/engine/chart-engine.js';

const data = [
  { Estado: 'Activo', Depto: 'A' },
  { Estado: 'Activo', Depto: 'B' },
  { Estado: 'Inactivo', Depto: 'A' },
  { Estado: 'Activo', Depto: 'A' },
];

describe('getChartEligibleColumns', () => {
  it('includes columns within unique count range', () => {
    const colUniques = {
      Estado: new Set(['Activo', 'Inactivo']),
      Depto: new Set(['A', 'B']),
      ID: new Set(Array.from({ length: 201 }, (_, i) => i)),
    };
    expect(getChartEligibleColumns(['Estado', 'Depto', 'ID'], colUniques)).toEqual([
      'Estado',
      'Depto',
    ]);
  });
});

describe('countChartValues', () => {
  it('counts non-empty labels from filtered indices', () => {
    expect(countChartValues(data, [0, 1, 2, 3], 'Estado')).toEqual({
      Activo: 3,
      Inactivo: 1,
    });
  });
});

describe('sortChartEntries', () => {
  const entries = [
    ['B', 2],
    ['A', 5],
    ['C', 1],
  ];

  it('sorts descending by count', () => {
    expect(sortChartEntries(entries, 'desc')).toEqual([
      ['A', 5],
      ['B', 2],
      ['C', 1],
    ]);
  });

  it('sorts alphabetically', () => {
    expect(sortChartEntries(entries, 'alpha').map(([k]) => k)).toEqual(['A', 'B', 'C']);
  });
});

describe('sliceChartTopN', () => {
  it('limits entries when topN is set', () => {
    const entries = [
      ['A', 5],
      ['B', 2],
      ['C', 1],
    ];
    expect(sliceChartTopN(entries, 2)).toHaveLength(2);
    expect(sliceChartTopN(entries, 0)).toHaveLength(3);
  });
});

describe('prepareChartSeries', () => {
  it('builds chart series with colors from palette', () => {
    const series = prepareChartSeries({
      rawData: data,
      filtered: [0, 1, 2, 3],
      col: 'Estado',
      order: 'desc',
      topN: 0,
    });
    expect(series.labels).toEqual(['Activo', 'Inactivo']);
    expect(series.values).toEqual([3, 1]);
    expect(series.colors[0]).toBe(CHART_COLORS[0]);
    expect(series.uniqueCount).toBe(2);
    expect(series.filteredCount).toBe(4);
  });

  it('truncates to top N values', () => {
    const big = Array.from({ length: 10 }, (_, i) => ({ Cat: `V${i}` }));
    const filtered = big.map((_, i) => i);
    const series = prepareChartSeries({
      rawData: big,
      filtered,
      col: 'Cat',
      order: 'alpha',
      topN: 3,
    });
    expect(series.labels).toHaveLength(3);
    expect(series.truncated).toBe(true);
  });
});
