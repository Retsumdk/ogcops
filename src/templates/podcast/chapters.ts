import type { TemplateDefinition } from '../types';
import { commonFields, isLightColor, mixColors, truncate } from '../utils';

const CHAPTER_NUMBERS = [1, 2, 3, 4];

/** Parses `m:ss`, `mm:ss` and `h:mm:ss` into seconds; anything else is null. */
function parseTimestamp(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const parts = raw.split(':').map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((part) => /^\d{1,3}$/.test(part))) return null;

  const numbers = parts.map(Number);
  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  if (seconds > 59) return null;
  if (numbers.length === 3 && minutes > 59) return null;

  return numbers.reduce((total, part) => total * 60 + part, 0);
}

const template: TemplateDefinition = {
  id: 'podcast-chapters',
  name: 'Chapters',
  category: 'podcast',
  description: 'Podcast episode card with a timeline bar split into chapters and the chapter list with start times',
  tags: ['podcast', 'chapters', 'timeline', 'episode', 'show'],
  fields: [
    commonFields.title,
    { key: 'showName', label: 'Show Name', type: 'text' as const, defaultValue: 'The Build Log', placeholder: 'Podcast name', group: 'Content' as const },
    { key: 'episodeNumber', label: 'Episode #', type: 'text' as const, defaultValue: '42', placeholder: '42', group: 'Content' as const },
    { key: 'duration', label: 'Episode Length', type: 'text' as const, defaultValue: '42:10', placeholder: '42:10', group: 'Content' as const },
    ...CHAPTER_NUMBERS.flatMap((number) => [
      { key: `time${number}`, label: `Chapter ${number} Start`, type: 'text' as const, defaultValue: ['00:00', '04:30', '18:15', '31:40'][number - 1], placeholder: '04:30', group: 'Content' as const },
      { key: `chapter${number}`, label: `Chapter ${number} Title`, type: 'text' as const, defaultValue: ['Intro', 'Where the time went', 'Caching the right things', "What we'd do differently"][number - 1], placeholder: 'Chapter title', group: 'Content' as const },
    ]),
    commonFields.siteName,
    commonFields.bgColor,
    commonFields.accentColor,
    commonFields.textColor,
  ],
  defaults: {
    title: 'Why our builds got 3x faster',
    showName: 'The Build Log',
    episodeNumber: '42',
    duration: '42:10',
    time1: '00:00',
    chapter1: 'Intro',
    time2: '04:30',
    chapter2: 'Where the time went',
    time3: '18:15',
    chapter3: 'Caching the right things',
    time4: '31:40',
    chapter4: "What we'd do differently",
    siteName: 'thebuildlog.fm',
    bgColor: '#0d1117',
    accentColor: '#E07A5F',
    textColor: '#FFFFFF',
  },
  render: (params) => {
    const showName = truncate(String(params.showName ?? '').trim(), 40);
    const episodeNumber = truncate(String(params.episodeNumber ?? '').trim(), 8);
    const title = truncate(String(params.title ?? '').trim() || 'Episode Title', 72);
    const siteName = truncate(String(params.siteName ?? '').trim(), 48);
    const durationLabel = truncate(String(params.duration ?? '').trim(), 10);
    const bgColor = String(params.bgColor || '#0d1117');
    const accentColor = String(params.accentColor || '#E07A5F');
    const textColor = String(params.textColor || '#FFFFFF');
    const lightBackground = isLightColor(bgColor);
    const accentInk = lightBackground ? mixColors(accentColor, '#000000', 0.45) : accentColor;
    const mutedColor = mixColors(bgColor, textColor, lightBackground ? 0.68 : 0.62);

    const chapters = CHAPTER_NUMBERS.map((number) => ({
      start: parseTimestamp(params[`time${number}`]),
      time: truncate(String(params[`time${number}`] ?? '').trim(), 10),
      title: truncate(String(params[`chapter${number}`] ?? '').trim(), 60),
    })).filter((chapter) => chapter.start !== null && chapter.title);

    const starts = chapters.map((chapter) => chapter.start as number);
    const statedDuration = parseTimestamp(params.duration);
    // Without a usable length, assume the last chapter runs as long as the others.
    const averageSegment =
      starts.length > 1 ? Math.round((starts[starts.length - 1] - starts[0]) / (starts.length - 1)) : 60;
    const durationSeconds =
      statedDuration !== null && statedDuration > (starts[0] ?? 0)
        ? statedDuration
        : (starts[starts.length - 1] ?? 0) + averageSegment;

    const segments = chapters.map((chapter, index) => {
      const start = chapter.start as number;
      const end = index + 1 < chapters.length ? (chapters[index + 1].start as number) : durationSeconds;
      return { chapter, length: Math.max(0, end - start) };
    });
    const barSeconds = Math.max(
      1,
      segments.reduce((total, segment) => total + segment.length, 0),
    );

    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '1200px',
          height: '630px',
          padding: '64px 72px',
          backgroundColor: bgColor,
          fontFamily: 'Inter, sans-serif',
        },
        children: [
          ...(showName || episodeNumber
            ? [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' },
                    children: [
                      ...(showName
                        ? [
                            { type: 'div', props: { style: { display: 'flex', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: accentInk } } },
                            { type: 'span', props: { style: { display: 'flex', fontSize: '20px', fontWeight: 700, color: mutedColor, letterSpacing: '0.04em' }, children: showName } },
                          ]
                        : []),
                      ...(showName && episodeNumber
                        ? [{ type: 'span', props: { style: { display: 'flex', fontSize: '20px', color: mutedColor }, children: '·' } }]
                        : []),
                      ...(episodeNumber
                        ? [{ type: 'span', props: { style: { display: 'flex', fontSize: '20px', fontWeight: 700, color: mutedColor, letterSpacing: '0.04em' }, children: `Episode ${episodeNumber}` } }]
                        : []),
                    ],
                  },
                },
              ]
            : []),
          {
            type: 'h1',
            props: {
              style: { display: 'flex', margin: '0 0 40px', fontSize: '46px', lineHeight: 1.15, fontWeight: 700, color: textColor },
              children: title,
            },
          },
          ...(segments.length
            ? [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px' },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flex: 1,
                            height: '14px',
                            borderRadius: '7px',
                            overflow: 'hidden',
                            gap: '4px',
                            backgroundColor: `${textColor}12`,
                          },
                          children: segments.map((segment, index) => ({
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                width: `${(segment.length / barSeconds) * 100}%`,
                                height: '100%',
                                backgroundColor: index % 2 === 0 ? accentInk : mixColors(accentInk, bgColor, 0.28),
                                borderRadius: '7px',
                              },
                            },
                          })),
                        },
                      },
                      ...(durationLabel
                        ? [
                            {
                              type: 'span',
                              props: {
                                style: { display: 'flex', flexShrink: 0, whiteSpace: 'nowrap', fontSize: '18px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: mutedColor },
                                children: durationLabel,
                              },
                            },
                          ]
                        : []),
                    ],
                  },
                },
              ]
            : []),
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 },
              children: segments.map((segment) => ({
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'baseline', gap: '22px' },
                  children: [
                    { type: 'span', props: { style: { display: 'flex', width: '104px', flexShrink: 0, fontSize: '20px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: accentInk }, children: segment.chapter.time } },
                    { type: 'span', props: { style: { display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '24px', fontWeight: 500, color: textColor }, children: segment.chapter.title } },
                  ],
                },
              })),
            },
          },
          ...(siteName
            ? [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '24px' },
                    children: [
                      { type: 'span', props: { style: { display: 'flex', fontSize: '16px', fontWeight: 600, color: mutedColor }, children: siteName } },
                      ...(segments.length
                        ? [
                            { type: 'span', props: { style: { display: 'flex', fontSize: '16px', color: mutedColor }, children: '·' } },
                            { type: 'span', props: { style: { display: 'flex', fontSize: '16px', color: mutedColor }, children: `${segments.length} ${segments.length === 1 ? 'CHAPTER' : 'CHAPTERS'}` } },
                          ]
                        : []),
                    ],
                  },
                },
              ]
            : []),
        ],
      },
    };
  },
};

export default template;
