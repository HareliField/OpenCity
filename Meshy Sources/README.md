# Asphalt Heat Meshy assets

This folder preserves the input image, original Meshy output, and four-angle runtime review for each of the 18 assets used in the game. The manifest records the generation settings and the checksum of every original.

All jobs used image-to-3D with Meshy 7.1, Ultra 4K geometry, Meshy 7 texturing, 4K base color, PBR maps, and triangle remeshing. Generated GLBs keep the original texture sizes. Browser GLBs use base-color maps up to 2048 pixels and normal and material maps up to 1024 pixels.

## Changes after rendering the models

- The coupe was separated into a body and wheel prototype, aligned to the suspension, and given smoked glazing. The game supplies brake lights and deforms the body in collisions.
- The washer's surface finish was rebuilt with controlled roughness after the Meshy normal map looked heavily dented. The salon desk, chair, stock, display case, bookcase, table, and clothes rack were adjusted for interior lighting and fitted to the shop rooms.
- The plane tree keeps its generated trunk and branches with additional foliage layers. The palm and streetlamp pivots were aligned to their bases. The trash bin and fence share the position of their rigid bodies.
- The commercial and coastal props were checked from front, side, and rear views before placement. Surface detail still varies by asset. The pastry case includes a small baked mark and the coupe retains some baked texture wear.

[Meshy Image to 3D settings](https://docs.meshy.ai/en/api/image-to-3d)
