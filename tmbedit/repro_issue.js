try {
    const MarkdownIt = require('markdown-it');
    const md = new MarkdownIt();

    const text = `> "I like your name.  It means 'divine', doesn't it?  Roman goddess of the moon and hunting; counterpart to the Greek Goddess Atramis." he said.
>
> Diana shook her head.  "Maybe, but my Mom was just a fan of Wonder Woman."
>
>  *Nailed it*, thought Kevin.  "Still, 'divine' is a good meaning for a name.  I wonder about Edric here, though."`;

    const fs = require('fs');
    const tokens = md.parse(text, {});
    fs.writeFileSync('parser_output.json', JSON.stringify(tokens, null, 2));
} catch (e) {
    const fs = require('fs');
    fs.writeFileSync('parser_error.txt', e.toString());
}
