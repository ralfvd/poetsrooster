export function ParentGuide() {
  return (
    <details className="panel parent-guide">
      <summary>Hoe werkt het?</summary>
      <ol>
        <li>Stel bij <strong>Planning</strong> de klas, periode en poetsdagen in.</li>
        <li>Maak bij <strong>Leerlingen</strong> de invulvelden en vul de namen en beschikbaarheid in.</li>
        <li>Voeg zo nodig bij <strong>Klasuitzonderingen</strong> een vrije dag voor alleen deze klas toe, bijvoorbeeld een schoolreisje.</li>
        <li>Kies <strong>Poetsdagen genereren</strong> en daarna <strong>Optimale verdeling</strong>.</li>
        <li>Controleer, pas eventueel handmatig aan en download of print het rooster.</li>
        <li>Gebruik <strong>Back-up &amp; import</strong> om later op een andere computer verder te werken.</li>
      </ol>
      <p className="guide-note">De schoolkalender onderaan is alleen voor beheerders; schoolbrede vrije dagen worden automatisch toegepast.</p>
    </details>
  );
}
