# Ressources tierces — matières extérieures (agent « flore »)

Toutes les images ci-dessous sont dans le domaine public (CC0 1.0 Universal) : aucune attribution n'est exigée, elle est donnée par courtoisie.
Elles proviennent du miroir GitHub `Papyszoo/CC0-Public-Domain-Textures` (commit `fcc4ff97a5a843dc2e242ec9e195389bc46ed7d2`,
licence du dépôt et de chaque collection : CC0 1.0), qui republie en KTX2 512 px des textures de Poly Haven et d'ambientCG
(sites eux-mêmes publiés sous CC0). Les fichiers KTX2 ont été décodés hors ligne (transcodeur Basis de three r170), retouchés
(teinte, contraste, séparation pierre / joint, mélange de deux teintes de tuiles, relief et rugosité regroupés dans une seule image :
rouge = relief, vert = rugosité) puis enregistrés en WebP 512 × 512 dans `visite/assets/flore/`.

| Fichier(s) | Ressource d'origine | Auteur | Source | Licence |
|---|---|---|---|---|
| `pierre-seche.webp`, `pierre-seche-r.webp` | Old Stone Wall (albedo, height, roughness) | Poly Haven | https://polyhaven.com/a/old_stone_wall — miroir : `packs/polyhaven-textures/textures/old_stone_wall/` | CC0 1.0 |
| `tuiles.webp`, `tuiles-r.webp` | Clay Roof Tiles 02 (albedo, height) et Clay Roof Tiles (albedo) | Poly Haven | https://polyhaven.com/a/clay_roof_tiles_02, https://polyhaven.com/a/clay_roof_tiles — miroir : `packs/polyhaven-textures/textures/clay_roof_tiles_02/`, `.../clay_roof_tiles/` | CC0 1.0 |
| `travertin.webp` | Travertine 009 (Color) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Travertine009 — miroir : `packs/ambientcg-textures/textures/Travertine009/` | CC0 1.0 |
| `gravillons.webp`, `gravillons-r.webp` | Gravel 026 (Color, Displacement) | ambientCG (Lennart Demes) | https://ambientcg.com/view?id=Gravel026 — miroir : `packs/ambientcg-textures/textures/Gravel026/` | CC0 1.0 |
| `enrobe.webp`, `enrobe-r.webp` | Asphalt 04 (albedo, height) | Poly Haven | https://polyhaven.com/a/asphalt_04 — miroir : `packs/polyhaven-textures/textures/asphalt_04/` | CC0 1.0 |
| `ecorce.webp`, `ecorce-r.webp` | Bark Brown 02 (albedo, height) | Poly Haven | https://polyhaven.com/a/bark_brown_02 — miroir : `packs/polyhaven-textures/textures/bark_brown_02/` | CC0 1.0 |

Poids total ajouté : voir le rapport (≈ 0,43 Mo, chargé dans toutes les qualités).

Repli : si une image manque ou ne se décode pas, `visite/js/flora.js` la laisse de côté et `materials.js` dessine la matière comme avant
(textures procédurales sur canvas).
