# Requirements and features 
## 1. User Interface (UI) Requirements
- **#3** Basisweergave linked-open-data met knop "Toon ruwe JSON"  
- **#4** Helder stappen-overzicht (Input, Mapping, Reconciliation, Designer, Export) als checkout-achtige header, klikbaar  
- **#9** Stap 2 – Mapping-scherm met drie collapsibles: Non-linked, Mapped, Ignored keys  
- **#16** Reconciliation-tabel (rows = items, cols = properties, cells = values) à la OpenRefine, maar gebruiker ziet in eerste instantie niet de volledige tabel (stapsgewijze benadering)  
- **#18** Uitgebreide JSON-viewer met uitklapbare secties en klikbare links (toekomstige verbetering)  
- **#29** Wikidata Item Designer toont items in "Wikidata-preview" stijl; keuze om voorbeeld-item te wisselen  
- **#31** Stap 5 – Export: tekstblok met QuickStatements + "Copy" knop + mini-gids + link officiele docs + eventueel demo-video  
- **#35** Uitgebreid info-modal met markdown-content (titel, afbeeldingen, links, voorbeelden), eveneens git-gestuurd  
- **#39** Homepage met vijf-stappen uitleg, keyboard-handleiding en "je moet zelf saven" disclaimer  
- **#44** UI-indicator dat niet-LO'D keys verborgen zijn, met toggle om ze toch te tonen  
- **#46** Richer JSON viewer (uitvouwbare boom, syntax-highlight) als optionele extra buiten MVP  
- **#47** Universal info-modal trigger (bijv. "?"-toets) om snel hulpartikelen op te zoeken  
- **#48** Mapping-modal toont voorbeeldwaardes direct bij openen (sample values voor die JSON-key)  
- **#49** Modal toont Wikidata property search met label én description + link naar Wikidata  
- **#54** Design van cell-modals met enkel de actieve property uitgeklapt (de rest collapsed met samenvatting)  
- **#58** Als voorbeelditem in Wikidata Designer gewijzigd wordt, moet dit de live preview vernieuwen  
- **#63** Modale interface consistent hergebruikt in alle 3 hoofdfasen: Mapping, Reconciliation, Designer  

## 2. User Experience (UX) Requirements
- **#5** Gedetailleerde voortgangsindicatoren per stap (versie 3 functionaliteit)  
- **#7** Geen automatische opslag in browser; waarschuwing op homepage over dataverlies bij refresh  
- **#8** Visuele waarschuwing voor niet-opgeslagen wijzigingen (save-knop verandert van kleur)  
- **#14** Na bevestigen springt modal automatisch naar volgende unmapped key  
- **#30** Positieve visuele feedback (success animatie) na voltooiing van microtask  
- **#32** Keyboard-navigatie (pijltjes, Tab, Enter, Esc) over componenten & modals  
- **#33** Letter-sneltoetsen voor modal-acties (C=confirm, S=skip, I=ignore – voorbeeld)  
- **#45** Animate/hint bij "unsaved changes" wanneer gebruiker modals sluit zonder export  
- **#62** Modal-stapjes hebben eventueel animatie of focus-indicator om huidige taak visueel te benadrukken  
- **#75** De mogelijkheid om per stap of actie contextuele uitleg of instructie te tonen (bijv. "Wat betekent mapping?", "Wat is reconciliation?")  
- **#79** Toon duidelijke uitleg bij input-stap met hints, tooltips, en progress bar  

## 3. Functional Requirements
- **#6** Persistente mirror van workflow-object in geheugen; gebruiker moet handmatig downloaden (saveJSON) en weer inladen - continue synchronisatie tussen interface en JSON-object  
- **#17** Modal voor het toevoegen van reconciliations per rij en per cel  
- **#25** Velden wisselen dynamisch tussen Q-select, vrije tekst, nummer, datum afhankelijk van property-type; indien niet gespecificeerd kan gebruiker kiezen via dropdown of knoppen, met slechts één invoerveld zichtbaar  
- **#27** Bronnen verplicht/aanbevolen via Entity Schema; gebruiker voegt 1+ referenties toe tijdens de Wikidata Designer-fase (niet tijdens reconciliation)  
- **#41** Handling van multiple-value properties (bijv. meerdere acteurs) zichtbaar & bewerkbaar  
- **#51** Mogelijkheid om "Keep for later" status toe te wijzen aan properties in reconciliation (tijdelijk overslaan)  
- **#53** Bij matching van string/numeric fields geen reconciliation, maar wel validatie volgens Wikidata restricties  
- **#56** Meerdere bronnen kunnen worden gedefinieerd aan begin van designer-stap en daarna hergebruikt per triple  
- **#64** Entiteit-schema vereist mogelijk aanwezigheid van qualifiers, die pas relevant worden in Designer-stap (dus pre-validate & markeren)  
- **#65** Entity Schema ondersteunt niet alleen wat moet, maar ook wat aanbevolen is (bijv. "bron sterk aanbevolen") → moet visueel onderscheid maken  
- **#68** Alle values moeten ook via het EntitySchema gevalideerd worden — het schema is leidend voor: Of een veld verplicht is (zoals bronvermelding), Wat voor type value nodig is (bijv. QID, string, etc.) Of qualifiers nodig zijn  
- **#69** Bij meerdere waarden voor een property (bijv. meerdere auteurs): Moet het systeem dit correct tonen (als lijst). Moet het reconciliatieproces werken per waarde, niet per key  
- **#74** Mogelijkheid om meerdere bronnen tegelijk te koppelen aan een statement  
- **#77** Items worden opgebouwd uit triples  

## 4. Technical Architecture Requirements
- **#1** API-endpoint instelbaar met paginering (basis functionaliteit)  
- **#2** Advanced API parameters toevoegen (uitbreiding voor later)  
- **#6** Persistente mirror van workflow-object in geheugen; gebruiker moet handmatig downloaden (saveJSON) en weer inladen - continue synchronisatie tussen interface en JSON-object  
- **#42** Ticket/onderzoek: resource template ↔️ entity schema alignment automatiseren  

## 5. Data Management Requirements
- **#10** Ignored keys auto-detecteren (custom velden zonder LOD-link)  
- **#26** Ondersteuning voor qualifiers (language tags, units, datum-kalender & accuracy, etc.) volgens property-eisen  
- **#53** Bij matching van string/numeric fields geen reconciliation, maar wel validatie volgens Wikidata restricties  
- **#69** Bij meerdere waarden voor een property (bijv. meerdere auteurs): Moet het systeem dit correct tonen (als lijst). Moet het reconciliatieproces werken per waarde, niet per key  
- **#76** Bij suggesties gebaseerd op collectie (SPARQL), moeten properties exclusief uit main statements komen (P-rank), geen qualifiers of references  

## 6. Documentation Requirements
- **#34** Tooltip-systeem: 1-lijn tips voor vrijwel elk veld, content geladen uit GitHub JSON  
- **#35** Uitgebreid info-modal met markdown-content (titel, afbeeldingen, links, voorbeelden), eveneens git-gestuurd  
- **#36** Zoekfunctie binnen alle info-modals  
- **#38** README-vereisten: uitleg config-files, project-intro, gebruikers-gids, keyboard-gids, link Wikimedia project-page, uitleg account-rechten voor QuickStatements**  
- **#57** Uitleg van keyboard-navigatie moet ook als markdown-info beschikbaar zijn in info-modal  
- **#59** Uitleg over entiteit-schema's, bronverplichting en goede modellen moet ook als info-modal beschikbaar zijn  
- **#73** README moet ook een uitleg geven over hoe gebruikers bulk-edit rechten krijgen op Wikidata (voor QuickStatements gebruik)  
- **#78** Gebruik Markdown-file op GitHub om homepage te vullen  

## 7. Integration Requirements
- **#11** Automatische suggestie van mappings tussen Wikidata Entity Schema en linked-open-data schema  
- **#22** Reconciliation API voor Q-matches (bij velden die QID vereisen); gebruik alle linked data details voor betere matches; scores tonen; hoogste score als default suggestie  
- **#23** Zoekdialoog voor manuele Q-zoekopdrachten (label + description + link)  
- **#24** Knop "Maak Wikidata-item" voor nieuwe Q wanneer geen match  
- **#31** Stap 5 – Export: tekstblok met QuickStatements + "Copy" knop + mini-gids + link officiele docs + eventueel demo-video  
- **#40** Query-feature: collectie-QID → sparql-query voor meest gebruikte properties binnen collectie; ranking tonen als suggesties  
- **#49** Modal toont Wikidata property search met label én description + link naar Wikidata  
- **#71** Bij properties waar geen QID match is gevonden moet "Maak nieuw Wikidata-item" knop een link zijn naar de nieuwe item-pagina op Wikidata, niet een eigen modal  

## 8. Workflow Requirements
- **#4** Helder stappen-overzicht (Input, Mapping, Reconciliation, Designer, Export) als checkout-achtige header, klikbaar  
- **#14** Na bevestigen springt modal automatisch naar volgende unmapped key  
- **#55** Nieuw item flow in designer: eerst referenties selecteren/definiëren, pas daarna triples maken  
- **#60** Fallback JSON (bijv. default state) mogelijk als voorbeeld/demo-data inladen bij leeg project  
- **#61** Tool toont waarschuwing bij verlaten pagina zonder export/saveJSON (optional enhancement)  
- **#67** Tijdens Mapping: properties die al gelinkt zijn (bijv. via eerder werk of suggesties) moeten heropend kunnen worden om te wijzigen of te verwijderen  
- **#75** De mogelijkheid om per stap of actie contextuele uitleg of instructie te tonen (bijv. "Wat betekent mapping?", "Wat is reconciliation?")  

## 9. Configuration Requirements
- **#37** Config-files op GitHub: Tooltips-content JSON, Placeholders / extra info JSON, Default-behavior settings (bijv. hide custom keys), Known URL→property mapping-lists  
- **#66** Tooltip JSON en Info-JSON moeten versiebaar zijn en verwijsbaar per veld-id / context  
- **#72** Placeholders en default texts voor velden (bijv. labels, toelichtingen) moeten configureerbaar zijn via GitHub-JSON  

## 10. Automation and Intelligence Requirements
- **#10** Ignored keys auto-detecteren (custom velden zonder LOD-link)  
- **#28** Herbruik suggesties: eerder gekozen Q's, qualifiers, taalcodes, units → top-suggestie in dropdowns  
- **#50** Modal ondersteunt autosuggestie op basis van eerder gemapte properties in dit project  
- **#52** Suggesties binnen dezelfde property voortbouwen op eerdere ingevulde waardes (bijv. taal, units, bronnen, QIDs)  
- **#70** Matching van properties tussen EntitySchema en het "resource template" (van brondata) moet geautomatiseerd onderzocht worden  