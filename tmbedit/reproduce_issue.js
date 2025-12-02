
const content = `> Future Flashback
>
> Kevin, wearing the Flynn Security Robot armor...
>
> *Nailed it*, thought Kevin.
>
> "What do you mean?"`;

console.log("Original Content:");
console.log(JSON.stringify(content));

// Current sanitization
let sanitized = content
    .replace(/^>  /gm, '> ')
    .replace(/\\\*&gt;/g, '>')
    .replace(/\\\*>/g, '>')
    .replace(/^\\&gt;/gm, '>')
    .replace(/^&gt;/gm, '>')
    .replace(/^\*>/gm, '>')
    .replace(/^\*&gt;/gm, '>');

console.log("\nCurrent Sanitization Result:");
console.log(JSON.stringify(sanitized));

// Proposed fix: Normalize empty blockquote lines
let proposed = sanitized.replace(/^>$/gm, '> ');

console.log("\nProposed Fix Result:");
console.log(JSON.stringify(proposed));

// Check if it handles the specific case
const specificCase = `>
> *Nailed it*`;
console.log("\nSpecific Case Original:");
console.log(JSON.stringify(specificCase));

let specificSanitized = specificCase.replace(/^>$/gm, '> ');
console.log("Specific Case Fixed:");
console.log(JSON.stringify(specificSanitized));
