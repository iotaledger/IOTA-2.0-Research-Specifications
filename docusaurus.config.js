const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const math = require('remark-math');
const katex = require('rehype-katex');

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'Research Specifications',
  tagline: 'The research specifications of the IOTA 2.0 protocol.',
  url: 'https://github.com/iotaledger/IOTA-2.0-Research-Specifications',
  baseUrl: '/IOTA-2.0-Research-Specifications/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: '/img/logo/favicon.ico',
  organizationName: 'iotaledger', // Usually your GitHub org/user name.
  projectName: 'IOTA-2.0-Research-Specifications', // Usually your repo name.
  stylesheets: [
    'https://fonts.googleapis.com/css?family=Material+Icons',
    {
      href: "https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.css",
      integrity: "sha384-Um5gpz1odJg5Z4HAmzPtgZKdTBHZdw8S29IecapCSB31ligYPhHQZMIlWLYQGVoc",
      crossorigin: "anonymous",
    }
  ],
  themeConfig: {
    colorMode: {
      defaultMode: "dark"
    },
    navbar: {
      logo: {
        alt: 'IOTA',
        src: '/img/logo/Logo_Swirl_Dark.png',
      },
      items: [
        {
          type: 'doc',
          docId: 'preface',
          position: 'left',
          label: 'Specification',
        },
        {
          href: 'https://github.com/iotaledger/IOTA-2.0-Research-Specifications',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Specification',
          items: [
            {
              label: 'Specification',
              to: '/docs/preface',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.iota.org',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/iota',
            }, {
              label: 'Stack Exchange',
              href: 'https://iota.stackexchange.com/',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/iotaledger/IOTA-2.0-Research-Specifications',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} IOTA Foundation. Built with Docusaurus.`,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        // Documentation settings
        docs: {
          // Latex renderer settings
          remarkPlugins: [math],
          rehypePlugins: [katex],
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
         'https://github.com/IOTA-2.0-Research-Specifications/edit/main/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
    
  ],
};
