1. API-endpoint instelbaar met paginering (basis functionaliteit) #Input #API #Settings #StepInput #UX #MVP
2. Advanced API parameters toevoegen (uitbreiding voor later) #Input #API #Settings #StepInput #UX
3. Basisweergave linked-open-data met knop "Toon ruwe JSON" #UI #Functionality #JSONViewer #StepInput #MVP
4. Helder stappen-overzicht (Input, Mapping, Reconciliation, Designer, Export) als checkout-achtige header, klikbaar #UI #Navigation #UX #AllSteps #Global #MVP
5. Gedetailleerde voortgangsindicatoren per stap (versie 3 functionaliteit) #UI #ProgressBar #Navigation #UX #AllSteps #Global
6. Persistente mirror van workflow-object in geheugen; gebruiker moet handmatig downloaden (saveJSON) en weer inladen - continue synchronisatie tussen interface en JSON-object #State #Functionality #Settings #UX #Global #MVP #Continue
7. Geen automatische opslag in browser; waarschuwing op homepage over dataverlies bij refresh #UX #Warning #Homepage #State #Privacy #StepInput #MVP
8. Visuele waarschuwing voor niet-opgeslagen wijzigingen (save-knop verandert van kleur) #UX #Warning #State #UI #Global
9. Stap 2 – Mapping-scherm met drie collapsibles: Non-linked, Mapped, Ignored keys #UI #StepMapping #Collapsible #Functionality #MVP
10. Ignored keys auto-detecteren (custom velden zonder LOD-link) #Automation #Functionality #StepMapping #DataParsing #MVP
11. Automatische suggestie van mappings tussen Wikidata Entity Schema en linked-open-data schema #Automation #Mapping #EntitySchema #StepMapping
12. Klik op key opent modal ("microtask") met autosuggesties (schema.org → sameAs, Entity Schema, full-text property search) #Modal #Autosuggest #UX #EntitySchema #StepMapping #MVP
13. Modal-knoppen: Confirm, Skip, Ignore (+ sneltoets-letters) #Modal #Keyboard #UI #Global #MVP
14. Na bevestigen springt modal automatisch naar volgende unmapped key #UX #Microtask #StepMapping #MVP
15. Klein tekstveld met naam van geselecteerde Entity Schema (klikbaar als link) met potloodicoon voor wijzigen (dropdown of custom URL) #UI #EntitySchema #StepMapping #MVP
16. Reconciliation-tabel (rows = items, cols = properties, cells = values) à la OpenRefine, maar gebruiker ziet in eerste instantie niet de volledige tabel (stapsgewijze benadering) #UI #Reconciliation #Functionality #StepReconciliation #MVP #Informatie
17. Modal voor het toevoegen van reconciliations per rij en per cel #Modal #UX #StepReconciliation #MVP
18. Uitgebreide JSON-viewer met uitklapbare secties en klikbare links (toekomstige verbetering) #UI #Functionality #JSONViewer #StepInput
19. Modal herkent automatisch het type veld (QID, string, enz.) op basis van Property restricties en Entity Schema #Modal #Validation #PropertyRestriction #StepReconciliation #MVP
20. Validatie op basis van Wikidata Property restrictions #Validation #PropertyRestriction #StepReconciliation #StepDesigner #MVP
21. Validatie op basis van Entity Schema requirements #Validation #EntitySchema #StepReconciliation #StepDesigner #MVP
22. Reconciliation API voor Q-matches (bij velden die QID vereisen); gebruik alle linked data details voor betere matches; scores tonen; hoogste score als default suggestie #API #Reconciliation #UX #StepReconciliation #MVP
23. Zoekdialoog voor manuele Q-zoekopdrachten (label + description + link) #UI #Search #StepReconciliation #MVP
24. Knop "Maak Wikidata-item" voor nieuwe Q wanneer geen match #Functionality #StepReconciliation #StepMapping #MVP
25. Velden wisselen dynamisch tussen Q-select, vrije tekst, nummer, datum afhankelijk van property-type; indien niet gespecificeerd kan gebruiker kiezen via dropdown of knoppen, met slechts één invoerveld zichtbaar #DynamicForm #Validation #PropertyRestriction #UX #StepReconciliation #MVP
26. Ondersteuning voor qualifiers (language tags, units, datum-kalender & accuracy, etc.) volgens property-eisen #Qualifiers #Validation #StepDesigner #StepReconciliation
27. Bronnen verplicht/aanbevolen via Entity Schema; gebruiker voegt 1+ referenties toe tijdens de Wikidata Designer-fase (niet tijdens reconciliation) #Sources #EntitySchema #StepDesigner #BestPractice
28. Herbruik suggesties: eerder gekozen Q's, qualifiers, taalcodes, units → top-suggestie in dropdowns #Autosuggest #UX #Efficiency #Global
29. Wikidata Item Designer toont items in "Wikidata-preview" stijl; keuze om voorbeeld-item te wisselen #UI #StepDesigner #Preview #MVP
30. Positieve visuele feedback (success animatie) na voltooiing van microtask #UX #Gamification #Global
31. Stap 5 – Export: tekstblok met QuickStatements + "Copy" knop + mini-gids + link officiele docs + eventueel demo-video #StepExport #QuickStatements #Documentation #UI #MVP
32. Keyboard-navigatie (pijltjes, Tab, Enter, Esc) over componenten & modals #Keyboard #Accessibility #UX #Global
33. Letter-sneltoetsen voor modal-acties (C=confirm, S=skip, I=ignore – voorbeeld) #Keyboard #UI #Global
34. Tooltip-systeem: 1-lijn tips voor vrijwel elk veld, content geladen uit GitHub JSON #Tooltip #GitHubFile #Documentation #UI #Global
35. Uitgebreid info-modal met markdown-content (titel, afbeeldingen, links, voorbeelden), eveneens git-gestuurd #Modal #Info #GitHubFile #Documentation #UX #Global
36. Zoekfunctie binnen alle info-modals #Search #Info #NiceToHave #Global
37. Config-files op GitHub: Tooltips-content JSON, Placeholders / extra info JSON, Default-behavior settings (bijv. hide custom keys), Known URL→property mapping-lists #GitHubFile #Settings #Documentation #Automation #Global
38. README-vereisten: uitleg config-files, project-intro, gebruikers-gids, keyboard-gids, link Wikimedia project-page, uitleg account-rechten voor QuickStatements** #README #Documentation #GitHubFile #Global #MVP
39. Homepage met vijf-stappen uitleg, keyboard-handleiding en "je moet zelf saven" disclaimer #Homepage #UI #UX #Documentation #Global #MVP
40. Query-feature: collectie-QID → sparql-query voor meest gebruikte properties binnen collectie; ranking tonen als suggesties #CollectionSuggestion #SPARQL #API #StepMapping #NiceToHave
41. Handling van multiple-value properties (bijv. meerdere acteurs) zichtbaar & bewerkbaar #Functionality #Validation #StepReconciliation #DataParsing #MVP
42. Ticket/onderzoek: resource template ↔️ entity schema alignment automatiseren #Research #Alignment #EntitySchema #Template #OutOfScopeNow #Global
43. Opslaan en delen van bekende mappings (open-source URL ↔︎ Wikidata property) in openbare git-file voor community-reuse #Community #GitHubFile #Mapping #NiceToHave #Global
44. UI-indicator dat niet-LO'D keys verborgen zijn, met toggle om ze toch te tonen #UI #Settings #StepInput
45. Animate/hint bij "unsaved changes" wanneer gebruiker modals sluit zonder export #UX #Warning #NiceToHave #Global
46. Richer JSON viewer (uitvouwbare boom, syntax-highlight) als optionele extra buiten MVP #UI #JSONViewer #NiceToHave #StepInput
47. Universal info-modal trigger (bijv. "?"-toets) om snel hulpartikelen op te zoeken #UI #Keyboard #Info #NiceToHave #Global
48. Mapping-modal toont voorbeeldwaardes direct bij openen (sample values voor die JSON-key) #Modal #StepMapping #UX #DataPreview #MVP
49. Modal toont Wikidata property search met label én description + link naar Wikidata #Modal #StepMapping #Search #UI #UX #WikidataAPI #MVP
50. Modal ondersteunt autosuggestie op basis van eerder gemapte properties in dit project #Autosuggest #UX #StepMapping
51. Mogelijkheid om "Keep for later" status toe te wijzen aan properties in reconciliation (tijdelijk overslaan) #UX #StepReconciliation #WorkflowControl #Microtask
52. Suggesties binnen dezelfde property voortbouwen op eerdere ingevulde waardes (bijv. taal, units, bronnen, QIDs) #Autosuggest #UX #ContextAware #Reusability #StepDesigner
53. Bij matching van string/numeric fields geen reconciliation, maar wel validatie volgens Wikidata restricties #Validation #StepReconciliation #PropertyRestriction #UX
54. Design van cell-modals met enkel de actieve property uitgeklapt (de rest collapsed met samenvatting) #UI #Modal #Microtask #StepReconciliation
55. Nieuw item flow in designer: eerst referenties selecteren/definiëren, pas daarna triples maken #StepDesigner #UX #Sources #WorkflowOrder
56. Meerdere bronnen kunnen worden gedefinieerd aan begin van designer-stap en daarna hergebruikt per triple #StepDesigner #Sources #UI #Reusability
57. Uitleg van keyboard-navigatie moet ook als markdown-info beschikbaar zijn in info-modal #Keyboard #Info #Documentation #GitHubFile #Global
58. Als voorbeelditem in Wikidata Designer gewijzigd wordt, moet dit de live preview vernieuwen #StepDesigner #UI #Preview #LiveUpdate
59. Uitleg over entiteit-schema's, bronverplichting en goede modellen moet ook als info-modal beschikbaar zijn #Documentation #Info #EntitySchema #Tooltip #MarkdownInfo #Global
60. Fallback JSON (bijv. default state) mogelijk als voorbeeld/demo-data inladen bij leeg project #Demo #UX #StepInput #OptionalFeature
61. Tool toont waarschuwing bij verlaten pagina zonder export/saveJSON (optional enhancement) #UX #Warning #State #NiceToHave #Global
62. Modal-stapjes hebben eventueel animatie of focus-indicator om huidige taak visueel te benadrukken #UX #UI #Microtask #Focus #Global
63. Modale interface consistent hergebruikt in alle 3 hoofdfasen: Mapping, Reconciliation, Designer #UI #Modal #DesignSystem #Reusability #Global
64. Entiteit-schema vereist mogelijk aanwezigheid van qualifiers, die pas relevant worden in Designer-stap (dus pre-validate & markeren) #EntitySchema #StepDesigner #Validation #UX
65. Entity Schema ondersteunt niet alleen wat moet, maar ook wat aanbevolen is (bijv. "bron sterk aanbevolen") → moet visueel onderscheid maken #EntitySchema #UX #Validation #StepDesigner
66. Tooltip JSON en Info-JSON moeten versiebaar zijn en verwijsbaar per veld-id / context #GitHubFile #Tooltip #Versioning #ContextualHelp #Global
67. Tijdens Mapping: properties die al gelinkt zijn (bijv. via eerder werk of suggesties) moeten heropend kunnen worden om te wijzigen of te verwijderen #UX #Modal #StepMapping #EditExisting
68. Alle values moeten ook via het EntitySchema gevalideerd worden — het schema is leidend voor: Of een veld verplicht is (zoals bronvermelding), Wat voor type value nodig is (bijv. QID, string, etc.) Of qualifiers nodig zijn #Validation #EntitySchema #StepDesigner #StepReconciliation
69. Bij meerdere waarden voor een property (bijv. meerdere auteurs): Moet het systeem dit correct tonen (als lijst). Moet het reconciliatieproces werken per waarde, niet per key #StepReconciliation #MultiValue #UX #ModalLogic
70. Matching van properties tussen EntitySchema en het "resource template" (van brondata) moet geautomatiseerd onderzocht worden #Research #SchemaAlignment #Automation #EntitySchema #Global
71. Bij properties waar geen QID match is gevonden moet "Maak nieuw Wikidata-item" knop een link zijn naar de nieuwe item-pagina op Wikidata, niet een eigen modal #UX #ExternalLink #WikidataIntegration #StepMapping #StepReconciliation
72. Placeholders en default texts voor velden (bijv. labels, toelichtingen) moeten configureerbaar zijn via GitHub-JSON #GitHubFile #Placeholders #UI #ConfigurableText #Global
73. README moet ook een uitleg geven over hoe gebruikers bulk-edit rechten krijgen op Wikidata (voor QuickStatements gebruik) #README #QuickStatements #WikidataPolicy #Documentation #StepExport
74. Mogelijkheid om meerdere bronnen tegelijk te koppelen aan een statement #StepDesigner #Sources #MultiSource #UI #UX
75. De mogelijkheid om per stap of actie contextuele uitleg of instructie te tonen (bijv. "Wat betekent mapping?", "Wat is reconciliation?") #UX #Help #ContextualGuidance #InfoModal #Global
76. Bij suggesties gebaseerd op collectie (SPARQL), moeten properties exclusief uit main statements komen (P-rank), geen qualifiers of references #SPARQL #Filtering #CollectionSuggestion #DataQualityView #StepMapping
77. Items worden opgebouwd uit triples #StepDesigner #Functionality #Wikidata #MVP
78. Gebruik Markdown-file op GitHub om homepage te vullen #Homepage #Documentation #GitHubFile #Global #MVP
79. Toon duidelijke uitleg bij input-stap met hints, tooltips, en progress bar #UX #UI #StepInput #MVP