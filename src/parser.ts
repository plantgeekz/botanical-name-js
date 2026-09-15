import type { Infraspecific, ParsedName, WarningCode } from './types.js';

/*
 * Structural parser for botanical names (ICN + ICNCP). A line-by-line port of
 * src/Parser.php in plantgeekz/botanical-name - keep the two in step; the
 * shared fixtures fail if they drift apart.
 */

/** Infraspecific rank markers, normalized to their ICN abbreviation. */
const RANKS: Readonly<Record<string, string>> = {
  subsp: 'subsp.', ssp: 'subsp.', subspecies: 'subsp.',
  var: 'var.', variety: 'var.', varietas: 'var.',
  subvar: 'subvar.',
  f: 'f.', fo: 'f.', forma: 'f.',
  subf: 'subf.',
  nothosubsp: 'nothosubsp.', nothovar: 'nothovar.', nothof: 'nothof.',
  convar: 'convar.',
};

/** Lowercase words that may start or continue an author citation. */
const AUTHOR_PARTICLES = [
  'de', 'del', 'della', 'di', 'du', 'da', 'dos', 'van', 'von', 'der', 'den',
  'ex', 'et', 'in', 'le', 'la', 'y', 'f.', 'fil.',
];

const HYBRID_MARKERS = ['×', 'x', 'X'];

/* Whitespace class matching PCRE's \s plus NBSP and thin spaces, so PHP and JS agree. */
const WHITESPACE = /[ \t\n\x0B\f\r   ]+/gu;

const QUOTES: Readonly<Record<string, string>> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'",
  '`': "'", '´': "'", '′': "'",
  '“': '"', '”': '"', '„': '"', '″': '"',
};

interface MutableInfra {
  rank: string | null;
  epithet: string;
  authorship: string | null;
}

const EMPTY: Omit<ParsedName, 'verbatim' | 'genus' | 'formula' | 'warnings'> = {
  genusHybrid: false,
  graftChimaera: false,
  epithet: null,
  speciesHybrid: false,
  authorship: null,
  infraspecific: [],
  group: null,
  tradeName: null,
  cultivar: null,
};

export class Parser {
  private warnings: WarningCode[] = [];

  parse(input: string): ParsedName | null {
    this.warnings = [];

    let s = this.cleanWhitespace(input);
    if (s === '') {
      return null;
    }
    s = this.normalizeQuotes(s);

    const formula = this.parseFormula(s, input);
    if (formula !== false) {
      return formula;
    }

    // Cultivar group written as "(Capitata Group)".
    let group: string | null = null;
    let m = /\(\s*([^()]+?)\s+(?:Group|Gp\.?)\s*\)/u.exec(s);
    if (m) {
      group = m[1]!;
      s = this.cleanWhitespace(s.replaceAll(m[0], ' '));
    }

    // Cultivar in single quotes, from the first opening quote to the last
    // closing one, so apostrophes inside stay: 'O'Hara', 'Buddha's Temple',
    // 'Rees' Choice', 'Hugs 'N' Kisses'.
    let cultivar: string | null = null;
    m = /(?<![\p{L}\p{N}])'(.+)'(?![\p{L}\p{N}])/u.exec(s) ?? /"(.+?)"/u.exec(s);
    if (m) {
      cultivar = trimSpaces(m[1]!);
      s = this.cleanWhitespace(s.replaceAll(m[0], ' '));
      if (m[0][0] === '"') {
        this.warn('quotes_normalized');
      }
    }

    // Bare "(Capitata)" at the end - a group without the word "Group", as
    // seed catalogues write it. Only next to a cultivar: on its own, "(Lehnert)"
    // is far more often an incomplete author citation.
    if (group === null && cultivar !== null) {
      m = /\(\s*(\p{Lu}\p{Ll}+(?:[ -]\p{Lu}?\p{Ll}+)*)\s*\)$/u.exec(s);
      if (m) {
        group = m[1]!;
        s = this.cleanWhitespace(s.slice(0, s.length - m[0].length));
        this.warn('group_inferred');
      }
    }

    let tokens = this.mergeHybridMarkers(s.split(' '));

    const tradeName = this.extractTradeName(tokens);

    if (cultivar === null) {
      cultivar = this.extractCultivarMarker(tokens);
    }
    if (group === null) {
      group = this.extractGroupWord(tokens);
    }

    tokens = this.dropStrayTokens(tokens);
    if (tokens.length === 0) {
      return null;
    }

    // Genus, possibly a nothogenus (×) or graft-chimaera (+).
    let genus = tokens.shift()!;
    let genusHybrid = false;
    let graftChimaera = false;
    if (genus.startsWith('×')) {
      genusHybrid = true;
      genus = genus.slice(1);
    } else if (genus.startsWith('+')) {
      graftChimaera = true;
      genus = genus.slice(1);
    }
    genus = this.fixGenusCase(genus);
    if (/^\p{Lu}\.$/u.test(genus)) {
      this.warn('abbreviated_genus');
    } else if (!/^\p{Lu}\p{Ll}[\p{Ll}-]*$/u.test(genus)) {
      return null;
    }

    // Specific epithet.
    let epithet: string | null = null;
    let speciesHybrid = false;
    if (tokens.length > 0) {
      const t = tokens[0]!;
      if (['sp.', 'sp', 'spp.', 'spp'].includes(t)) {
        tokens.shift();
        this.warn('species_unspecified');
      } else if (!this.startsInfraspecific(tokens, 0)) {
        let candidate = t;
        let hybrid = false;
        if (candidate.startsWith('×')) {
          hybrid = true;
          candidate = candidate.slice(1);
        }
        candidate = this.fixEpithetCase(candidate);
        if (this.isBareEpithet(candidate)) {
          tokens.shift();
          epithet = candidate;
          speciesHybrid = hybrid;
        }
      }
    }

    // Authors and infraspecific parts.
    let authorship: string | null = null;
    const infra: MutableInfra[] = [];
    const buffer: string[] = [];
    const flush = (): void => {
      authorship = flushAuthors(buffer, authorship, infra);
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      if (this.startsInfraspecific(tokens, i)) {
        flush();
        const rank = this.rankOf(t)!;
        if (rank !== t) {
          this.warn('rank_normalized');
        }
        infra.push({ rank, epithet: this.fixEpithetCase(tokens[i + 1]!), authorship: null });
        i++;
        continue;
      }
      if (buffer.length === 0 && (epithet !== null || infra.length > 0)
        && this.isEpithet(t) && !AUTHOR_PARTICLES.includes(t)) {
        flush();
        infra.push({ rank: null, epithet: t, authorship: null });
        this.warn('rank_missing');
        continue;
      }
      buffer.push(t);
    }
    flush();

    return {
      verbatim: input,
      genus,
      genusHybrid,
      graftChimaera,
      epithet,
      speciesHybrid,
      authorship,
      infraspecific: infra.map((p): Infraspecific => ({ rank: p.rank, epithet: p.epithet, authorship: p.authorship })),
      group,
      tradeName,
      cultivar,
      formula: null,
      warnings: this.sortedWarnings(),
    };
  }

  /**
   * "Salix alba × S. fragilis": a standalone hybrid sign followed by a
   * capitalised word. Returns false when the string is not a formula.
   */
  private parseFormula(s: string, input: string): ParsedName | false | null {
    const tokens = s.split(' ');
    const parts: string[] = [];
    let current: string[] = [];
    let quoted = false;
    tokens.forEach((t, i) => {
      const next = tokens[i + 1];
      // A sign inside a cultivar name is not a formula: 'Longfields X Factor'.
      const wasQuoted = quoted;
      quoted = this.quoteStateAfter(t, quoted);
      if (!wasQuoted && i > 0 && HYBRID_MARKERS.includes(t) && next !== undefined && /^\p{Lu}/u.test(next)) {
        parts.push(current.join(' '));
        current = [];
        if (t !== '×') {
          this.warn('hybrid_marker_normalized');
        }
        return;
      }
      current.push(t);
    });
    if (parts.length === 0) {
      return false;
    }
    parts.push(current.join(' '));

    const parsed: ParsedName[] = [];
    for (const part of parts) {
      const p = new Parser().parse(part);
      if (p === null) {
        return null;
      }
      parsed.push(p);
    }

    return {
      verbatim: input,
      genus: parsed[0]!.genus,
      ...EMPTY,
      formula: parsed,
      warnings: this.sortedWarnings(),
    };
  }

  /** Whether we are inside a quoted cultivar name after this token. */
  private quoteStateAfter(token: string, quoted: boolean): boolean {
    const opens = /^[(\[]?['"]/u.test(token);
    const closes = token.length > 1 && /['"][)\].,;]?$/u.test(token);
    if (!quoted) {
      return opens && !closes;
    }
    return !closes;
  }

  /**
   * Joins a free-standing hybrid sign to the name it belongs to:
   * "× Chitalpa" → "×Chitalpa", "Mentha x piperita" → "Mentha ×piperita",
   * "+ Crataegomespilus" → "+Crataegomespilus".
   */
  private mergeHybridMarkers(tokens: string[]): string[] {
    const out: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]!;
      const next = tokens[i + 1];
      if (next !== undefined && HYBRID_MARKERS.includes(t)) {
        const genusPosition = out.length === 0 && /^\p{Lu}/u.test(next);
        const epithetPosition = out.length > 0 && this.isBareEpithet(next);
        if (genusPosition || epithetPosition) {
          if (t !== '×') {
            this.warn('hybrid_marker_normalized');
          }
          out.push(`×${next}`);
          i++;
          continue;
        }
      }
      if (next === undefined && out.length > 0 && (t === '+' || HYBRID_MARKERS.includes(t))) {
        this.warn('stray_characters_removed');
        continue;
      }
      if (t === '+' && out.length === 0 && next !== undefined) {
        out.push(`+${next}`);
        i++;
        continue;
      }
      out.push(t);
    }
    return out;
  }

  /** "Rosa Flower Carpet® 'Noare'" → trade designation "Flower Carpet". */
  private extractTradeName(tokens: string[]): string | null {
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k]!;
      if (!/[®™]/u.test(t)) {
        continue;
      }
      const stripped = t.replace(/[®™]/gu, '');
      let end = k;
      if (stripped === '') {
        end = k - 1;
      } else {
        tokens[k] = stripped;
      }
      let start = end + 1;
      while (start - 1 > 0 && this.isCapitalisedWord(tokens[start - 1]!)) {
        start--;
      }
      const name = start <= end ? tokens.slice(start, end + 1).join(' ') : null;
      // Remove the trade tokens and a lone "®" token.
      const removeTo = stripped === '' ? k : end;
      tokens.splice(start, removeTo - start + 1);
      return name;
    }
    return null;
  }

  /** "Hosta cv. Blue Angel" → cultivar "Blue Angel". */
  private extractCultivarMarker(tokens: string[]): string | null {
    for (let k = 1; k < tokens.length; k++) {
      const t = tokens[k]!;
      if (['cv', 'cvs'].includes(t.replace(/\.+$/u, '').toLowerCase()) && tokens[k + 1] !== undefined) {
        const name = tokens.slice(k + 1).join(' ');
        tokens.splice(k);
        this.warn('cultivar_marker_normalized');
        return name;
      }
    }
    return null;
  }

  /** "Hosta Tardiana Group" → group "Tardiana". */
  private extractGroupWord(tokens: string[]): string | null {
    for (let k = 2; k < tokens.length; k++) {
      if (!['Group', 'Gp', 'Gp.'].includes(tokens[k]!)) {
        continue;
      }
      let start = k;
      while (start - 1 > 0 && this.isCapitalisedWord(tokens[start - 1]!)) {
        start--;
      }
      if (start === k) {
        return null;
      }
      const name = tokens.slice(start, k).join(' ');
      tokens.splice(start, k - start + 1);
      return name;
    }
    return null;
  }

  /**
   * Removes leftovers with no letters or digits, such as an unmatched quote
   * or bracket. "&" survives because author teams use it.
   */
  private dropStrayTokens(tokens: string[]): string[] {
    const out: string[] = [];
    tokens.forEach((t, i) => {
      if (i > 0 && /^[^\p{L}\p{N}&]+$/u.test(t)) {
        this.warn('stray_characters_removed');
        return;
      }
      out.push(t);
    });
    return out;
  }

  private startsInfraspecific(tokens: string[], i: number): boolean {
    const next = tokens[i + 1];
    return this.rankOf(tokens[i]!) !== null
      && next !== undefined
      && this.isEpithet(this.fixEpithetCase(next, false));
  }

  private rankOf(token: string): string | null {
    if (!/^\p{Ll}/u.test(token)) {
      return null;
    }
    return RANKS[token.replace(/\.+$/u, '')] ?? null;
  }

  private isEpithet(token: string): boolean {
    return /^×?\p{Ll}[\p{Ll}-]+$/u.test(token);
  }

  private isBareEpithet(token: string): boolean {
    return /^\p{Ll}[\p{Ll}-]+$/u.test(token);
  }

  private isCapitalisedWord(token: string): boolean {
    return /^[\p{Lu}\p{N}][\p{L}\p{N}'-]*$/u.test(token);
  }

  private fixGenusCase(genus: string): string {
    if (!/^\p{L}{2,}$/u.test(genus)) {
      return genus;
    }
    const lower = genus.toLowerCase();
    if (genus === lower || genus === genus.toUpperCase()) {
      this.warn('case_normalized');
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return genus;
  }

  private fixEpithetCase(epithet: string, warn = true): string {
    if (/^\p{Lu}{3,}$/u.test(epithet)) {
      if (warn) {
        this.warn('case_normalized');
      }
      return epithet.toLowerCase();
    }
    return epithet;
  }

  private cleanWhitespace(s: string): string {
    return trimSpaces(s.replace(WHITESPACE, ' '));
  }

  /** Curly and look-alike quotes → straight ones (fixes iOS smart quotes). */
  private normalizeQuotes(s: string): string {
    let out = '';
    for (const ch of s) {
      out += QUOTES[ch] ?? ch;
    }
    if (out !== s) {
      this.warn('quotes_normalized');
    }
    return out;
  }

  private sortedWarnings(): WarningCode[] {
    return [...new Set(this.warnings)].sort();
  }

  private warn(code: WarningCode): void {
    this.warnings.push(code);
  }
}

/**
 * Moves the collected author tokens to the name part they belong to: the
 * species (or genus) until the first infraspecific rank, then that rank.
 * Empties `buffer` and returns the (possibly extended) species authorship.
 */
function flushAuthors(buffer: string[], authorship: string | null, infra: MutableInfra[]): string | null {
  if (buffer.length === 0) {
    return authorship;
  }
  const author = buffer.join(' ');
  buffer.length = 0;
  const last = infra[infra.length - 1];
  if (last === undefined) {
    return authorship === null ? author : `${authorship} ${author}`;
  }
  last.authorship = author;
  return authorship;
}

/** Like PHP's trim() on the collapsed string: only spaces remain at the ends. */
function trimSpaces(s: string): string {
  return s.replace(/^[ \t\n\x0B\r\0]+|[ \t\n\x0B\r\0]+$/gu, '');
}
