# Commonstreet Meshy assets

This folder preserves the input image, original Meshy output, and four-angle runtime review for each of the 40 assets used in the game. The manifest records the generation settings and the checksum of every original.

All jobs used image-to-3D with Meshy 7.1, Ultra 4K geometry, Meshy 7 texturing, 4K base color, PBR maps, and triangle remeshing. Generated GLBs keep the original texture sizes. Browser GLBs use base-color maps up to 2048 pixels and normal and material maps up to 1024 pixels.

## Natural Photos generation

Twenty-two single-object cutouts from the new reference set used 770 credits. Each completed job cost 35 credits against the build ceiling of 2,800. The manifest records each source image, the outline in its 800 × 450 inspection view, task ID, receipt, and SHA-256 hashes of the cutout, original and shipped GLB. The new runtime assets use base color up to 1536 pixels and normal and material maps up to 512 pixels. [Meshy pricing](https://docs.meshy.ai/en/api/pricing)

The silver sedan, maroon saloon, red crossover and white Harbor Supply truck have independent hubcaps, working lights and clearance around each suspension wheel. The tank, lamp, post box, enamel shade, plant, fruit crate and rescue cabin use repaired geometry. The hydrant had detached triangles removed. The truck and coat rail were rebuilt in Blender after four-angle inspection found disconnected or fused geometry in their generations. The unmodified 4K generations are in **Original GLBs**.

The new daylight sky and lighting environment use the CC0 Kloofendal 48d Partly Cloudy panorama. Sixteen rectangular window samples from the supplied photos contribute separate color, glazing and frame relief to the facades. Twelve additional photo samples finish framed prints, trade signs, cooler doors, shop joinery, baskets and folded clothing. [Poly Haven panorama](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)

[Reference review by district](City%20reference%20index.md)

## Changes after rendering the models

- The coupe was separated into a body and wheel prototype, aligned to the suspension, and given smoked glazing. The game supplies brake lights and deforms the body in collisions.
- The washer's surface finish was rebuilt with controlled roughness after the Meshy normal map looked heavily dented. The salon desk, chair, stock, display case, bookcase, table, and clothes rack were adjusted for interior lighting and fitted to the shop rooms.
- The plane tree keeps its generated trunk and branches with additional foliage layers. The palm and streetlamp pivots were aligned to their bases. The trash bin and fence share the position of their rigid bodies.
- The commercial and coastal props were checked from front, side, and rear views before placement. Surface detail still varies by asset. The pastry case includes a small baked mark and the coupe retains some baked texture wear.

[Meshy Image to 3D settings](https://docs.meshy.ai/en/api/image-to-3d)

## Character Build Test originals

[Character Build Test originals](Character%20Build%20Test%20Originals/README.md) contains the full-resolution wardrobe downloads and their checksums.

## Contribution gallery

[Teal station wagon](gallery-station-wagon.glb) is the source model shown in the Commonstreet gallery's car clip. It was generated from text with Meshy 7.1 and textured with Meshy 7. The model has a separate windshield and door and rear glass, with a modeled passenger cabin visible through the panes. The footage places it at a curb in Old Town.
