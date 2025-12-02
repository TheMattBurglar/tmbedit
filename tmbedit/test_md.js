try {
    const MarkdownIt = require('markdown-it');
    const md = new MarkdownIt();
    const text = '>  *Nailed it*, thought Kevin.';
    console.log(JSON.stringify(md.parse(text, {}), null, 2));
} catch (e) {
    console.error(e);
}
