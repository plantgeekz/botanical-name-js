/** One infraspecific part of a name, e.g. "subsp. uncinata (DC.) Domin". */
export interface Infraspecific {
  /** Normalized rank marker ("subsp.", "var.", "f." …), or null when the input left it out. */
  readonly rank: string | null;
  readonly epithet: string;
  readonly authorship: string | null;
}

/**
 * Codes for everything the parser normalized. Always sorted and unique.
 */
export type WarningCode =
  | 'abbreviated_genus'
  | 'case_normalized'
  | 'cultivar_marker_normalized'
  | 'group_inferred'
  | 'hybrid_marker_normalized'
  | 'quotes_normalized'
  | 'rank_missing'
  | 'rank_normalized'
  | 'species_unspecified'
  | 'stray_characters_removed';

/**
 * A botanical name split into its parts. Same shape as ParsedName::toArray()
 * in the PHP package (plantgeekz/botanical-name).
 */
export interface ParsedName {
  readonly verbatim: string;
  readonly genus: string | null;
  /** Nothogenus: ×Chitalpa. */
  readonly genusHybrid: boolean;
  /** Graft-chimaera: +Crataegomespilus. */
  readonly graftChimaera: boolean;
  readonly epithet: string | null;
  /** Nothospecies: Mentha ×piperita. */
  readonly speciesHybrid: boolean;
  readonly authorship: string | null;
  readonly infraspecific: readonly Infraspecific[];
  /** Cultivar group without the word "Group": "Capitata". */
  readonly group: string | null;
  /** Trade designation, e.g. "Flower Carpet" from "Flower Carpet®". */
  readonly tradeName: string | null;
  /** Cultivar epithet without quotes: "Blue Angel". */
  readonly cultivar: string | null;
  /** Parents of a hybrid formula ("A × B"), otherwise null. */
  readonly formula: readonly ParsedName[] | null;
  readonly warnings: readonly WarningCode[];
}

export interface FormatOptions {
  /** Include author citations. Default false. */
  authors?: boolean;
  /** Use ‘curly’ cultivar quotes instead of straight ones. Default false. */
  typographic?: boolean;
}

export interface HtmlOptions extends FormatOptions {
  /** Element used for italics. Default "i". */
  tag?: 'i' | 'em';
}
