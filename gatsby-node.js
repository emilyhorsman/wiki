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

function stringifyJSX(node) {
  if (node.type !== 'element') {
    return null;
  }

  if (node.tagName === 'span' && node.properties.className === 'inlineMath') {
    return {
      jsx: `<InlineMath>${node.children[0].value}</InlineMath>`,
      imports: ['InlineMath'],
    };
  }

  if (node.tagName === 'div' && node.properties.className === 'math') {
    return {
      jsx: `<BlockMath>{String.raw\`${node.children[0].value}\`}</BlockMath>`,
      imports: ['BlockMath'],
    };
  }

  return null;
}

exports.onCreateWebpackConfig = ({ actions, loaders }) => {
  const math = require('remark-math');

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
          use: [
            loaders.js(),
            {
              loader: 'mdx-loader',
              options: {
                postRemarkUnifiedPlugins: [[math, {}]],
                stringifyJSX,
              },
            },
          ],
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
