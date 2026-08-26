# Cut / Paste

Dieses System besitzt ausschließlich den Ablauf für **Ausschneiden und Einfügen**.

1. Linksklick markiert einen Quader.
2. Rechtsklick schneidet den Quader serverseitig aus und öffnet die Live-Vorschau.
3. In der Mitte erscheint ein Achsen-Gizmo: X ist rot, Y grün und Z blau.
4. Eine Achse wird anvisiert und mit gehaltenem Linksklick blockweise um einen oder mehrere Blöcke verschoben.
5. Rechtsklick fügt die Vorschau an der bestätigten Position ein.

Der Inventar-Werkzeugschlüssel `cut-transform` muss explizit als WorldEdit-System zugelassen sein und wird anschließend über den Registry-Alias auf `cut-paste` aufgelöst. Der Chunk-Command verwendet wie alle Editor-WorldEdit-Befehle `commandSource: "editor"`.

Ohne ausgewählte Flurstücke arbeitet Cut/Paste unabhängig von der gemeinsam genutzten Grundstücksmaske. Erst mit mindestens einem ausgewählten Flurstück kann die Maske die Zwischenablage begrenzen.

Die feste Cut-Operation verhindert, dass Änderungen an Copy/Paste versehentlich das Ausschneiden umschalten. Gemeinsam sind nur zustandslose Geometriehelfer.
