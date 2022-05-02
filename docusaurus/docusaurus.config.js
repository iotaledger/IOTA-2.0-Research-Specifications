const path = require('path');

module.exports = {
     title: 'IOTA 2.0 Research Specifications',
     url: '/',
     baseUrl: '/',
     themes: ['@docusaurus/theme-classic'],
     plugins: [
         [
             '@docusaurus/plugin-content-docs',
             {
                 id: 'IOTA-Research-Specifications',
                 path: path.resolve(__dirname, '../'),
                 routeBasePath: 'IOTA-2.0-Research-Specifications',
                 sidebarPath: path.resolve(__dirname, '../sidebars.js'),
                 editUrl: 'https://github.com/iotaledger/IOTA-2.0-Research-Specifications/edit/main',
                 remarkPlugins: [require('remark-math'), require('rehype-katex')],
                 exclude: [
                    '**/docusaurus',
                  ],
             }
         ],
     ],
     staticDirectories: [],
 };