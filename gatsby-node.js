/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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
      jsx: `<InlineMath>{String.raw\`${node.children[0].value}\`}</InlineMath>`,
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

function resolveLinkImport(componentName) {
  if (componentName === 'Link') {
    return { destructure: 'Link', from: 'gatsby' };
  }
  return null;
}

function resolveMathImport(componentName) {
  if (componentName === 'InlineMath') {
    return { destructure: 'InlineMath', from: 'react-katex' };
  }

  if (componentName === 'BlockMath') {
    return { destructure: 'BlockMath', from: 'react-katex' };
  }

  return null;
}

exports.onCreateWebpackConfig = ({ actions, loaders }) => {
  const math = require('remark-math');
  const frontmatter = require('remark-frontmatter');
  const mdxLoader = require('@emilyhorsman/mdx');

  actions.setWebpackConfig({
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'src/components')
      }
    },
    resolveLoader: {
      modules: ['node_modules'],
    },
    module: {
      rules: [
        {
          test: mdxTestRe,
          use: [
            loaders.js(),
            {
              loader: '@emilyhorsman/mdx',
              options: {
                importResolvers: [
                  mdxLoader.resolveReactJSXImport,
                  resolveMathImport,
                  resolveLinkImport,
                  mdxLoader.resolveFilesystemImport,
                ],
                postRemarkUnifiedPlugins: [
                  // This is just to strip the frontmatter out. We won't use it
                  // in the unified pipeline.
                  [frontmatter, { type: 'yaml', marker: '-' }],
                  [math, {}],
                ],
                stringifyJSX,
              },
            },
          ],
        },
      ],
    },
  });
};

function getFrontmatter(absolutePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(absolutePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      }

      if (!data.startsWith('---')) {
        resolve({});
        return;
      }
      const end = data.indexOf('---', 3);
      if (end === -1) {
        resolve({});
        return;
      }
      const frontmatter = data.substring(3, end);
      const options = yaml.safeLoad(frontmatter, { filename: absolutePath });
      resolve(options);
    });
  });
}

function getPath(relativeDirectory, name) {
  if (name === 'index') {
    return relativeDirectory + '/';
  }

  return `${relativeDirectory}/${name}`
}

function getPage({ absolutePath, relativeDirectory, name }) {
  return getFrontmatter(absolutePath).then(frontmatter => {
    const pathName = name === 'index' ? '' : name
    return {
      path: getPath(relativeDirectory, name),
      component: absolutePath,
      context: {
        frontmatter,
      },
    };
  });
}

exports.createPages = ({ graphql, actions: { createPage } }) => {
  return new Promise((resolve, reject) => {
    const query = mdxQuery(graphql)
      .then(result => {
        if (result.errors) {
          return reject(result.errors);
        }

        Promise.all(
          result.data.allFile.edges.map(edge => edge.node).map(getPage)
        ).then(pages => pages.forEach(page => createPage(page)));
      })
      .then(resolve);
  });
};
