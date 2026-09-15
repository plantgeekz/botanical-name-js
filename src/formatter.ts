import type { FormatOptions, HtmlOptions, ParsedName } from './types.js';

/* Port of src/Formatter.php in plantgeekz/botanical-name. */

type Style = 'roman' | 'italic' | 'trade';
type Segment = readonly [text: string, style: Style, spaceBefore: boolean];

/** Latin letters with diacritics → ASCII, identical to the PHP package. */
const ASCII: Readonly<Record<string, string>> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a',
  'æ': 'ae', 'ç': 'c', 'ć': 'c', 'č': 'c', 'ď': 'd', 'đ': 'd',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e', 'ě': 'e',
  'ğ': 'g', 'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'ı': 'i',
  'ł': 'l', 'ñ': 'n', 'ń': 'n', 'ň': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ō': 'o', 'ő': 'o', 'œ': 'oe',
  'ř': 'r', 'ś': 's', 'š': 's', 'ş': 's', 'ß': 'ss', 'ť': 't', 'ţ': 't',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ů': 'u', 'ű': 'u',
  'ý': 'y', 'ÿ': 'y', 'ź': 'z', 'ż': 'z', 'ž': 'z',
};

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
};

/** Plain-text name: "Hydrangea macrophylla subsp. serrata 'Bluebird'". */
export function format(name: ParsedName, options: FormatOptions = {}): string {
  const authors = options.authors ?? false;
  const typographic = options.typographic ?? false;

  if (name.formula !== null) {
    return name.formula.map((p) => format(p, options)).join(' × ');
  }

  let out = '';
  for (const [text, , space] of segments(name, authors, typographic)) {
    out += (space && out !== '' ? ' ' : '') + text;
  }
  return out;
}

/**
 * HTML with botanical italics: genus and epithets in italics; rank markers,
 * authors, hybrid signs, groups and cultivars in roman (ICN + ICNCP).
 * All text is HTML-escaped.
 */
export function toHtml(name: ParsedName, options: HtmlOptions = {}): string {
  const authors = options.authors ?? false;
  const typographic = options.typographic ?? false;
  const tag = options.tag === 'em' ? 'em' : 'i';

  if (name.formula !== null) {
    return name.formula.map((p) => toHtml(p, options)).join(' × ');
  }

  let out = '';
  let open = false;
  for (const [raw, style, space] of segments(name, authors, typographic)) {
    const sep = space && out !== '' ? ' ' : '';
    const text = escapeHtml(raw);
    if (style === 'italic') {
      out += open ? sep + text : `${sep}<${tag}>${text}`;
      open = true;
      continue;
    }
    if (open) {
      out += `</${tag}>`;
      open = false;
    }
    out += sep + (style === 'trade' ? `<span class="trade-designation">${text}</span>` : text);
  }
  return open ? `${out}</${tag}>` : out;
}

/** URL slug: "hydrangea-macrophylla-bluebird". */
export function slug(name: ParsedName): string {
  let s = ascii(format(name).toLowerCase());
  s = s.replace(/['"]/gu, '');
  s = s.replace(/[^a-z0-9]+/gu, '-');
  return s.replace(/^-+|-+$/gu, '');
}

/** Comparison key for matching and de-duplication: "hydrangea macrophylla bluebird". */
export function key(name: ParsedName): string {
  let s = ascii(format(name).toLowerCase());
  s = s.replace(/['"×+]/gu, '');
  // Same whitespace class as PHP's \s, not JavaScript's wider Unicode one.
  return s.replace(/[ \t\n\x0B\f\r]+/gu, ' ').replace(/^ | $/gu, '');
}

function segments(name: ParsedName, authors: boolean, typographic: boolean): Segment[] {
  const seg: Segment[] = [];
  if (name.genus !== null) {
    if (name.genusHybrid || name.graftChimaera) {
      seg.push([name.genusHybrid ? '×' : '+', 'roman', true]);
      seg.push([name.genus, 'italic', false]);
    } else {
      seg.push([name.genus, 'italic', true]);
    }
  }
  if (name.epithet !== null) {
    if (name.speciesHybrid) {
      seg.push(['×', 'roman', true]);
      seg.push([name.epithet, 'italic', false]);
    } else {
      seg.push([name.epithet, 'italic', true]);
    }
  }
  if (authors && name.authorship !== null) {
    seg.push([name.authorship, 'roman', true]);
  }
  for (const part of name.infraspecific) {
    if (part.rank !== null) {
      seg.push([part.rank, 'roman', true]);
    }
    if (part.epithet.startsWith('×')) {
      seg.push(['×', 'roman', true]);
      seg.push([part.epithet.slice(1), 'italic', false]);
    } else {
      seg.push([part.epithet, 'italic', true]);
    }
    if (authors && part.authorship !== null) {
      seg.push([part.authorship, 'roman', true]);
    }
  }
  if (name.group !== null) {
    seg.push([`${name.group} Group`, 'roman', true]);
  }
  if (name.tradeName !== null) {
    seg.push([name.tradeName, 'trade', true]);
  }
  if (name.cultivar !== null) {
    seg.push([
      typographic
        ? `‘${name.cultivar.replaceAll("'", '’')}’`
        : `'${name.cultivar}'`,
      'roman',
      true,
    ]);
  }
  return seg;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/gu, (ch) => HTML_ESCAPES[ch]!);
}

function ascii(s: string): string {
  let out = '';
  for (const ch of s) {
    out += ASCII[ch] ?? ch;
  }
  return out;
}
