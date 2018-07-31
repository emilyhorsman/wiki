const remark = require('remark-parse');
const remarkRehypeBridge = require('remark-rehype');
const unified = require('unified');
const { getOptions } = require('loader-utils');
const validateOptions = require('schema-utils');

const componentNameRegexp = /<([A-Z][a-zA-Z_]+)/gm;

function processComponentName(value) {
  const matches = value.match(componentNameRegexp);
  if (matches === null) {
    return [];
  }
  const components = matches.map(c => c.slice(1));
  return components;
}

/**
 * Importing in your Markdown is repetitive and annoying.
 */
function resolveImport(componentName) {
  if (componentName === 'JSX_IMPORT') {
    return { default: 'React', from: 'react' };
  }

  if (componentName === 'Link') {
    return { destructure: 'Link', from: 'gatsby' };
  }

  if (componentName === 'InlineMath') {
    return { destructure: 'InlineMath', from: 'react-katex' };
  }

  if (componentName === 'BlockMath') {
    return { destructure: 'BlockMath', from: 'react-katex' };
  }

  return { default: componentName, from: '../components/' + componentName };
}

function stringifyImport(importDescription) {
  if (Boolean(importDescription.destructure)) {
    return `import {${importDescription.destructure}} from "${
      importDescription.from
    }";`;
  }

  if (Boolean(importDescription.default)) {
    return `import ${importDescription.default} from "${
      importDescription.from
    }";`;
  }

  return null;
}

function toJSX(node, stringifyJSX) {
  const result = stringifyJSX(node);
  if (result !== null) {
    return result;
  }

  if (node.type === 'text') {
    return { jsx: node.value, imports: [] };
  }

  if (node.type === 'element') {
    const children = node.children.map(node => toJSX(node, stringifyJSX));
    const contents = children.map(c => c.jsx).join('');
    const imports = children.map(c => c.imports).reduce((a, b) => a.concat(b));
    const props = Object.keys(node.properties)
      .map(prop => `${prop}="${node.properties[prop]}"`)
      .join(' ');
    const tagName = node.tagName;
    const jsx = `<${tagName}${
      props.length > 0 ? ' ' : ''
    }${props}>${contents}</${tagName}>`;

    return {
      jsx,
      imports,
    };
  }

  if (node.type === 'raw') {
    return {
      jsx: node.value,
      imports: processComponentName(node.value),
    };
  }
}

const compiler = options => node => {
  if (node.type !== 'root') {
    console.error('Compiler was not passed a root node.', node);
    return;
  }

  const children = node.children.map(node => toJSX(node, options.stringifyJSX));
  const contents = children.map(c => c.jsx).join('');
  const imports = Array.from(
    children
      .map(c => c.imports)
      .reduce((a, b) => a.concat(b))
      .reduce(
        (s, componentName) => s.add(componentName),
        new Set(['JSX_IMPORT', 'Layout'])
      )
  )
    .map(options.resolveImport)
    .map(stringifyImport);
  return imports.join('\n') + '\n\n' + options.stringifyRoot(contents);
};

function hastToJSX(options) {
  this.Compiler = compiler(options);
}

function stringifyRoot(root) {
  return `
export default function() {
  return (
    <Layout>
    ${root}
    </Layout>
  );
}`;
}

const schemaPlugins = {
  type: 'array',
  items: [
    {
      instanceOf: 'Function',
    },
    {
      type: 'object',
    },
  ],
};

const schema = {
  additionalProperties: false,
  type: 'object',
  properties: {
    postJSXUnifiedPlugins: schemaPlugins,
    postRehypeUnifiedPlugins: schemaPlugins,
    postRemarkUnifiedPlugins: schemaPlugins,
    preRemarkUnifiedPlugins: schemaPlugins,
    resolveImport: {
      instanceOf: 'Function',
    },
    stringifyJSX: {
      instanceOf: 'Function',
    },
    stringifyRoot: {
      instanceOf: 'Function',
    },
  },
};

/**
 * Pipeline:
 *
 * 1. Parse the Markdown source into a MDAST with remark.
 * 2. Transform the MDAST into a HAST with remark-rehype.
 * 3. Stringify HAST into JSX.
 */
module.exports = function(source) {
  const defaultOptions = {
    postJSXUnifiedPlugins: [],
    postRehypeUnifiedPlugins: [],
    postRemarkUnifiedPlugins: [],
    preRemarkUnifiedPlugins: [],
    resolveImport,
    stringifyJSX: () => null,
    stringifyRoot,
  };
  const options = { ...defaultOptions, ...getOptions(this) };
  validateOptions(schema, options, 'mdx-loader');

  const callback = this.async();

  const plugins = [
    ...options.preRemarkUnifiedPlugins,
    [remark, {}],
    ...options.postRemarkUnifiedPlugins,
    [remarkRehypeBridge, { allowDangerousHTML: true }],
    ...options.postRehypeUnifiedPlugins,
    [hastToJSX, options],
    ...options.postJSXUnifiedPlugins,
  ];
  const processor = plugins.reduce((acc, [plugin, pluginOptions]) => {
    acc.use(plugin, pluginOptions);
    return acc;
  }, unified());

  processor.process(source).then(jsx => {
    callback(null, jsx);
  });
};
