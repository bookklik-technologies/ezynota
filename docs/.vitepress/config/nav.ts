import type { DefaultTheme } from 'vitepress';

// Shared navigation order: Guide → API reference → project-specific sections → Resources.
// Ezynota has no project-specific nav sections; do not invent equivalents.
export const nav: DefaultTheme.NavItem[] = [
  { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
  {
    text: 'API reference',
    link: '/api/editor',
    activeMatch: '/api/',
  },
  {
    text: 'Resources',
    items: [
      { text: 'Document format', link: '/api/document-format' },
      { text: 'Custom tools', link: '/guide/custom-tools' },
      { text: 'Security', link: '/guide/security' },
      {
        text: 'Changelog (GitHub)',
        link: 'https://github.com/bookklik-technologies/ezynota/releases',
      },
      {
        text: 'Contributing',
        link: 'https://github.com/bookklik-technologies/ezynota/blob/main/CONTRIBUTING.md',
      },
    ],
  },
];
