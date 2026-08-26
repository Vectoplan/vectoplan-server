# Sculpt Brush

Sculpt besitzt einen eigenen Intent-Handler. Linksklick entfernt eine horizontale Geländeschicht, Rechtsklick setzt eine Schicht direkt über dem getroffenen Block. Standard ist `box` mit Radius `5`; die Werte bleiben UI-/Command-Variablen.

Das System verwendet bewusst `radiusY = 0`, damit ein Klick nicht gleichzeitig mehrere Höhenlagen verändert. Als Material für das Anheben dient der tatsächlich anvisierte Quellblock, nicht das WorldEdit-Werkzeug in der Hotbar.

Der Chunk-DB-Bootstrap muss `WorldEdit` als Command-Typ in `world_command_logs` und `chunk_events` zulassen. Er erweitert ältere CHECK-Constraints automatisch; andernfalls würde die API bereits vor der Sculpt-Ausführung mit HTTP 400 abbrechen.
