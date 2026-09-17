import { defineConfig } from "vitepress";
import { nav } from "./config/nav";
import { sidebar } from "./config/sidebar";
import { editLinkConfig, sharedThemeConfig } from "./config/shared";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "Ezynota",
  titleTemplate: false,
  description:
    "A free, block-style editor with portable JSON output. Zero dependencies, transaction-driven, accessible, and secure by default.",
  base: "/ezynota/",
  head: [
    // Resolve beneath the deployment base path.
    ["link", { rel: "icon", type: "image/svg+xml", href: "/ezynota/icon.svg" }],
    ["meta", { name: "theme-color", content: "#7c3aed" }],
  ],

  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Ezynota",
    nav,
    sidebar,
    socialLinks: [
      { icon: "github", link: "https://github.com/bookklik-technologies/ezynota" },
    ],
    editLink: editLinkConfig("ezynota"),
    footer: {
      message:
        "Released under the MIT License. Zero runtime dependencies.",
      copyright: "Copyright © Ezynota contributors",
    },
    ...sharedThemeConfig,
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
