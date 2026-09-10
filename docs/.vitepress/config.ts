import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "Ezynota",
  description:
    "A free, block-style editor with portable JSON output. Zero dependencies, transaction-driven, accessible, and secure by default.",
  base: "/ezynota/",
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],

  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Ezynota",

    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      {
        text: "API",
        link: "/api/editor",
        activeMatch: "/api/",
      },
      {
        text: "Resources",
        items: [
          { text: "Document format", link: "/api/document-format" },
          { text: "Custom tools", link: "/guide/custom-tools" },
          { text: "Security", link: "/guide/security" },
          { text: "Changelog (GitHub)", link: "https://github.com/bookklik-technologies/ezynota/releases" },
        ],
      },
      {
        text: "v0.3.0",
        items: [
          {
            text: "Changelog",
            link: "https://github.com/bookklik-technologies/ezynota/releases",
          },
          {
            text: "Contributing",
            link: "https://github.com/bookklik-technologies/ezynota/blob/main/CONTRIBUTING.md",
          },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "Modes", link: "/guide/modes" },
            { text: "Declarative usage", link: "/guide/declarative" },
          ],
        },
        {
          text: "Core concepts",
          items: [
            { text: "Editing & block API", link: "/guide/editing" },
            { text: "Keyboard & markdown", link: "/guide/keyboard" },
            { text: "Workspace", link: "/guide/workspace" },
            { text: "Interchange", link: "/guide/interchange" },
          ],
        },
        {
          text: "Customization",
          items: [
            { text: "Custom tools", link: "/guide/custom-tools" },
            { text: "Theming", link: "/guide/theming" },
            { text: "Internationalization", link: "/guide/i18n" },
            { text: "Security", link: "/guide/security" },
          ],
        },
      ],
      "/api/": [
        {
          text: "Editor",
          items: [
            { text: "Ezynota class", link: "/api/editor" },
            { text: "Events", link: "/api/events" },
            { text: "Commands", link: "/api/commands" },
          ],
        },
        {
          text: "Data",
          items: [
            { text: "Document format", link: "/api/document-format" },
            { text: "Schema & migrations", link: "/api/migrations" },
            { text: "Storage adapters", link: "/api/storage" },
          ],
        },
        {
          text: "Extensibility",
          items: [
            { text: "Block tools", link: "/api/block-tools" },
            { text: "Inline tools", link: "/api/inline-tools" },
            { text: "Tunes", link: "/api/tunes" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Workspace API", link: "/api/workspace" },
            { text: "Errors", link: "/api/errors" },
          ],
        },
      ],
    },

    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Search docs", buttonAriaLabel: "Search docs" },
        },
      },
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/bookklik-technologies/ezynota" },
    ],

    outline: { level: [2, 3], label: "On this page" },

    footer: {
      message:
        "Released under the MIT License. Zero runtime dependencies.",
      copyright: "Copyright © Ezynota contributors",
    },

    docFooter: {
      prev: "Previous page",
      next: "Next page",
    },
  },

  markdown: {
    lineNumbers: false,
  },

  vite: {
    // The library itself is never imported by the docs build; keep
    // optimization off so VitePress doesn't try to pre-bundle it.
    optimizeDeps: {
      exclude: ["@bookklik/ezynota"],
    },
  },
});
