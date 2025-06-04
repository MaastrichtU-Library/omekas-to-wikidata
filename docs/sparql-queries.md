# Queries

## Examples

### Goenames value to wikidata item
This helps you get the Wikidata item that uses a specific GeoNames ID. This is very relevant for reconciliation
```sparql 
# Fastest possible lookup of a single GeoNames ID
SELECT ?item ?itemLabel WHERE {
  ?item wdt:P1566 "2759794" .   # ← constant in index-friendly position
}
LIMIT 1
```