import lesson1Source from '../../sales-mindset-1.html?raw';
import lesson2Source from '../../sales-mindset-2.html?raw';
import lesson3Source from '../../sales-mindset-3.html?raw';
import lesson4Source from '../../sales-mindset-4.html?raw';
import lesson5Source from '../../sales-mindset-5.html?raw';
import lesson6Source from '../../sales-mindset-6.html?raw';
import lesson7Source from '../../sales-mindset-7.html?raw';
import lesson8Source from '../../sales-mindset-8.html?raw';

export interface Lesson {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  duration: string;
  xp: number;
  answers: readonly number[];
  source: string;
}

export interface ParsedLesson {
  content: string;
}

export const lessons: readonly Lesson[] = [
  {
    id: 'm0l0',
    number: 1,
    title: "Sort, Don't Convert — Your Operating System",
    shortTitle: "Sort, Don't Convert",
    duration: '~10 min',
    xp: 50,
    answers: [1, 1, 2, 1],
    source: lesson1Source,
  },
  {
    id: 'm0l1',
    number: 2,
    title: 'Rejection is Information',
    shortTitle: 'Rejection is Information',
    duration: '~8 min',
    xp: 50,
    answers: [1, 2, 1, 1],
    source: lesson2Source,
  },
  {
    id: 'm0l2',
    number: 3,
    title: 'Confidence Comes From Repetition',
    shortTitle: 'Confidence Through Repetition',
    duration: '~8 min',
    xp: 50,
    answers: [2, 2, 1, 2],
    source: lesson3Source,
  },
  {
    id: 'm0l3',
    number: 4,
    title: 'Curiosity Beats Persuasion',
    shortTitle: 'Curiosity Beats Persuasion',
    duration: '~8 min',
    xp: 50,
    answers: [1, 2, 1, 1],
    source: lesson4Source,
  },
  {
    id: 'm0l4',
    number: 5,
    title: 'Activity Creates Opportunity',
    shortTitle: 'Activity Creates Opportunity',
    duration: '~7 min',
    xp: 50,
    answers: [1, 2, 1, 0],
    source: lesson5Source,
  },
  {
    id: 'm0l5',
    number: 6,
    title: 'Consistency Beats Motivation',
    shortTitle: 'Consistency Beats Motivation',
    duration: '~7 min',
    xp: 50,
    answers: [1, 2, 1, 1],
    source: lesson6Source,
  },
  {
    id: 'm0l6',
    number: 7,
    title: 'Think Like a Consultant',
    shortTitle: 'Think Like a Consultant',
    duration: '~8 min',
    xp: 50,
    answers: [1, 2, 1, 1],
    source: lesson7Source,
  },
  {
    id: 'm0l7',
    number: 8,
    title: 'Becoming Interview Ready',
    shortTitle: 'Becoming Interview Ready',
    duration: '~10 min',
    xp: 50,
    answers: [2, 1, 1, 1],
    source: lesson8Source,
  },
] as const;

export const parseLesson = (source: string): ParsedLesson => {
  const document = new DOMParser().parseFromString(source, 'text/html');
  const main = document.querySelector<HTMLElement>('.main');

  if (!main) {
    throw new Error('Lesson source is missing its .main content container.');
  }

  const content = main.cloneNode(true) as HTMLElement;
  content
    .querySelectorAll('.back, .lesson-badge, .lesson-title, .lesson-meta, .bnav')
    .forEach((element) => element.remove());

  content.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href && /^[^/]+\.html(?:#.*)?$/.test(href)) {
      anchor.setAttribute('href', `../${href}`);
    }
  });

  return { content: content.innerHTML };
};
