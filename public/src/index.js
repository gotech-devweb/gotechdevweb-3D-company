import { KeyDisplay } from "./utils.js";
import { CharacterControls } from "./characterControls.js";
import * as THREE from "../node_modules/three/build/three.module.js"
import { GLTFLoader } from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls.js";
import ThreeMeshUI from 'https://cdn.skypack.dev/three-mesh-ui';

class MouseMeshInteractionHandler {
    constructor(mesh_name, handler_function) {
        this.mesh_name = mesh_name;
        this.handler_function = handler_function;
    }
}

class MouseMeshInteraction {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.updated = false;
        this.event = '';

        // last mesh that the mouse cursor was over
        this.last_mouseenter_mesh = undefined;
        // last mesh that the mouse was pressing down
        this.last_pressed_mesh = undefined;

        this.handlers = new Map();

        this.handlers.set('click', []);
        this.handlers.set('dblclick', []);
        this.handlers.set('contextmenu', []);

        this.handlers.set('mousedown', []);
        this.handlers.set('mouseup', []);
        this.handlers.set('mouseenter', []);
        this.handlers.set('mouseleave', []);

        window.addEventListener('mousemove', this);

        window.addEventListener('click', this);
        window.addEventListener('dblclick', this);
        window.addEventListener('contextmenu', this);

        window.addEventListener('mousedown', this);
    }

    handleEvent(e) {
        switch (e.type) {
            case "mousemove":
                {
                    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
                    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
                    this.updated = true;
                    this.event = 'motion';
                }
                break;
            default:
                {
                    this.updated = true;
                    this.event = e.type;
                }
        }
    }

    addHandler(mesh_name, event_type, handler_function) {
        if (this.handlers.has(event_type)) {
            this.handlers.get(event_type).push(new MouseMeshInteractionHandler(mesh_name, handler_function));
        }
    }

    update() {
        if (this.updated) {
            // update the picking ray with the camera and mouse position
            this.raycaster.setFromCamera(this.mouse, this.camera);

            // calculate objects intersecting the picking ray
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);

            if (intersects.length > 0) {
                // special test for events: 'mouseenter', 'mouseleave'
                if (this.event === 'motion') {
                    let mouseenter_handlers = this.handlers.get('mouseenter');
                    let mouseleave_handlers = this.handlers.get('mouseleave');

                    if (mouseleave_handlers.length > 0) {
                        for (const handler of mouseleave_handlers) {
                            // if mesh was entered by mouse previously, but not anymore, that means it has been mouseleave'd
                            if (
                                this.last_mouseenter_mesh !== undefined &&
                                intersects[0].object !== this.last_mouseenter_mesh &&
                                handler.mesh_name === this.last_mouseenter_mesh.name
                            ) {
                                handler.handler_function(this.last_mouseenter_mesh);
                                break;
                            }
                        }
                    }

                    if (mouseenter_handlers.length > 0) {
                        for (const handler of mouseenter_handlers) {
                            if (handler.mesh_name === intersects[0].object.name && intersects[0].object !== this.last_mouseenter_mesh) {
                                this.last_mouseenter_mesh = intersects[0].object;
                                handler.handler_function(intersects[0].object);
                                break;
                            }
                        }
                    }
                } else {
                    // if mouseup event has occurred
                    if (this.event === 'click' && this.last_pressed_mesh === intersects[0].object) {
                        for (const handler of this.handlers.get('mouseup')) {
                            if (handler.mesh_name === intersects[0].object.name) {
                                handler.handler_function(intersects[0].object);
                                break;
                            }
                        }
                        this.last_pressed_mesh = undefined;
                    }

                    // for mouseup event handler to work
                    if (this.event === 'mousedown') {
                        this.last_pressed_mesh = intersects[0].object;
                    }

                    let handlers_of_event = this.handlers.get(this.event);
                    for (const handler of handlers_of_event) {
                        if (handler.mesh_name === intersects[0].object.name) {
                            handler.handler_function(intersects[0].object);
                            break;
                        }
                    }
                }
            }
            // if mouse doesn't intersect any meshes
            else if (this.event === 'motion') {
                // special test for 'mouseleave' event
                // 			(since it may be triggered when cursor doesn't intersect with any meshes)
                for (const handler of this.handlers.get('mouseleave')) {
                    // if mesh was entered by mouse previously, but not anymore, that means it has been mouseleave'd
                    if (this.last_mouseenter_mesh !== undefined && handler.mesh_name === this.last_mouseenter_mesh.name) {
                        handler.handler_function(this.last_mouseenter_mesh);
                        this.last_mouseenter_mesh = undefined;
                        break;
                    }
                }
            }

            this.updated = false;
        }
    }
}

// Setup
// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// Camera
const ratio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(75, ratio, 0.1, 1000);
camera.position.set(5, 5, 0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enable = true;
renderer.gammaOuput = true;
document.body.appendChild(renderer.domElement);

// Controls
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true
orbitControls.minDistance = 5
orbitControls.maxDistance = 15
orbitControls.enablePan = false
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05
orbitControls.update();

// Model with animation
var model, mixerCharater, status = false,
    characterControls;
new GLTFLoader().load('../public/assets/Soldier.glb', function(gltf) {
    model = gltf.scene;
    model.traverse(function(object) {
        if (object.isMesh) {
            object.castShadow = true;
        }
    });
    model.position.set(0, 0, 6)
    scene.add(model);

    mixerCharater = new THREE.AnimationMixer(model);
    // mixerCharater.clipAction(gltf.animations[1]).play();
    const animationsMap = new Map()
    gltf.animations.forEach((a) => {
        if (a.name != 'TPose') {
            animationsMap.set(a.name, mixerCharater.clipAction(a))
        }
    })

    characterControls = new CharacterControls(model, mixerCharater, animationsMap, orbitControls, camera, 'Idle')
})

// Create Light
scene.add(new THREE.AmbientLight(0xffffff, 1))

const dirLight = new THREE.DirectionalLight(0xffffff, 0.75)
dirLight.position.set(0, 100, 0);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 200;
dirLight.shadow.mapSize.width = 500;
dirLight.shadow.mapSize.height = 500;
scene.add(dirLight);

// Create ground
// TEXTURES
const textureLoader = new THREE.TextureLoader();
const placeholder = textureLoader.load("../public/assets/placeholder.png");

const WIDTH = 200
const LENGTH = 200

const geometry = new THREE.PlaneGeometry(WIDTH, LENGTH, 512, 512);
const material = new THREE.MeshBasicMaterial({ map: placeholder })
wrapAndRepeatTexture(material.map)

const floor = new THREE.Mesh(geometry, material)
floor.receiveShadow = true
floor.rotation.x = -Math.PI / 2
scene.add(floor)

for (let i = 0; i < 5; i++) {
    const road = new THREE.TextureLoader();
    const roadPlacehoder = road.load("../public/assets/stone.jpg");

    const geometryRoad = new THREE.PlaneGeometry(1, 1);
    const materialRoad = new THREE.MeshBasicMaterial({ map: roadPlacehoder })
    wrapAndRepeatTexture(material.map)

    const floorRoad = new THREE.Mesh(geometryRoad, materialRoad)
        // floorRoad.receiveShadow = true
        // floorRoad.rotation.x = -Math.PI / 2
    floorRoad.position.set(2, 0.001, i)
    floorRoad.receiveShadow = true
    floorRoad.rotation.x = -Math.PI / 2
    scene.add(floorRoad)
}

for (let i = -100; i < 100; i++) {
    const road = new THREE.TextureLoader();
    const roadPlacehoder = road.load("../public/assets/street.jpg");

    const geometryRoad = new THREE.PlaneGeometry(1, 1);
    const materialRoad = new THREE.MeshBasicMaterial({ map: roadPlacehoder })
    wrapAndRepeatTexture(material.map)

    const floorRoad = new THREE.Mesh(geometryRoad, materialRoad)
        // floorRoad.receiveShadow = true
        // floorRoad.rotation.x = -Math.PI / 2
    floorRoad.position.set(i, 0.001, 5)
    floorRoad.receiveShadow = true
    floorRoad.rotation.x = -Math.PI / 2
    scene.add(floorRoad)
}

// Company
const gltfLoader = new GLTFLoader();
var mixerFoutain, mixerHologram;

gltfLoader.load('../public/assets/module/1.company/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.3, 0.3, 0.3);
    loadGLTF.position.set(0, 0.5, 0)
    scene.add(loadGLTF);
})

// Machine Drink
gltfLoader.load('../public/assets/module/2.machine/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.5, 0.5, 0.5);
    loadGLTF.position.set(3, 0, -3)
    scene.add(loadGLTF);
})

// Sign Ads
gltfLoader.load('../public/assets/module/10.sign/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.005, 0.005, 0.005);
    loadGLTF.rotation.y = -Math.PI / 2
    loadGLTF.position.set(-1, 0, 4)
    scene.add(loadGLTF);
})

// Sign Board Name
gltfLoader.load('../public/assets/module/12.sign_name/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.1, 0.1, 0.1);
    loadGLTF.rotation.y = 3
    loadGLTF.position.set(-1.8, 2, 3.5)
    scene.add(loadGLTF);
})

// Sign Board
// gltfLoader.load('../public/assets/module/11.sign_board/scene.gltf', (gltfScene) => {
//     var loadGLTF = gltfScene.scene;
//     loadGLTF.scale.set(0.01, 0.01, 0.01);
//     loadGLTF.rotation.y = 3
//     loadGLTF.position.set(4, 0, 3.5)

//     const road = new THREE.TextureLoader();
//     const roadPlacehoder = road.load("../public/assets/logo.png");

//     const geometryRoad = new THREE.PlaneGeometry(1, 1);
//     const materialRoad = new THREE.MeshBasicMaterial({ map: roadPlacehoder })
//     wrapAndRepeatTexture(material.map)

//     const floorRoad = new THREE.Mesh(geometryRoad, materialRoad)
//         // floorRoad.receiveShadow = true
//         // floorRoad.rotation.x = -Math.PI / 2
//     floorRoad.scale.set(0.8, 0.8, 0.8)
//     floorRoad.position.set(3.5, 0.75, 4.1)
//     floorRoad.receiveShadow = true
//     floorRoad.rotation.x = -Math.PI / 12
//     floorRoad.rotation.y -= 0.2
//     floorRoad.rotation.z -= 0.03

//     scene.add(floorRoad)
//     loadGLTF.name = 'bulb';
//     scene.add(loadGLTF);
// })

// Sign Board Name
gltfLoader.load('../public/assets/module/5.tree3/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.5, 0.5, 0.5);
    loadGLTF.rotation.y = 3
    loadGLTF.position.set(-4, 0, 2.5)
    scene.add(loadGLTF);
})

gltfLoader.load('../public/assets/module/4.tree2/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.5, 0.5, 0.5);
    loadGLTF.rotation.y = 3
    loadGLTF.position.set(10, 0, 1)
    scene.add(loadGLTF);
})

// Foutain
// gltfLoader.load('../public/assets/module/7.fountain/scene.gltf', (gltfScene) => {
//     var loadGLTF = gltfScene.scene;
//     loadGLTF.scale.set(0.002, 0.002, 0.002);
//     loadGLTF.position.set(-6, -0.1, 10)
//     scene.add(loadGLTF);

//     mixerFoutain = new THREE.AnimationMixer(loadGLTF);

//     gltfScene.animations.forEach((clip) => {

//         mixerFoutain.clipAction(clip).play();

//     });
// })

// gltfLoader.load('../public/assets/module/9.hologram_earth/scene.gltf', (gltfScene) => {
//     var loadGLTF = gltfScene.scene;
//     loadGLTF.scale.set(0.3, 0.3, 0.3);
//     loadGLTF.position.set(1, 7, -4)
//     scene.add(loadGLTF);

//     mixerHologram = new THREE.AnimationMixer(loadGLTF);

//     gltfScene.animations.forEach((clip) => {
//         mixerHologram.clipAction(clip).play();

//     });
// })

// Block text
const about = new ThreeMeshUI.Block({
    width: 1.2,
    height: 1.2,
    padding: 0.2,
    fontSize: 0.09,
    fontFamily: "../public/node_modules/three-mesh-ui/examples/assets/Roboto-msdf.json",
    fontTexture: "../public/node_modules/three-mesh-ui/examples/assets/Roboto-msdf.png",
    padding: 0.05,
    backgroundColor: new THREE.Color(0x000000),
    backgroundOpacity: 0.7,
    borderRadius: 0.05,
    borderWidth: 0.01,
    borderOpacity: 1,
    borderColor: new THREE.Color(0x333333),
    justifyContent: 'start',
    alignItems: 'start',
    fontColor: new THREE.Color(0xffffff),
    bestFit: 'shrink',
});

const textAbout = new ThreeMeshUI.Text({
    content: "GOTECH  GLOBAL TEAM  FAST & FLEXIBLE "
});

about.add(textAbout);
about.position.set(-1, -1, -1)
about.rotation.x = -0.5
scene.add(about);

const demo = new ThreeMeshUI.Block({
    width: 1.2,
    height: 1.2,
    padding: 0.2,
    fontSize: 0.09,
    fontFamily: "../public/node_modules/three-mesh-ui/examples/assets/Roboto-msdf.json",
    fontTexture: "../public/node_modules/three-mesh-ui/examples/assets/Roboto-msdf.png",
    padding: 0.05,
    backgroundColor: new THREE.Color(0x000000),
    backgroundOpacity: 0.7,
    borderRadius: 0.05,
    borderWidth: 0.01,
    borderOpacity: 1,
    borderColor: new THREE.Color(0x333333),
    justifyContent: 'start',
    alignItems: 'start',
    fontColor: new THREE.Color(0xffffff),
    bestFit: 'shrink',
});

const text1 = new ThreeMeshUI.Text({
    content: "Facilis ipsum reprehenderit nemo molestias. Aut cum mollitia reprehenderit."
});
const text2 = new ThreeMeshUI.Text({
    content: "Facilis ipsum reprehenderit nemo molestias. Aut cum mollitia reprehenderit."
});

demo.add(text1);
text2.set({
    fontColor: new THREE.Color(0x646FD4),
    fontSize: 0.04
});
demo.add(text2);

demo.position.set(-1, -1, -1)
demo.rotation.x = -0.5
scene.add(demo);
// Menu sign

const geometryS = new THREE.BoxGeometry(1, 1, 0.1);
const materialS1 = new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load('../public/assets/about.png') });
const materialS2 = new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load('../public/assets/service.jpg') });
const materialS3 = new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load('../public/assets/demo.png') });
const materialS4 = new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load('../public/assets/demo.png') });


const mesh1 = new THREE.Mesh(geometryS, materialS1);
mesh1.position.set(4, 0.5, 4)
mesh1.name = 'bulb1';

const mesh2 = new THREE.Mesh(geometryS, materialS2);
mesh2.position.set(4.5, 1.5, 4)
mesh2.name = 'bulb2';

const mesh3 = new THREE.Mesh(geometryS, materialS3);
mesh3.position.set(4.1, 2.5, 4)
mesh3.name = 'bulb3';

const mesh4 = new THREE.Mesh(geometryS, materialS4);
mesh4.position.set(3.7, 3.5, 4)
mesh4.name = 'bulb4';

scene.add(mesh1);
scene.add(mesh2);
scene.add(mesh3);
scene.add(mesh4);

// Dự kiến tạo vòm trời, nhưng chưa thêm background
// const geometryLine = new THREE.SphereGeometry(100, 100, 100);

// const wireframe = new THREE.WireframeGeometry(geometryLine);

// const line = new THREE.LineSegments(wireframe);

// line.position.set(4, 0, 7);
// scene.add(line);

// Xử lý sự kiện click
const mmi = new MouseMeshInteraction(scene, camera);

mmi.addHandler('bulb1', 'click', function() {
    console.log('bulb mesh is being clicked!');
    about.position.set(1, 0, 5)
    about.scale.set(8, 8, 8);
    about.rotation.x = 0;

    const geometryBox = new THREE.BoxGeometry(0.5, 0.5, 0.1);
    const materialBox = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('../public/assets/close.png')
    });
    const button = new THREE.Mesh(geometryBox, materialBox);
    button.scale.set(0.1, 0.1, 0.1)
    button.position.x = about.width / 2.2;
    button.position.y = about.height / 2.2;
    button.name = "close";
    about.add(button);

    camera.position.set(0, 0.1, 6)
});

mmi.addHandler('close', 'click', function() {
    console.log('bulb mesh is being clicked!');
    about.position.set(0, 0, 0)
    about.scale.set(0, 0, 0);
    about.rotation.x = 0;
    camera.position.set(0, 5, 5)
});

mmi.addHandler('bulb2', 'click', function() {
    console.log('bulb mesh is being clicked!');
    demo.position.set(1, 0, 5)
    demo.scale.set(8, 8, 8);
    demo.rotation.x = 0;

    const geometryBox = new THREE.BoxGeometry(0.5, 0.5, 0.1);
    const materialBox = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('../public/assets/close.png')
    });
    const button = new THREE.Mesh(geometryBox, materialBox);
    button.scale.set(0.1, 0.1, 0.1)
    button.position.x = demo.width / 2.5;
    button.position.y = demo.height / 2.2;
    button.name = "close2";
    demo.add(button);

    camera.position.set(0, 0.1, 6)
});

mmi.addHandler('close2', 'click', function() {
    console.log('bulb mesh is being clicked!');
    demo.position.set(0, 0, 0)
    demo.scale.set(0, 0, 0);
    demo.rotation.x = 0;
    camera.position.set(0, 5, 5)
});

// Danh sách nhân viên
// Hiển thị mô hình nhân viên
const geometryEmployee = new THREE.BoxGeometry(1, 1, 1);
const materialEmploye = new THREE.MeshBasicMaterial({ color: 0xffffff });

const boxEmployee = new THREE.Mesh(geometryEmployee, materialEmploye);
boxEmployee.position.set(5, 0.4, 0)
boxEmployee.name = 'employeeView';
scene.add(boxEmployee)
gltfLoader.load('../public/assets/module/13.employee/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.001, 0.001, 0.001);
    loadGLTF.position.set(5, 1.75, 0)
    loadGLTF.rotation.y = Math.PI / 2;
    scene.add(loadGLTF);
})

const boxEmployee2 = new THREE.Mesh(geometryEmployee, materialEmploye);
boxEmployee2.position.set(5, 0.4, -3)
boxEmployee2.name = 'employeeView';
scene.add(boxEmployee2)
gltfLoader.load('../public/assets/module/13.employee/scene.gltf', (gltfScene) => {
    var loadGLTF = gltfScene.scene;
    loadGLTF.scale.set(0.001, 0.001, 0.001);
    loadGLTF.position.set(5, 1.75, -3)
    loadGLTF.rotation.y = Math.PI / 2;
    scene.add(loadGLTF);
})

// Hiển thị thông tin chi tiết của nhân viên
const container = new ThreeMeshUI.Block({
    ref: "container",
    padding: 0.025,
    fontFamily: "../public/node_modules/three-mesh-ui/examples/assets/Roboto-msdf.json",
    fontTexture: "../public/node_modules/three-mesh-ui/examples/assets/Roboto-msdf.png",
    fontColor: new THREE.Color(0xffffff),
    backgroundOpacity: 0,
});

// container.position.set(6, 1.75, -3);
container.position.set(0, 0, 0);
container.rotation.y = Math.PI / 2;
container.scale.set(0, 0, 0);
scene.add(container);

//

const title = new ThreeMeshUI.Block({
    height: 0.2,
    width: 1.5,
    margin: 0.025,
    justifyContent: "center",
    fontSize: 0.09,
});

title.add(
    new ThreeMeshUI.Text({
        content: "spiny bush viper",
    })
);

container.add(title);

//

const leftSubBlock = new ThreeMeshUI.Block({
    height: 0.95,
    width: 1.0,
    margin: 0.025,
    padding: 0.025,
    textAlign: "left",
    justifyContent: "end",
});

const caption = new ThreeMeshUI.Block({
    height: 0.07,
    width: 0.37,
    textAlign: "center",
    justifyContent: "center",
});

caption.add(
    new ThreeMeshUI.Text({
        content: "Mind your fingers",
        fontSize: 0.04,
    })
);

leftSubBlock.add(caption);

//

const rightSubBlock = new ThreeMeshUI.Block({
    margin: 0.025,
});

const subSubBlock1 = new ThreeMeshUI.Block({
    height: 0.35,
    width: 0.5,
    margin: 0.025,
    padding: 0.02,
    fontSize: 0.04,
    justifyContent: "center",
    backgroundOpacity: 0,
}).add(
    new ThreeMeshUI.Text({
        content: "Known for its extremely keeled dorsal scales that give it a ",
    }),

    new ThreeMeshUI.Text({
        content: "bristly",
        fontColor: new THREE.Color(0x92e66c),
    }),

    new ThreeMeshUI.Text({
        content: " appearance.",
    })
);

const subSubBlock2 = new ThreeMeshUI.Block({
    height: 0.53,
    width: 0.5,
    margin: 0.01,
    padding: 0.02,
    fontSize: 0.025,
    alignItems: "start",
    textAlign: 'justify',
    backgroundOpacity: 0,
}).add(
    new ThreeMeshUI.Text({
        content: "The males of this species grow to maximum total length of 73 cm (29 in): body 58 cm (23 in), tail 15 cm (5.9 in). Females grow to a maximum total length of 58 cm (23 in). The males are surprisingly long and slender compared to the females.\nThe head has a short snout, more so in males than in females.\nThe eyes are large and surrounded by 9–16 circumorbital scales. The orbits (eyes) are separated by 7–9 scales.",
    })
);

rightSubBlock.add(subSubBlock1, subSubBlock2);

//

const contentContainer = new ThreeMeshUI.Block({
    contentDirection: "row",
    padding: 0.02,
    margin: 0.025,
    backgroundOpacity: 0,
});

contentContainer.add(leftSubBlock, rightSubBlock);
container.add(contentContainer);

//

new THREE.TextureLoader().load("../public/assets/avt.jpg", (texture) => {
    leftSubBlock.set({
        backgroundTexture: texture,
    });
});


// Bắt sự kiện onclick
mmi.addHandler('employeeView', 'click', function() {
    container.position.set(6, 1.75, -3);
    container.scale.set(1, 1, 1);
    container.rotation.y = Math.PI / 2;

    const geometryBox = new THREE.BoxGeometry(0.5, 0.5, 0.2);
    const materialBox = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('../public/assets/close.png')
    });
    const button = new THREE.Mesh(geometryBox, materialBox);
    button.scale.set(0.1, 0.1, 0.1)
    button.position.x = about.width / 2.2;
    button.position.y = about.height / 2.2;
    button.position.z += 0.2;

    button.name = "close3";
    container.add(button);

    camera.position.set(8, 1.75, -3);
});

mmi.addHandler('close3', 'click', function() {
    container.position.set(0, 0, 0)
    container.scale.set(0, 0, 0);
    container.rotation.x = 0;
    camera.position.set(0, 5, 5)
});

// CONTROL KEYS
const keysPressed = {}
const keyDisplayQueue = new KeyDisplay();
document.addEventListener('keydown', (event) => {
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else {
        (keysPressed)[event.key.toLowerCase()] = true
    }
}, false);
document.addEventListener('keyup', (event) => {
    keyDisplayQueue.up(event.key);
    (keysPressed)[event.key.toLowerCase()] = false
}, false);

// Create function animation
var clock = new THREE.Clock();

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    keyDisplayQueue.updatePosition()
}
window.addEventListener('resize', onWindowResize);

function animate() {
    requestAnimationFrame(animate);

    var delta = clock.getDelta();
    if (characterControls) {
        characterControls.update(delta, keysPressed);
    }
    orbitControls.update()
        // if (mixerHologram) mixerHologram.update(delta);
    if (mixerCharater && status) { mixerCharater.update(delta); }
    // if (mixerFoutain) mixerFoutain.update(delta);
    ThreeMeshUI.update();
    mmi.update();
    camera.lookAt(scene.position);
    renderer.render(scene, camera);
}
animate();

function wrapAndRepeatTexture(map) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.x = map.repeat.y = 10;
}

// Loop for attribute of object
// scene.traverse(function(child) {
//     if (child.class === "item") {
//         child.rotation.x += num;
//         child.rotation.y += num;
//     }
// }); }
// }); }
// });