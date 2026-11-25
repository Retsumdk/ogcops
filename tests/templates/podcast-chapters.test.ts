import { describe, expect, it } from 'vitest';
import { getAllTemplates } from '@/templates/registry';
import podcastChapters from '@/templates/podcast/chapters';

const template = getAllTemplates().find(({ id }) => id === 'podcast-chapters');

if (!template) throw new Error('Template not found: podcast-chapters');

type TestNode = {
  props?: {
    children?: unknown;
    style?: Record<string, unknown>;
  };
};

function texts(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object' && 'props' in node) {
    return texts((node as TestNode).props?.children);
  }
  return [];
}

/** Widths of the timeline segments, in render order, as percentages. */
function segmentWidths(node: unknown, found: number[] = []): number[] {
  if (!node || typeof node !== 'object') return found;
  const candidate = node as TestNode;
  const width = candidate.props?.style?.width;

  if (typeof width === 'string' && /^\d+(\.\d+)?%$/.test(width)) {
    found.push(Number.parseFloat(width));
  }

  const children = candidate.props?.children;
  const nested = Array.isArray(children) ? children : [children];
  for (const child of nested) segmentWidths(child, found);

  return found;
}

const render = (overrides: Record<string, unknown> = {}) =>
  template.render({ ...template.defaults, ...overrides });

describe('podcast-chapters', () => {
  it('is registered in the podcast category', () => {
    expect(template.id).toBe('podcast-chapters');
    expect(template.name).toBe('Chapters');
    expect(template.category).toBe('podcast');
    expect(template.description).toBeTruthy();
    expect(template.tags.length).toBeGreaterThanOrEqual(4);
    expect(template.tags.length).toBeLessThanOrEqual(6);
  });

  it('exposes the fields the issue asks for', () => {
    const keys = template.fields.map((field) => field.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'title',
        'showName',
        'episodeNumber',
        'duration',
        'time1',
        'chapter1',
        'time4',
        'chapter4',
        'siteName',
        'bgColor',
        'accentColor',
        'textColor',
      ]),
    );
  });

  it('renders the show line, title, length and every default chapter', () => {
    const rendered = texts(render());

    expect(rendered).toContain('The Build Log');
    expect(rendered).toContain('Episode 42');
    expect(rendered).toContain('Why our builds got 3x faster');
    expect(rendered).toContain('42:10');
    expect(rendered).toContain('00:00');
    expect(rendered).toContain('Intro');
    expect(rendered).toContain('04:30');
    expect(rendered).toContain('Where the time went');
    expect(rendered).toContain('18:15');
    expect(rendered).toContain('Caching the right things');
    expect(rendered).toContain('31:40');
    expect(rendered).toContain("What we'd do differently");
    expect(rendered).toContain('thebuildlog.fm');
    expect(rendered).toContain('4 CHAPTERS');
  });

  it('sizes each segment by the distance to the next chapter, and the last by the episode length', () => {
    // 00:00-04:30 = 270s, 04:30-18:15 = 825s, 18:15-31:40 = 805s, 31:40-42:10 = 630s
    const widths = segmentWidths(render());

    expect(widths).toHaveLength(4);
    expect(widths[0]).toBeCloseTo((270 / 2530) * 100, 1);
    expect(widths[1]).toBeCloseTo((825 / 2530) * 100, 1);
    expect(widths[2]).toBeCloseTo((805 / 2530) * 100, 1);
    expect(widths[3]).toBeCloseTo((630 / 2530) * 100, 1);
    expect(widths.reduce((total, width) => total + width, 0)).toBeCloseTo(100, 1);
  });

  it('accepts h:mm:ss as well as m:ss', () => {
    const widths = segmentWidths(
      render({
        duration: '2:00:00',
        time1: '0:00:00',
        chapter1: 'First',
        time2: '1:00:00',
        chapter2: 'Second',
        time3: '',
        chapter3: '',
        time4: '',
        chapter4: '',
      }),
    );

    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeCloseTo(50, 1);
    expect(widths[1]).toBeCloseTo(50, 1);
  });

  it('drops chapters that have no title and never renders a negative segment', () => {
    const element = render({
      time3: '',
      chapter3: '',
      time4: '48:00',
      chapter4: 'Past the end',
      duration: '42:10',
    });
    const rendered = texts(element);
    const widths = segmentWidths(element);

    expect(rendered).not.toContain('');
    expect(rendered).not.toContain('Caching the right things');
    expect(rendered).toContain('Past the end');
    expect(widths).toHaveLength(3);
    expect(widths.every((width) => width >= 0)).toBe(true);
    expect(widths[2]).toBe(0);
    expect(JSON.stringify(element)).not.toContain('NaN');
  });

  it('keeps the bar filled when the episode length is missing or unreadable', () => {
    const widths = segmentWidths(render({ duration: '' }));

    expect(widths).toHaveLength(4);
    expect(widths.reduce((total, width) => total + width, 0)).toBeCloseTo(100, 1);
    expect(widths[3]).toBeGreaterThan(0);
    expect(JSON.stringify(render({ duration: 'n/a' }))).not.toContain('NaN');
  });

  it('hides the show line when the show name and episode number are blank', () => {
    const rendered = texts(render({ showName: '  ', episodeNumber: '' }));

    expect(rendered).not.toContain('The Build Log');
    expect(rendered.some((text) => text.startsWith('Episode'))).toBe(false);
  });

  it('darkens the accent on a light background so the chapter times stay readable', () => {
    const widths = segmentWidths(render({ bgColor: '#ffffff', accentColor: '#fde047' }));
    const element = render({ bgColor: '#ffffff', accentColor: '#fde047' });

    expect(widths).toHaveLength(4);
    expect(JSON.stringify(element)).toContain('#8b7b27');
    expect(JSON.stringify(element)).not.toContain('#fde047');
  });

  it('truncates a long chapter title instead of overflowing the card', () => {
    const longTitle = 'A chapter title that keeps going well past the width of the card';
    const rendered = texts(render({ chapter2: longTitle }));

    expect(rendered).toContain(`${longTitle.slice(0, 59)}…`);
    expect(rendered).not.toContain(longTitle);
  });
});
