const math = require('remark-math');
const remark = require('remark-parse');
const remarkRehypeBridge = require('remark-rehype');
const unified = require('unified');

const componentNameRegexp = /<([A-Z][a-zA-Z_]+)/gm;

function processComponentName(value) {
  const matches = value.match(componentNameRegexp);
  if (matches === null) {
    return [];
  }
  const components = matches.map(c => c.slice(1));
  return components;
}

function toJSX(node) {
  if (node.type === 'text') {
    return { jsx: node.value, imports: [] };
  }

  if (node.type === 'element') {
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

    const children = node.children.map(toJSX);
    const contents = children.map(c => c.jsx).join('');
    const imports = children.map(c => c.imports).reduce((a, b) => a.concat(b));
    const props = Object.keys(node.properties)
      .map(prop => `${prop}="${node.properties[prop]}"`)
      .join(' ');
    const tagName = node.tagName;
    return {
      jsx: `<${tagName}${
        props.length > 0 ? ' ' : ''
      }${props}>${contents}</${tagName}>`,
      imports,
    };
  }

  if (node.type === 'raw') {
    return {
      jsx: node.value,
      imports: processComponentName(node.value),
    };
  }

  if (node.type === 'root') {
    const children = node.children.map(toJSX);
    const contents = children.map(c => c.jsx).join('');
    const imports = Array.from(
      children
        .map(c => c.imports)
        .reduce((a, b) => a.concat(b))
        .reduce((s, componentName) => s.add(componentName), new Set(['Layout']))
    )
      .map(componentName => {
        if (componentName === 'Link') {
          return 'import {Link} from "gatsby";';
        }
        if (componentName === 'InlineMath') {
          return 'import {InlineMath} from "react-katex";';
        }
        if (componentName === 'BlockMath') {
          return 'import {BlockMath} from "react-katex";';
        }

        return `import ${componentName} from '../components/${componentName}';`;
      })
      .concat('import React from "react";');
    return (
      imports.join('\n') +
      '\n\n' +
      `
export default function() {
  return (
    <React.Fragment>
      <Layout>
      ${contents}
      </Layout>
    </React.Fragment>
  );
}`
    );
  }
}

function hastToJSX() {
  this.Compiler = toJSX;
}

const processor = unified()
  .use(remark)
  .use(math)
  .use(remarkRehypeBridge, { allowDangerousHTML: true })
  .use(hastToJSX);

module.exports = function(source, map, meta) {
  const callback = this.async();
  processor.process(source).then(jsx => {
    callback(null, jsx, map, meta);
  });
};
