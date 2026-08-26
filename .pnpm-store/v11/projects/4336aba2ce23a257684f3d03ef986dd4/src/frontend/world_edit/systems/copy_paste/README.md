# Copy / Paste

Dieses System besitzt ausschließlich den Ablauf für **Kopieren und Einfügen**.

1. Linksklick markiert einen Quader.
2. Rechtsklick kopiert den Quader serverseitig und öffnet die Live-Vorschau.
3. In der Mitte erscheint ein Achsen-Gizmo: X ist rot, Y grün und Z blau.
4. Eine Achse wird anvisiert und mit gehaltenem Linksklick blockweise um einen oder mehrere Blöcke verschoben.
5. Rechtsklick fügt die Vorschau an der bestätigten Position ein.

Der Chunk-Command muss bei `copy` das Feld `clipboard` bis in die öffentliche API-Antwort durchreichen. Ohne diese Vertragsinvariante bleibt das System absichtlich in der Auswahlphase und zeigt einen Fehlerstatus.

Der produktive Chunk-Vertrag akzeptiert für `commandSource` den Wert `editor`. Die genauere Herkunft `copy-paste` wird ausschließlich in den Metadaten geführt, damit der Rechtsklick nicht vor dem Gizmo an der Servervalidierung scheitert.

Ohne ausgewählte Flurstücke arbeitet Copy/Paste unabhängig von der gemeinsam genutzten Grundstücksmaske. Erst mit mindestens einem ausgewählten Flurstück kann die Maske die Zwischenablage begrenzen.

Das System teilt nur die zustandslosen Clipboard-Geometriehelfer mit `../clipboard/geometry.ts`. Cut/Paste ist ein getrennt registriertes Werkzeug und hat eine feste Ausschneideoperation.
