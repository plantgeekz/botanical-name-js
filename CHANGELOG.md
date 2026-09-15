# Changelog

## 0.1.0 - unreleased

First release.

- Parse genus, nothogenus (×), graft-chimaera (+), species and nothospecies,
  authors, infraspecific ranks, cultivar groups, trade designations, cultivars
  and hybrid formulas.
- Normalize `x` → `×`, `ssp.` → `subsp.`, `cv. Name` → `'Name'`, curly and
  double quotes, whitespace and letter case.
- Format as text, HTML with botanical italics, URL slug and comparison key.
- Shared fixtures with the PHP/JavaScript sister package; verified on 30,569 real
  names from the PlantGeekz taxonomy.
