const path = require('path');

module.exports = {
    title: 'IOTA 2.0 Research Specifications',
    url: '/',
    baseUrl: '/',
    themes: ['@docusaurus/theme-classic'],
    themeConfig: {
        navbar: {
            // Workaround to disable broken logo href on test build
            logo: {
                src: '/',
                href: 'https://wiki.iota.org/',
            },
        },
    },
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
                include: ['*.md'],
                exclude: ['README.md'],
            }
        ],
    ],
    staticDirectories: [],
};