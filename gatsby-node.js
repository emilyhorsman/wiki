/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

const mdxTestRe = /\.mdx?$/;

const mdxQuery = graphql =>
  graphql(`
    {
      allFile(filter: { extension: { regex: "/^mdx?$/" } }) {
        edges {
          node {
            absolutePath
            relativeDirectory
            name
          }
        }
      }
    }
  `);

exports.onCreateWebpackConfig = ({ actions, loaders }) => {
  actions.setWebpackConfig({
    resolveLoader: {
      alias: {
        'mdx-loader': require('path').resolve('./mdx-loader.js'),
      },
    },
    module: {
      rules: [
        {
          test: mdxTestRe,
          use: [loaders.js(), 'mdx-loader'],
        },
      ],
    },
  });
};

exports.createPages = ({ graphql, actions: { createPage } }) => {
  return new Promise((resolve, reject) => {
    const query = mdxQuery(graphql)
      .then(result => {
        if (result.errors) {
          return reject(result.errors);
        }

        result.data.allFile.edges
          .map(edge => edge.node)
          .map(({ absolutePath, relativeDirectory, name }) => ({
            path: `${relativeDirectory}/${name}`,
            component: absolutePath,
          }))
          .forEach(page => createPage(page));
      })
      .then(resolve);
  });
};
