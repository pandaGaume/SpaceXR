# Exports the fictional habitat of the CO2 scrubber film as a 3D Tiles tileset on the Moon, where the film stands it.
#
# blender --background --factory-startup nuit9-shackleton.blend --python export-shackleton-habitat.py -- <output folder>
#
# Blender writes nothing back to the .blend. The scene is in metres, X and Y along the south polar stereographic axes of
# the LOLA DEM, Z up, its origin on the ground of the site. Materials keep their factors: procedural textures do not
# exist in glTF. The buried solar mast does not appear in the film, and is left out.
import json
import math
import os
import sys

import bmesh
import bpy

# Site of the film, video/scene-3d-brief.fr.md: south polar stereographic metres on the radius of the LOLA products.
STEREOGRAPHIC_RADIUS = 1737400.0
SITE_X, SITE_Y = 25100.0, -7613.0
# Reference radius of the tile service, and heights over it read from its DEM: mean of the six feet of the habitat, and
# under the rover. The film levels the ground, the real DEM does not.
REFERENCE_RADIUS = 1738100.0
STATION_HEIGHT = -537.97
ROVER_HEIGHT = -537.555
# Screen-space error of the root: the objects appear from about 15 km.
ROOT_GEOMETRIC_ERROR = 100

output = sys.argv[sys.argv.index("--") + 1]
os.makedirs(output, exist_ok=True)
source = bpy.data.scenes["Scene"]
bpy.context.window.scene = source
depsgraph = bpy.context.evaluated_depsgraph_get()


def flatten_materials():
    """Keeps the factors a glTF material can hold. The glass would otherwise need a render of the scene per frame."""
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        tree = material.node_tree
        bsdf = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        for link in list(tree.links):
            if link.to_node == bsdf:
                tree.links.remove(link)
        # Anisotropy needs tangents or texture coordinates, which these meshes do not have: the metal would render black.
        bsdf.inputs["Anisotropic"].default_value = 0
    glass = bpy.data.materials["Window_Glass"].node_tree.nodes
    bsdf = next(node for node in glass if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Transmission Weight"].default_value = 0
    bsdf.inputs["Base Color"].default_value = (0.015, 0.02, 0.03, 1)
    bsdf.inputs["Roughness"].default_value = 0.08


def merged_by_material(objects, name):
    """One mesh per material in world coordinates, so that hundreds of parts take a few draw calls."""
    groups = {}
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        mesh.transform(evaluated.matrix_world)
        if evaluated.matrix_world.to_3x3().determinant() < 0:
            mesh.flip_normals()
        for index in range(max(1, len(mesh.materials))):
            material = mesh.materials[index] if len(mesh.materials) else None
            part = bmesh.new()
            part.from_mesh(mesh)
            bmesh.ops.delete(part, geom=[face for face in part.faces if face.material_index != index], context="FACES")
            if part.faces:
                for face in part.faces:
                    face.material_index = 0
                temporary = bpy.data.meshes.new("temporary")
                part.to_mesh(temporary)
                key = material.name if material else "Aluminium_Brushed"
                groups.setdefault(key, bmesh.new()).from_mesh(temporary)
                bpy.data.meshes.remove(temporary)
            part.free()
        bpy.data.meshes.remove(mesh)
    result, points = [], []
    for key, group in groups.items():
        mesh = bpy.data.meshes.new(f"{name}_{key}")
        group.to_mesh(mesh)
        group.free()
        mesh.materials.append(bpy.data.materials[key])
        points.extend(vertex.co.copy() for vertex in mesh.vertices)
        result.append(bpy.data.objects.new(mesh.name, mesh))
    return result, points


def export(objects, name):
    scene = bpy.data.scenes.new(f"export_{name}")
    for obj in objects:
        scene.collection.objects.link(obj)
    bpy.context.window.scene = scene
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(output, f"{name}.glb"),
        export_format="GLB",
        # Otherwise what is selected in the other scenes of the file comes along, the terrain included.
        use_active_scene=True,
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=False,
        export_tangents=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    bpy.context.window.scene = source


def sphere(points):
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    center = [(low[axis] + high[axis]) / 2 for axis in range(3)]
    radius = max(math.dist(center, point) for point in points)
    return [round(value, 3) for value in center] + [round(radius + 0.01, 3)]


def site_transform(height):
    """Column-major transform of the scene on the Moon: X and Y along the stereographic axes at the site, Z up."""
    rho = math.hypot(SITE_X, SITE_Y)
    colatitude = 2 * math.atan(rho / (2 * STEREOGRAPHIC_RADIUS))
    longitude = math.atan2(SITE_X, SITE_Y)
    sin_c, cos_c = math.sin(colatitude), math.cos(colatitude)
    sin_l, cos_l = math.sin(longitude), math.cos(longitude)
    up = (sin_c * cos_l, sin_c * sin_l, -cos_c)
    away_from_pole = (cos_c * cos_l, cos_c * sin_l, sin_c)
    along_longitude = (-sin_l, cos_l, 0.0)
    x_axis = [sin_l * away_from_pole[i] + cos_l * along_longitude[i] for i in range(3)]
    y_axis = [cos_l * away_from_pole[i] - sin_l * along_longitude[i] for i in range(3)]
    cross = (
        x_axis[1] * y_axis[2] - x_axis[2] * y_axis[1],
        x_axis[2] * y_axis[0] - x_axis[0] * y_axis[2],
        x_axis[0] * y_axis[1] - x_axis[1] * y_axis[0],
    )
    assert math.dist(cross, up) < 1e-9, "The stereographic axes must be right-handed about the up direction."
    origin = [(REFERENCE_RADIUS + height) * value for value in up]
    return (
        [*x_axis, 0, *y_axis, 0, *up, 0, *origin, 1],
        math.degrees(colatitude) - 90,
        math.degrees(longitude),
    )


flatten_materials()
parts = [obj for obj in bpy.data.collections["Habitat"].objects if obj.type in {"MESH", "CURVE"} and not obj.hide_render]
parts += [bpy.data.objects["Flood_Mast_Housing"], bpy.data.objects["Cable"]]
rover_parts = [obj for obj in bpy.data.collections["Rover"].objects if obj.type == "MESH" and not obj.hide_render]
station, station_points = merged_by_material(parts, "station")
rover, rover_points = merged_by_material(rover_parts, "rover")
export(station, "station")
export(rover, "rover")

transform, latitude, longitude = site_transform(STATION_HEIGHT)
tileset = {
    "asset": {"version": "1.1"},
    "geometricError": ROOT_GEOMETRIC_ERROR,
    "extras": {
        "source": "co2-scrubber-governed-agent/video/3d/nuit9-shackleton.blend",
        "frame": "MOON_ME_DE421",
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "polarStereographic": [SITE_X, SITE_Y],
    },
    "root": {
        "transform": transform,
        "boundingVolume": {"sphere": sphere(station_points + rover_points)},
        "geometricError": ROOT_GEOMETRIC_ERROR,
        "refine": "ADD",
        "children": [
            {
                "boundingVolume": {"sphere": sphere(station_points)},
                "geometricError": 0,
                "content": {"uri": "station.glb"},
            },
            {
                # The rover stands on the DEM where it is parked.
                "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, round(ROVER_HEIGHT - STATION_HEIGHT, 3), 1],
                "boundingVolume": {"sphere": sphere(rover_points)},
                "geometricError": 0,
                "content": {"uri": "rover.glb"},
            },
        ],
    },
}
with open(os.path.join(output, "tileset.json"), "w", encoding="utf-8") as file:
    json.dump(tileset, file, indent=2)
print("EXPORTED", len(station), "station meshes,", len(rover), "rover meshes,", "latitude", latitude, "longitude", longitude)
