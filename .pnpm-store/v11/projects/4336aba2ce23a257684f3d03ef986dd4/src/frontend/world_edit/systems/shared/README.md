# Gemeinsame WorldEdit-Bausteine

Dieser Ordner enthält ausschließlich zustandslose, explizit geteilte Logik.
Aktuell übersetzt `brush_intent.ts` Mausaktionen in Brush-Aufrufe für Paint und
Sculpt. Zustände, Persistenz, UI-Texte oder Reset-Regeln eines einzelnen
Werkzeugs gehören nicht hierher.

Eine neue gemeinsame Abhängigkeit ist nur zulässig, wenn mindestens zwei
Systeme denselben unveränderlichen Vertrag benötigen und getrennte Tests
belegen, dass keine Werkzeugzustände gekoppelt werden.
