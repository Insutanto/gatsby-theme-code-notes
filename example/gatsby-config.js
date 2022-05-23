module.exports = {
  siteMetadata: {
    title: "Insutanto's Code Notes",
    description: 'Insutanto的技术笔记',
    keywords: ["insutanto", "techlead", "programming", "backend", "java", "python"],
  },
  plugins: [
    {
      resolve: 'gatsby-theme-code-notes',
      options: {
        contentPath: 'code-notes',
        basePath: '/',
        gitRepoContentPath:
          'https://github.com/mrmartineau/gatsby-theme-code-notes/tree/master/example/code-notes/',
        showDescriptionInSidebar: true,
        showThemeInfo: true,
        logo:
        'https://avatars.githubusercontent.com/u/19406290',
        openSearch: {
          siteShortName: `Insutanto Code Notes`,
          siteUrl: 'https://programming.insutanto.net',
          siteTags: 'programming',
          siteContact: 'https://twitter.com/insutantow',
          siteDescription: 'Insutanto Code Notes',
        },
        showDate: true,
      },
    }
  ],
}
