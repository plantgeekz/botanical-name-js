# Botanical Name

[![Tests](https://github.com/plantgeekz/botanical-name-js/actions/workflows/tests.yml/badge.svg)](https://github.com/plantgeekz/botanical-name-js/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/v/@plantgeekz_com/botanical-name.svg)](https://www.npmjs.com/package/@plantgeekz_com/botanical-name)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22765112.svg)](https://doi.org/10.5281/zenodo.22765112)

Parse, normalize and format botanical plant names in JavaScript and TypeScript -
hybrids, infraspecific ranks, authors, cultivars, cultivar groups and trade
designations - with the italics the naming codes (ICN and ICNCP) ask for.
Zero dependencies; runs in Node and the browser.

Built for and used in production by [PlantGeekz](https://plantgeekz.com), the plant
identification and collection app. Also available for PHP as
[`plantgeekz/botanical-name`](https://github.com/plantgeekz/botanical-name-php); both
packages run the same test fixtures and give byte-identical results.

```ts
import { parse, format, toHtml, slug, key } from '@plantgeekz_com/botanical-name';

const name = parse('hydrangea x macrophylla ssp. serrata cv. Bluebird');

format(name); // Hydrangea ×macrophylla subsp. serrata 'Bluebird'
toHtml(name); // <i>Hydrangea</i> ×<i>macrophylla</i> subsp. <i>serrata</i> &#039;Bluebird&#039;
slug(name);   // hydrangea-macrophylla-subsp-serrata-bluebird
key(name);    // hydrangea macrophylla subsp. serrata bluebird
```

## Why

Plant names from spreadsheets, nursery catalogues and user input arrive in every
shape: `x` instead of `×`, `ssp.` instead of `subsp.`, `cv.` instead of quotes, curly
iOS quotes, SHOUTING CSV exports. And most sites italicize the whole name, although
only the genus and epithets should be - never the cultivar, the rank or the author.

The heavyweight parsers ([gnparser](https://github.com/gnames/gnparser),
[GBIF's name-parser](https://github.com/gbif/name-parser)) are Go and Java, and the
Node binding needs a native binary. This is a small, dependency-free library that
also runs in the browser, focused on getting names clean and displayed correctly.

## Install

```bash
npm install @plantgeekz_com/botanical-name
```

Ships ES modules and CommonJS with TypeScript types. Node 18 or newer, or any modern
browser.

## Usage

### Parse

`parse()` returns a plain, JSON-serialisable object, or `null` when the input does
not look like a plant name.

```ts
const name = parse('Pinus mugo Turra subsp. uncinata (DC.) Domin');

name.genus;                         // "Pinus"
name.epithet;                       // "mugo"
name.authorship;                    // "Turra"
name.infraspecific[0].rank;         // "subsp."
name.infraspecific[0].epithet;      // "uncinata"
name.infraspecific[0].authorship;   // "(DC.) Domin"
```

| Field | Example input | Value |
|---|---|---|
| `genus` | `Hosta 'Blue Angel'` | `"Hosta"` |
| `genusHybrid` | `× Chitalpa tashkentensis` | `true` |
| `graftChimaera` | `+ Crataegomespilus dardarii` | `true` |
| `epithet` | `Passiflora edulis Sims` | `"edulis"` |
| `speciesHybrid` | `Mentha x piperita` | `true` |
| `authorship` | `Picea abies (L.) H.Karst.` | `"(L.) H.Karst."` |
| `infraspecific` | `Rosa canina var. dumalis Baker` | `[{ rank: "var.", epithet: "dumalis", authorship: "Baker" }]` |
| `group` | `Brassica oleracea (Capitata Group)` | `"Capitata"` |
| `tradeName` | `Rosa Flower Carpet® 'Noare'` | `"Flower Carpet"` |
| `cultivar` | `Hemerocallis 'Buddha's Temple'` | `"Buddha's Temple"` |
| `formula` | `Salix alba × S. fragilis` | two parsed names |
| `warnings` | `Rosa canina ssp. canina` | `["rank_normalized"]` |

### Normalize

```ts
normalize('PASSIFLORA EDULIS f. flavicarpa O.Deg.');
// "Passiflora edulis f. flavicarpa O.Deg."
```

`normalize()` keeps the authors; `format()` leaves them out unless you ask.

### Format

```ts
const name = parse("Magnolia grandiflora L. 'Little Gem'");

format(name);                          // Magnolia grandiflora 'Little Gem'
format(name, { authors: true });       // Magnolia grandiflora L. 'Little Gem'
format(name, { typographic: true });   // Magnolia grandiflora ‘Little Gem’
toHtml(name);                          // <i>Magnolia grandiflora</i> &#039;Little Gem&#039;
toHtml(name, { authors: true, tag: 'em' });
```

HTML output follows the naming codes: genus, species and infraspecific epithets in
italics; rank markers (`subsp.`, `var.`, `f.`), authors, hybrid signs, groups and
cultivars in roman. Trade designations are wrapped in
`<span class="trade-designation">` so you can set them apart, as the ICNCP
recommends. All text is HTML-escaped, so the output is safe for `innerHTML`.

### Match and de-duplicate

`key()` gives a comparison key without authors, quotes, hybrid signs or diacritics,
so different spellings of the same name meet:

```ts
key(parse('Hydrangea x macrophylla'));  // hydrangea macrophylla
key(parse('HYDRANGEA ×MACROPHYLLA'));   // hydrangea macrophylla
```

### Warnings

Everything the parser changed is reported in `name.warnings` (sorted, unique):

| Code | Meaning |
|---|---|
| `abbreviated_genus` | The genus is abbreviated, like `S.` in a hybrid formula |
| `case_normalized` | Upper- or lowercase input was recased |
| `cultivar_marker_normalized` | `cv. Name` became `'Name'` |
| `group_inferred` | `(Capitata) 'Brunswick'` read as a cultivar group |
| `hybrid_marker_normalized` | `x` became `×` |
| `quotes_normalized` | Curly, double or backtick quotes became straight ones |
| `rank_missing` | A trinomial without a rank marker, like `Rosa canina dumalis` |
| `rank_normalized` | A rank marker was rewritten, like `ssp.` → `subsp.` |
| `species_unspecified` | `sp.` or `spp.` was dropped |
| `stray_characters_removed` | Leftovers such as an unmatched quote were dropped |

## Scope

This is a structural parser: it reads the shape of a name and never looks it up, so it
tells you what the parts are, not whether the name is accepted or even exists. For
that you need a taxonomic backbone such as GBIF, Catalogue of Life or
[PlantGeekz](https://plantgeekz.com).

Not covered: zoological and bacterial names, validation of author abbreviations, and
names with several quoted cultivars that are not a hybrid formula. A lone
parenthesised name like `(Lehnert)` is read as an author, not a group, because that is
what it usually is in real data.

## Tests

```bash
npm test
npm run check-fixtures   # fixtures must match the PHP package
```

The fixtures in [`fixtures/names.json`](fixtures/names.json) are owned by the PHP
package and copied here with `npm run sync-fixtures`. Before release both
implementations were run over 30,569 real names from the PlantGeekz taxonomy (species
with authors and cultivars): identical output, and every clean name came back
unchanged.

## Citing

If you use botanical-name in research, please cite it via its DOI:
[10.5281/zenodo.22765112](https://doi.org/10.5281/zenodo.22765112) (all versions). GitHub's "Cite this repository"
button gives the citation in APA and BibTeX.

## License

MIT © [PlantGeekz](https://plantgeekz.com)
