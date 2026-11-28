# Character Build Test originals

Full-resolution Meshy GLBs from the downloads used for the character wardrobe test. The filenames below identify the original downloads. The archived geometry and textures are byte-for-byte copies.

| Archive file | Model | Download filename | Bytes |
| --- | --- | --- | ---: |
| [`sock-02.glb`](sock-02.glb) | Sock download (2) | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (2).glb` | 134,044,500 |
| [`sock-03.glb`](sock-03.glb) | Sock download (3) | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (3).glb` | 134,044,500 |
| [`hat.glb`](hat.glb) | Hat | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (4).glb` | 125,665,584 |
| [`jeans.glb`](jeans.glb) | Jeans | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (5).glb` | 120,326,988 |
| [`jacket.glb`](jacket.glb) | Jacket | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (6).glb` | 136,802,484 |
| [`t-shirt.glb`](t-shirt.glb) | T-shirt | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (7).glb` | 116,332,096 |
| [`shoe.glb`](shoe.glb) | Shoe | `Meshy_AI_Red_Jacket_Portrait_20261128_texture (8).glb` | 102,575,248 |

The two sock downloads have the same SHA-256. The fitted preview mirrors the single source shoe to dress both feet. The archive contains the seven original download files found for this set.

## Mirrored counterparts

[`shoe-mirrored.glb`](shoe-mirrored.glb) is the opposite-foot counterpart of [`shoe.glb`](shoe.glb). It keeps all 1,123,113 vertices, 2,116,966 triangles, UV coordinates and the three embedded texture maps. The reflection is baked across the source shoe’s width at local Z = 0, with normals and triangle winding updated.

[`sock-mirrored.glb`](sock-mirrored.glb) pairs with [`sock-02.glb`](sock-02.glb) for the opposite foot. It keeps all 1,009,043 vertices, 1,866,970 triangles, UV coordinates and three embedded texture maps. The reflection is baked across the source sock’s width at local Z = 0, with normals and triangle winding updated.

The GLBs use Git LFS. In a checkout with Git LFS installed, run `git lfs pull --include="Meshy Sources/Character Build Test Originals/*.glb"`. The [checksums](SHA256SUMS) verify the downloaded files.

[Fitted Character Build Test](../../Character%20Sources/Character%20Build%20Test/README.md)
