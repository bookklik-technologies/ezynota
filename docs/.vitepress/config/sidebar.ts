import type { DefaultTheme } from 'vitepress';

// Guide sidebar begins with "Getting started", followed by topic groups in learning order.
export const guideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Getting started',
    items: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Configuration', link: '/guide/configuration' },
      { text: 'Modes', link: '/guide/modes' },
      { text: 'Declarative usage', link: '/guide/declarative' },
    ],
  },
  {
    text: 'Core concepts',
    items: [
      { text: 'Editing & block API', link: '/guide/editing' },
      { text: 'Keyboard & markdown', link: '/guide/keyboard' },
      { text: 'Workspace', link: '/guide/workspace' },
      { text: 'Interchange', link: '/guide/interchange' },
    ],
  },
  {
    text: 'Customization',
    items: [
      { text: 'Custom tools', link: '/guide/custom-tools' },
      { text: 'Theming', link: '/guide/theming' },
      { text: 'Internationalization', link: '/guide/i18n' },
      { text: 'Development skills', link: '/guide/development-skills' },
      { text: 'Security', link: '/guide/security' },
    ],
  },
];

export const apiSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Editor',
    items: [
      { text: 'Ezynota class', link: '/api/editor' },
      { text: 'Events', link: '/api/events' },
      { text: 'Commands', link: '/api/commands' },
    ],
  },
  {
    text: 'Data',
    items: [
      { text: 'Document format', link: '/api/document-format' },
      { text: 'Schema & migrations', link: '/api/migrations' },
      { text: 'Storage adapters', link: '/api/storage' },
    ],
  },
  {
    text: 'Extensibility',
    items: [
      { text: 'Block tools', link: '/api/block-tools' },
      { text: 'Inline tools', link: '/api/inline-tools' },
      { text: 'Tunes', link: '/api/tunes' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Workspace API', link: '/api/workspace' },
      { text: 'Errors', link: '/api/errors' },
    ],
  },
];

export const sidebar: DefaultTheme.Sidebar = {
  '/guide/': guideSidebar,
  '/api/': apiSidebar,
};
