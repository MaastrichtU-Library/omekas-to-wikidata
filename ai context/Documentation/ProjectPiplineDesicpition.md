# Gedetailleerde uitleg 

## 1. Open Source Hosting & Doelgroep 

Hosting op GitHub: 
 De gehele website wordt op GitHub gehost en is daarmee volledig open source. Hierdoor kunnen andere instanties de code kopiëren, aanpassen en uitbreiden. 

Doelgroep: 
 De tool is bedoeld voor organisaties die Omeka-S gebruiken. 

 

## 2. Data Invoer & API-Integratie 

Gebruikersinvoer: 
 De gebruiker geeft de endpoint en aanvullende variabelen op waarmee data via de Omeka-S (of Omega-S) API wordt opgevraagd. 

Data Weergave: 
 De opgehaalde API-data wordt in de tool getoond. De gebruiker kan deze data inspecteren alvorens verdere bewerkingen uit te voeren. 

 

## 3. Integratie met OpenRefine 

Pre-gedefinieerde automatische edits: 

Er is een vooraf gedefinieerd OpenRefine automatische edits bestand beschikbaar. 

Dit bestand wordt gehost in een map op GitHub en is vrij beschikbaar voor andere instellingen als startpunt. 

Workflow: 

De gebruiker klikt op "Start". 

De gebruiker wordt doorverwezen naar een online instantie (op Wikimedia PAWS , inlog nodig) van OpenRefine. (meer info over PAWS) 

Data & Edits: De data en het OpenRefine project history (json formaat) bestand worden direct aan de OpenRefine instantie meegeleverd. 

Fallback: Als de online OpenRefine instantie niet beschikbaar is, kan de gebruiker een lokale OpenRefine instantie gebruiken. 

Bewerking in OpenRefine: 
 Op de OpenRefine instantie voert de gebruiker de handmatige edits uit. 

 

## 4. Documentatie & Handleidingen 

Centrale Documentatie: 
 De website herbergt tevens alle relevante documentatie, zoals de handleiding en belangrijke verwijzingen. 
Dit zorgt ervoor dat de gebruiker die handmatige edits uitvoert, op één centrale plek de benodigde informatie kan vinden. 

Daar naast is de tool een soort Wizard waar de gebruiker stap voor stap begleid word. 

 

## 5. Export & Integratie met QuickStatements 

Exportproces: 
 Na voltooiing van de bewerkingen in OpenRefine kan de gebruiker het resultaat exporteren als QuickStatements code. 

Integratie Opties: 

Geautomatiseerde Afhandeling: 
 De tool kan (mogelijk via een API-key of OAuth) de QuickStatements opdracht direct uitvoeren. 
 (Let op: De werking hiervan is nog in evaluatie. Mocht dit niet functioneren, dan is er een alternatieve workflow.) 

Handleiding: 
 Als de directe integratie niet werkt, krijgt de gebruiker een gedetailleerde handleiding om QuickStatements handmatig te gebruiken en in te loggen. 

 

## Samenvatting 

De pipeline bestaat uit de volgende stappen: 

Open source hosting op GitHub met een tool gericht op Omeka-S gebruikers. 

Data ophalen via een API-endpoint met gebruiker opgegeven parameters. 

Integratie met OpenRefine voor het uitvoeren van automatische en handmatige edits, inclusief fallback-opties. 

Centraal beheer van handleidingen en documentatie. 

Export en integratie met QuickStatements, met ondersteuning via API of een gebruikershandleiding. 