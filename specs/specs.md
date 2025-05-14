# Wikidata Mapping Tool - Comprehensive Functional Specification

## 1. Algemene Overzicht

Deze front-end only webgebaseerde tool helpt gebruikers om data vanuit een externe API in JSON-formaat te mappen naar Wikidata-properties, met ondersteuning voor entity schemas, reconciliation van waarden, bronvermelding, en export naar QuickStatements. De tool werkt in de browser zonder backend, met alle data opgeslagen in-memory als JavaScript-object, en begeleidt gebruikers stapsgewijs door het proces.

## 2. Globale Architectuur

* **Front-end only** (geen backend).
* **Volledig in-memory** opslag van gebruikersinput, beschikbaar als downloadbare JSON.
* **Statische configuratie en content via GitHub-hosted JSON-files** voor tooltips, placeholder teksten, extra uitleg, en standaardconfiguratie.
* **UI met vijf stappen** zichtbaar als navigatie bovenaan, vergelijkbaar met een webwinkel-checkout.
* **Microtask-benadering** via modals per JSON-key, property, of waarde.
* **Sterk keyboard-gestuurd** met sneltoetsen en visuele focus.
* **Progress bar** voor de 5 stappen bovenaan zichtbaar.

## 3. Functionaliteit per Stap

## 🧩 Stap 1: Input (#Stap1 #Functionaliteit #Gebruikerservaring #UI)

* Gebruiker voert een API URL in.
* Ondersteuning voor standaard en geavanceerde parameters.
* Geavanceerde parameters optioneel in- of uitklapbaar.
* JSON-LD viewer met toggle voor raw JSON (#UI).
* Placeholder texts en uitleg met tooltips en markdown-modals.
* Mogelijkheid tot preview van hoe de JSON is opgebouwd (#UI).
* Mogelijkheid om een voorbeeld-object te selecteren voor verdere stappen (#Functionaliteit).
* Configuratie voor verstopt houden van bepaalde keys (#Settings).
* Tool toont JSON als een hiërarchische boomstructuur.
* Detectie en filtering van custom keys (irrelevant voor LOD). Deze worden standaard genegeerd.

## 🧩 Stap 2: Mapping (#Stap2 #Modal #Functionaliteit #Gebruikerservaring #UI)

* Interface toont drie collapsible secties:
  * **Non-linked keys**: Nog niet gemapt.
  * **Mapped keys**: Reeds gemapt.
  * **Ignored keys**: Custom keys buiten het LOD-domein.
* Mapping van keys gebeurt in een **modal** (microtask-stijl):
  * Autosuggest op basis van eerder gemapte keys en Wikidata.
  * Zoekfunctionaliteit met label, description, en link (#API).
  * Voorbeelden van waarden worden getoond.
  * Drie knoppen onderaan: `Skip`, `Confirm`, `Ignore` (#UI).
  * Optioneel automatisch doorgaan naar volgende unmapped key.
  * Suggesties gebaseerd op eerdere mappings en GitHub-configuraties (#GithubFile).
  * Live search naar Wikidata properties (met label, description, QID).
  * EntitySchema wordt gebruikt als validatiebron.
* Suggesties op basis van:
  * Reeds gemapte data
  * Bekende mappings van GitHub
  * Properties gebruikt in een opgegeven Wikidata collectie (frequentie-gebaseerd)
* Tooltip en uitlegvelden beschikbaar bij elke interactie.

## 🧩 Stap 3: Reconciliation (#Stap3 #Functionaliteit #Modal #Gebruikerservaring)

* Interface zoals OpenRefine: kolommen = properties, rijen = items, cellen = values.
* Microtask-gebaseerd:
  * Per rij (item) verwerken.
  * Alternatief: kolom-gebaseerde verwerking (nice-to-have).
* Per cel:
  * Automatische suggestie via Reconciliation API (#API).
  * Suggestie toont score en relevante info.
  * Mogelijkheid tot handmatige search met label/description (#UI).
  * Validatie van waarde gebeurt op basis van property requirements (#Wikidata #API).
  * Als het een string is: check op taal-tag requirement.
  * Voor nummers: suggestie van units + qualifiers (#Functionaliteit).
  * Voor data: kalender en precisie (#Wikidata).
  * Knop "Maak Wikidata-item" als QID niet bestaat (#Functionaliteit).
  * Mogelijkheid om waarde als "bewaren voor later" te markeren.
  * Entity schema bepaalt prioriteit van vereisten (bron, qualifier, etc.) (#EntitySchema).
* **Cell-type bepaalt het gedrag**:
  * **String, date, number** → user input met validatie.
  * **QID** → suggesties via Reconciliation API + zoekfunctie.
* Validatie van waarde op basis van:
  * Property requirements vanuit Wikidata (#Wikidata).
  * Entity Schema (#EntitySchema).
* Visual afhankelijk van type waarde (QID, string, nummer, datum).
* Voor strings: taal-tag verplichting indien gespecificeerd.
* Voor nummers: units en qualifiers, op basis van Wikidata model (#Functionaliteit).
* Voor data: kalender (default: Gregorian) en precisie-opties (#UX).
* Knop "Maak Wikidata-item" opent nieuw tabblad voor handmatige creatie (#UI).
* Bewaren van onbekende entiteiten als 'te maken' lijst (#Functionaliteit).
* Mogelijkheid tot hergebruik van waarden uit andere rijen (#UX).
* Logging van gematchte entiteiten (#Settings #Debugging).
* **Navigatie & Functionaliteit**:
  * Eén actieve cell open, andere collapsed (wel zichtbaar).
  * Keyboardvriendelijk: pijltjes, enter, esc, sneltoetsen voor knoppen.
  * Feedback bij voltooide mapping.
  * Mogelijkheid om een item tijdelijk over te slaan (**"Keep for later"**).

## 🧩 Stap 4: Wikidata Designer (#Stap4 #UI #Functionaliteit #Wikidata #Modal)

* Gebruiker ontwerpt een volledige Wikidata-row (item):
  * Interface toont alle properties onder elkaar, collapsible behalve actieve (#UI).
  * Hergebruik van eerder ingevulde values als suggesties (#UX).
  * Suggesties voor taal-tag, kalender, unit, qualifiers op basis van andere rijen (#Functionaliteit).
  * Bronvermelding verplicht bij start (visueel enforced) (#Wikidata #UX).
  * Herbruikbare bronnenbeheer (toevoegen en selecteren).
  * Mogelijkheid om visual te tonen zoals het item eruitziet op Wikidata (#NiceToHave #UI).
  * Entity schema wordt gebruikt om vereisten af te dwingen (#EntitySchema).
  * Keuze uit voorbeeld-item voor visuele preview (#Functionaliteit).
  * Mogelijkheid tot aanpassen van qualifier-structuren per property (#NiceToHave).
  * Suggesties voor properties op basis van collectie-QID (#Suggesties).
  * Automatisch invullen van veelgebruikte qualifiers zoals "language", "unit", "precision" (#UX).
* Gehele itemweergave met collapsible triples.
* EntitySchema bepaalt:
  * Verplichte statements.
  * Bronnen.
  * Verwachte datatypes.
* Keuze dropdown voor voorbeeld-item.
* Presentatie als visuele triple editor of Wikidata-stijl UI.

## 🧩 Stap 5: Export (#Stap5 #Functionaliteit #UX #QuickStatements)

* Export naar QuickStatements formaat in tekstblok.
* Korte uitleg over wat QuickStatements is (#UX).
* TL;DR-instructie + link naar officiële docs (#Documentation).
* Kopieer-knop voor eenvoud (#UI).
* Link naar een geschikte video over gebruik (optioneel).
* Mogelijkheid tot export naar JSON-object voor opslaan/herladen (#Functionaliteit).
* Waarschuwing dat de gebruiker verantwoordelijk is voor eigen save (#Privacy).
* Handleiding voor benodigde account-status voor gebruik van bulk edits in Wikidata.

## 4. Algemene Functionaliteit

### 4.1 Keyboard navigatie (#UI #Accessibility)

* Pijltjestoetsen: navigatie tussen UI-elementen
* Enter: selecteren/activeren modal
* Tab/shift-tab: door velden navigeren
* Escape: sluit modal
* Snelle knoppen in modals met keyboard-shortcuts:
  * Letters als sneltoetsen voor knoppen (bijv. \[C]onfirm, \[S]kip, \[I]gnore)

### 4.2 Tooltips & Markdown Info (#UX #GithubFile #Tooltip #Modal)

* Elke UI-element heeft een tooltip (vanuit GitHub JSON).
* Extra info beschikbaar via mini-modal (Markdown ondersteund).
* Inhoud eenvoudig aan te passen door niet-technische bijdragers.
* Zoekfunctionaliteit door alle informatieblokken (#UI).

### 4.3 Configuratie en opslag (#Settings #GithubFile)

* Alle user input wordt live gespiegeld in een JS-object.
* Geen auto-save: gebruiker moet handmatig exporteren (#UX).
* Configuratiebestand beschrijft standaardgedrag (verstopte keys, standaard extra properties, etc.).
* Geen localStorage of browser save (#Privacy).
* Mogelijkheid tot instellen van defaults zoals hidden keys, property mappings, etc.
* **Autosave** is bewust uitgeschakeld. Gebruiker dient zelf JSON-state te exporteren (#Privacy).
* Waarschuwing op homepage dat pagina-verversing alles wist.

### 4.4 Validatie en restricties (#Wikidata #EntitySchema)

* Gebruik van Wikidata property constraints
* Gebruik van EntitySchema regels (vereiste bronnen, types)
* EntitySchema als hoofdbron voor validatie, niet alleen Wikidata properties

## 5. Suggestie- en matchinglogica (#Suggesties #Wikidata #EntitySchema #Reconciliation #Functionaliteit)

* Matching via Reconciliation API.
* Validatie via property requirements van Wikidata én entity schema.
* Suggesties uit:
  * Andere items in dezelfde collectie (frequent gebruikte properties).
  * Andere rijen in hetzelfde dataset (voor herbruikbare waarden).
  * Bekende mapping-bestanden in GitHub voor LOD-URLs (#NiceToHave).
* SPARQL-query's gebaseerd op collectie-QID (#SPARQL).
* Bij opgave van collectie-QID:
  * SPARQL-query naar properties gebruikt in collectie-items
  * Suggesties gesorteerd op gebruiksfrequentie

## 6. UX Details (#UX #Gebruikerservaring)

* Feedback bij succesvolle actie (visueel bevestigend).
* Gebruiker wordt stap-voor-stap begeleid door microtasks.
* Progress bar voor de 5 stappen bovenaan zichtbaar.
* Gebruiker kan altijd terugnavigeren via de stapnavigatie (#UI).
* Duidelijke waarschuwing op homepage dat pagina-verversing alles wist.
* Markdown-info en tooltips duidelijk zichtbaar en makkelijk vindbaar.
* Tooltip- en voorbeelddata beheer via GitHub (#GithubFile).
* Collectiegerichte navigatie/suggestie mogelijk (#Suggesties).
* Positieve visuele feedback bij acties (bijv. mapping voltooid).
* Microtask-modals voor focus en snelheid.

## 7. Bestanden op GitHub (#GithubFile)

* Tooltip content JSON
* Info-modal content JSON (Markdown ondersteund)
* Configuratiebestand voor gedragstoggles
* Bekende mappingsbestand (nice-to-have)
* Placeholder texts, voorbeeldwaardes, extra uitleg: allemaal configureerbaar via externe GitHub-bestanden
* README:
  * Configbestanden
  * Wat doet de tool
  * Links naar docs en rechten info
  * Keyboardnavigatie uitleg
  * Markdown voor homepage

## 8. README vereisten (#Documentation #GithubFile)

* Uitleg over alle config-bestanden en hun rol.
* Link naar Wikimedia projectpagina.
* Uitleg over benodigde accountrechten voor QuickStatements.
* Link naar instructiepagina over Wikidata-editrechten.
* Homepage mogelijk populeren via Markdown-bestand in GitHub.
* Keyboardgebruik handleiding (#Accessibility).
* Overzicht van tool en doel
* Uitleg 5 stappen
* Snelstart voor gebruikers
* Technische configuratiehandleiding

## 9. Uitzoekpunten / Nice-to-Haves (#Uitzoeken #TechnicalDebt #NiceToHave)

* Matching resource templates en entity schema's automatisch alignen (#EntitySchema).
* Visualisatie van triple structuur vs. Wikidata-weergave (#UI #UX).
* Mogelijkheid tot kolom-gebaseerde workflow tijdens reconciliation (#NiceToHave).
* GitHub-bestand met mappings van opensource-URLs naar Wikidata-properties gebruiken als suggestiebron (#GithubFile #NiceToHave).
* Mogelijkheid tot annoteren of previewen van het JSON-bestand vóór import (#NiceToHave).
* Ondersteuning voor multi-value per property in de input (#Functionaliteit).
* UI voor "per property" reconciliation-view
* Structurele alignering tussen entity schema en JSON structuur
* Matching-suggesties vanuit open source key-property mappings
* Suggestieherkenning van veelgebruikte properties binnen een collectie
* Zoekfunctie door alle beschikbare uitlegmodals
* Markdown-gebaseerde homepage vanuit GitHub
* Snelle toegang tot voorbeelditems binnen de Wikidata Designer
* Viewer voor JSON-LD als prettige boomstructuur

## 10. Terminologie

* **Microtask**: een modal waarin de gebruiker één enkele taak uitvoert (bijv. één key mappen, één waarde reconciliëren)
* **EntitySchema**: een Wikidata-structuur met regels over de gewenste structuur van een item
* **Reconciliation API**: API die mogelijke matches van waardes naar bestaande Wikidata QIDs retourneert
* **Wikidata Designer**: UI-sectie waarin de gebruiker een toekomstig Wikidata-item visueel samenstelt
* **QuickStatements**: extern Wikidata-hulpmiddel voor batch-edits op basis van eenvoudige statementsyntax

## 11. Belangrijke Aandachtspunten

* Meerdere waardes per key mogelijk (bijv. meerdere acteurs).
* Duidelijke waarschuwing op homepage dat data alleen lokaal leeft.
* EntitySchema als hoofdbron voor validatie, niet alleen Wikidata properties.
* Bronnen, qualifiers en andere metadata worden expliciet ondersteund.
* Altijd expliciete controle en validatie per item/property.
