"""Wire the prepared reference-based PBR materials directly for Blender and glTF."""

import bpy


def material(obj, folder, prefix, uv_name, project_photo=False):
    mat = obj.material_slots[0].material
    nt = mat.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    coord = nt.nodes.new("ShaderNodeUVMap")
    coord.uv_map = uv_name
    for suffix, target in [
        ("albedo.jpg", "Base Color"),
        ("normal.png", "Normal"),
        ("roughness.png", "Roughness"),
    ]:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(
            str(folder / (prefix + "-" + suffix)), check_existing=True
        )
        if project_photo and target == "Base Color":
            from windbreaker_texture import project

            tex.image = project(obj, folder, prefix)
        if target != "Base Color":
            tex.image.colorspace_settings.name = "Non-Color"
        nt.links.new(coord.outputs["UV"], tex.inputs["Vector"])
        value = tex.outputs["Color"]
        if target == "Normal":
            normal = nt.nodes.new("ShaderNodeNormalMap")
            normal.uv_map = uv_name
            normal.inputs["Strength"].default_value = 0.72
            nt.links.new(value, normal.inputs["Color"])
            value = normal.outputs["Normal"]
        nt.links.new(value, bs.inputs[target])


def wardrobe(folder):
    for name, prefix in [
        ("Cloth_jacket", "windbreaker"),
        ("Cloth_jeans", "denim"),
        ("Cloth_tshirt", "jersey"),
    ]:
        obj = bpy.context.scene.objects.get(name)
        if obj and (folder / (prefix + "-albedo.jpg")).exists():
            material(
                obj,
                folder,
                prefix,
                obj.data.uv_layers[0].name,
                project_photo=(folder / (prefix + "-photo.png")).is_file(),
            )
            if name == "Cloth_jeans" and obj.data.library:
                obj.data = obj.data.copy()
                from blender_master import bake_identity

                bake_identity(obj)
                for v in obj.data.vertices:
                    z = v.co.z
                    pad = 0.0045 * max(0, 1 - abs(z - 0.565) / 0.13) + 0.003 * max(
                        0, 1 - abs(z - 0.122) / 0.085
                    )
                    v.co += v.normal * pad
                obj.data.update()
