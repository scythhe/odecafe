// Georgian has no letter case. Mtavruli (U+1C90–U+1CBF) is a separate display
// script that JS toUpperCase() and CSS text-transform produce from regular
// Mkhedruli letters — it looks wrong in running text, so we always store Mkhedruli.
export const toMkhedruli = (s) =>
  String(s ?? '').replace(/[Ა-ᲺᲽ-Ჿ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xbc0));

// Tidy a menu label: collapse whitespace, "(x)750ml" → "(x) 750ml", "( x" → "(x".
// Only Latin first letters are capitalised.
export function tidy(s) {
  return toMkhedruli(s)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\)(?=\d)/g, ') ')
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}
