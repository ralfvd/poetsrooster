export function ParentGuide() {
  return (
    <details className="panel parent-guide">
      <summary>Hoe werkt het?</summary>
      <ol>
        <li>Stel bij <strong>Planning</strong> de klas, periode, poetsdagen en het aantal ouders/verzorgers per poetsdag in.</li>
        <li>Kies <strong>Poetsdagen genereren</strong> om het lege rooster te maken.</li>
        <li>
          Maak bij <strong>Leerlingen</strong> de invulvelden en vul de leerlingnamen in. De naam is het unieke herkenningspunt voor de ouder(s)/verzorger(s) die poetsen.
          Een <strong>0 bij vorig jaar</strong> betekent nieuw in de klas en telt voor de verdeling als het gemiddelde van de andere tellingen.
        </li>
        <li>Voeg zo nodig bij <strong>Klasuitzonderingen</strong> een vrije dag voor alleen deze klas toe, bijvoorbeeld een schoolreisje.</li>
        <li>Kies in het lege rooster alvast leerlingnamen bij vaste poetsmomenten. Deze keuzes blijven vaststaan.</li>
        <li>Kies <strong>Optimale verdeling</strong> om de overige momenten eerlijk te vullen.</li>
        <li>Controleer het rooster en download, print of kopieer het. Gebruik <strong>Back-up &amp; import</strong> om later elders verder te werken.</li>
      </ol>
      <p className="guide-note">De schoolkalender onderaan is alleen voor beheerders; schoolbrede vrije dagen worden automatisch toegepast.</p>
    </details>
  );
}
