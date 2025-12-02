const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

const text = `> Diana shook her head. "Maybe, but my Mom was just a fan of Wonder Woman."
>
> *Nailed it*, thought Kevin.`;

const tokens = md.parse(text, {});
console.log(JSON.stringify(tokens, null, 2));

// Check if we have one or two blockquotes
const blockquotes = tokens.filter(t => t.type === 'blockquote_open');
console.log(`Blockquote count: ${blockquotes.length}`);
