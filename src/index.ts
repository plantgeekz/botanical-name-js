/**
 * Parse, normalize and format botanical plant names.
 *
 *     import { parse, format, toHtml } from '@plantgeekz_com/botanical-name';
 *
 *     const name = parse('Hydrangea x macrophylla ssp. serrata cv. Bluebird');
 *     format(name);  // Hydrangea ×macrophylla subsp. serrata 'Bluebird'
 *     toHtml(name);  // <i>Hydrangea</i> ×<i>macrophylla</i> subsp. <i>serrata</i> &#039;Bluebird&#039;
 *
 * Made by PlantGeekz - https://plantgeekz.com
 */
import { format } from './formatter.js';
import { Parser } from './parser.js';
import type { ParsedName } from './types.js';

export { format, key, slug, toHtml } from './formatter.js';
export type { FormatOptions, HtmlOptions, Infraspecific, ParsedName, WarningCode } from './types.js';

/** Splits a name into its parts, or returns null when it does not look like a plant name. */
export function parse(input: string): ParsedName | null {
  return new Parser().parse(input);
}

/**
 * Cleans up a name and keeps its authors:
 * "passiflora edulis f. flavicarpa" → "Passiflora edulis f. flavicarpa".
 */
export function normalize(input: string): string | null {
  const name = parse(input);
  return name === null ? null : format(name, { authors: true });
}
