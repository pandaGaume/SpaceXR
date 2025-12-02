RGB 72, 157, 188
Hex #489DBC

var createScene = function () {
	var scene = new BABYLON.Scene(engine);

	var camera = new BABYLON.ArcRotateCamera("Camera", 0, 0, 0, BABYLON.Vector3.Zero(), scene);
    camera.setPosition(new BABYLON.Vector3(1, -1, -1));
	camera.attachControl(canvas, true);

	var light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);

	//Array of points to construct lines
	var myPoints = [
		new BABYLON.Vector3(0, 0, 0),
		new BABYLON.Vector3(0, 1, 1),
		new BABYLON.Vector3(0, 1, 0)
	];
	
	//Create lines 
	// var lines = BABYLON.MeshBuilder.CreateLines("lines", {points: myPoints}, scene); 
	const lines = BABYLON.MeshBuilder.CreateTube("lineT2", { path: myPoints, radius: 0.05}, scene);
    var gl = new BABYLON.GlowLayer("", scene);
    gl.customEmissiveColorSelector = (mesh, subMesh, material, result) => {
if (mesh === lines) {
        result.r = 49 / 255;
        result.g = 231 / 255;
        result.b = 238 / 255;
        // or: result.set(49 / 255, 231 / 255, 238 / 255);
    }
    }

	return scene;
}
export default createScene
