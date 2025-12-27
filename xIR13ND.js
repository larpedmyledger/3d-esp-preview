let scene, camera, renderer, controls;
let model = null;
let autoRotate = false;
let directionalLight;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let activeAxis = null;
let gizmoLines = [];

const espCanvas = document.getElementById('espCanvas');
const espCtx = espCanvas.getContext('2d');
espCanvas.width = window.innerWidth;
espCanvas.height = window.innerHeight;

let mouseX = espCanvas.width / 2;
let mouseY = espCanvas.height / 2;

let currentHealth = 100;
let healthAnimationDirection = -1;
const healthAnimationSpeed = 0.5;

const espOptions = {
    box: true,
    boxType: 0,
    boxFilled: false,
    boxColor: '#7b68ee',
    boxFillColor: '#7b68ee',
    name: true,
    nameColor: '#ffffff',
    distance: true,
    distanceColor: '#aaaaaa',
    health: true,
    skeleton: true,
    skeletonColor: '#ffffff',
    tracers: true,
    tracerColor: '#7b68ee',
    tracerStart: 0,
    chineseHat: false,
    chineseHatColor: '#ffffff'
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 3, 3);
    
    const canvas = document.getElementById('modelViewer');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enabled = true;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-5, 0, -5);
    scene.add(fillLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(0, 5, -10);
    scene.add(backLight);
    
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener('resize', () => {
        requestAnimationFrame(onWindowResize);
    });
    
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            requestAnimationFrame(onWindowResize);
        }, 100);
    });
    
    document.addEventListener('fullscreenchange', () => {
        setTimeout(() => {
            requestAnimationFrame(onWindowResize);
        }, 100);
    });
    
    autoLoadModel();
    
    animate();
    
    setTimeout(() => {
        const intro = document.getElementById('intro');
        intro.style.opacity = '0';
        setTimeout(() => {
            intro.style.display = 'none';
        }, 700);
    }, 4000);
}

function autoLoadModel() {
    const message = document.getElementById('message');
    message.textContent = 'Loading model...';
    message.classList.remove('hidden');
    
    const loader = new THREE.GLTFLoader();
    
    const modelPath = 'model/nigga.glb';
    
    loader.load(
        modelPath,
        function(gltf) {
            if (model) scene.remove(model);
            
            model = gltf.scene;
            scene.add(model);
            
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            model.position.x -= center.x;
            model.position.z -= center.z;
            
            box.setFromObject(model);
            model.position.y -= box.min.y;
            
            createGrid(0);
            
            box.setFromObject(model);
            const newCenter = box.getCenter(new THREE.Vector3());
            const newSize = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(newSize.x, newSize.y, newSize.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / Math.sin(fov / 2)) * 1.5;
            
            camera.position.set(cameraZ, cameraZ * 0.7, cameraZ);
            controls.target.copy(newCenter);
            controls.update();
            
            onWindowResize();
            
            message.classList.add('hidden');
        },
        function(xhr) {
            const percent = (xhr.loaded / xhr.total * 100).toFixed(2);
            message.textContent = `Loading model... ${percent}%`;
        },
        function(error) {
            message.textContent = 'Error loading model: ' + error.message;
            console.error('Error loading model:', error);
        }
    );
}
    
function createGrid(yPosition) {
    const existingGrid = scene.getObjectByName('baseplate');
    if (existingGrid) scene.remove(existingGrid);
    
    const gridSize = 50;
    const divisions = 50;
    const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x666666, 0x333333);
    gridHelper.position.y = yPosition;
    gridHelper.name = 'baseplate';
    scene.add(gridHelper);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (autoRotate && model) {
        model.rotation.y += 0.01;
    }
    
    updateHealthAnimation();
    
    controls.update();
    
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    if (width !== window.innerWidth || height !== window.innerHeight) {
        onWindowResize();
    }
    
    renderer.render(scene, camera);
    
    drawESP();
}

function updateHealthAnimation() {
    const progress = (currentHealth - 50) / 50;
    const easing = 1 - Math.abs(progress);
    
    const speed = healthAnimationSpeed * (0.3 + easing * 0.7);
    
    currentHealth += healthAnimationDirection * speed;
    
    if (currentHealth <= 0) {
        currentHealth = 0;
        if (Math.random() < 0.02) {
            healthAnimationDirection = 1;
        }
    } else if (currentHealth >= 100) {
        currentHealth = 100;
        if (Math.random() < 0.02) {
            healthAnimationDirection = -1;
        }
    }
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawESP() {
    espCtx.clearRect(0, 0, espCanvas.width, espCanvas.height);
    
    if (!model) return;

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const screenPos = worldToScreen(center);
    if (!screenPos) return;

    const topPos = worldToScreen(new THREE.Vector3(center.x, box.max.y, center.z));
    const bottomPos = worldToScreen(new THREE.Vector3(center.x, box.min.y, center.z));
    const leftPos = worldToScreen(new THREE.Vector3(box.min.x, center.y, center.z));
    const rightPos = worldToScreen(new THREE.Vector3(box.max.x, center.y, center.z));

    if (!topPos || !bottomPos || !leftPos || !rightPos) return;

    const boxHeight = Math.abs(bottomPos.y - topPos.y);
    const boxWidth = Math.abs(rightPos.x - leftPos.x);
    
    const left = screenPos.x - boxWidth / 2;
    const right = screenPos.x + boxWidth / 2;
    const top = topPos.y;
    const bottom = bottomPos.y;

    const scale = boxHeight / 100;

    if (espOptions.tracers) drawTracers(screenPos);
    if (espOptions.box) drawBox(left, top, right, bottom);
    if (espOptions.skeleton) drawSkeleton(box, screenPos, scale, top, bottom);
    if (espOptions.health) drawHealthBar(left, top, bottom, boxHeight);
    if (espOptions.name) drawName(screenPos, top, scale);
    if (espOptions.distance) drawDistance(screenPos, bottom, scale);
    if (espOptions.chineseHat) drawChineseHat(screenPos, top, boxWidth, boxHeight);
}

function worldToScreen(position) {
    const vector = position.clone();
    vector.project(camera);

    const x = (vector.x + 1) / 2 * espCanvas.width;
    const y = -(vector.y - 1) / 2 * espCanvas.height;
    const z = vector.z;

    if (z > 1) return null;

    return { x, y, z };
}

function drawBox(left, top, right, bottom) {
    const width = right - left;
    const height = bottom - top;
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    if (espOptions.boxType === 0) {
        if (espOptions.boxFilled) {
            espCtx.fillStyle = hexToRgba(espOptions.boxFillColor, 0.25);
            espCtx.fillRect(left, top, width, height);
        }
        espCtx.strokeStyle = '#000';
        espCtx.lineWidth = 3.5;
        espCtx.strokeRect(left, top, width, height);
        espCtx.strokeStyle = espOptions.boxColor;
        espCtx.lineWidth = 2;
        espCtx.strokeRect(left, top, width, height);
        
    } else if (espOptions.boxType === 1) {
        if (espOptions.boxFilled) {
            espCtx.fillStyle = hexToRgba(espOptions.boxFillColor, 0.25);
            espCtx.fillRect(left, top, width, height);
        }
        
        const gradient = espCtx.createRadialGradient(
            centerX, centerY, Math.min(width, height) * 0.3,
            centerX, centerY, Math.min(width, height) * 0.8
        );
        
        const mainColor = espOptions.boxColor;
        const r = parseInt(mainColor.slice(1, 3), 16);
        const g = parseInt(mainColor.slice(3, 5), 16);
        const b = parseInt(mainColor.slice(5, 7), 16);
        
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.4)`);
        gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.2)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        espCtx.fillStyle = gradient;
        espCtx.fillRect(
            left - width * 0.3, 
            top - height * 0.3, 
            width * 1.6, 
            height * 1.6
        );
        
        const glowSteps = 15;
        const maxGlowSpread = Math.min(width, height) * 0.4;
        
        for (let i = glowSteps; i > 0; i--) {
            const progress = i / glowSteps;
            const glowSpread = maxGlowSpread * progress;
            const alpha = 0.15 * (1 - progress) * (1 - progress);
            
            espCtx.strokeStyle = hexToRgba(espOptions.boxColor, alpha);
            espCtx.lineWidth = 2 + (4 * progress);
            
            const currentLeft = left - glowSpread;
            const currentTop = top - glowSpread;
            const currentWidth = width + glowSpread * 2;
            const currentHeight = height + glowSpread * 2;
            const borderRadius = glowSpread * 0.5;
            
            drawRoundedRect(espCtx, currentLeft, currentTop, currentWidth, currentHeight, borderRadius);
            espCtx.stroke();
        }
        
        espCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        espCtx.lineWidth = 4;
        espCtx.strokeRect(left - 1, top - 1, width + 2, height + 2);
        
        espCtx.strokeStyle = espOptions.boxColor;
        espCtx.lineWidth = 2.5;
        espCtx.strokeRect(left, top, width, height);
        
        espCtx.strokeStyle = hexToRgba(espOptions.boxColor, 0.6);
        espCtx.lineWidth = 1;
        espCtx.strokeRect(left + 2, top + 2, width - 4, height - 4);
        
        const cornerGlowSize = 3;
        espCtx.fillStyle = hexToRgba(espOptions.boxColor, 0.9);
        
        espCtx.fillRect(left - cornerGlowSize, top - cornerGlowSize, cornerGlowSize * 2, cornerGlowSize * 2);
        espCtx.fillRect(right - cornerGlowSize, top - cornerGlowSize, cornerGlowSize * 2, cornerGlowSize * 2);
        espCtx.fillRect(right - cornerGlowSize, bottom - cornerGlowSize, cornerGlowSize * 2, cornerGlowSize * 2);
        espCtx.fillRect(left - cornerGlowSize, bottom - cornerGlowSize, cornerGlowSize * 2, cornerGlowSize * 2);
        
        const pulse = (Math.sin(Date.now() * 0.005) + 1) * 0.5;
        const pulseAlpha = 0.1 + pulse * 0.1;
        
        espCtx.strokeStyle = hexToRgba(espOptions.boxColor, pulseAlpha);
        espCtx.lineWidth = 1;
        espCtx.strokeRect(
            left - maxGlowSpread * 0.2, 
            top - maxGlowSpread * 0.2, 
            width + maxGlowSpread * 0.4, 
            height + maxGlowSpread * 0.4
        );
        
    } else if (espOptions.boxType === 2) {
        const cornerSize = Math.min(15, width * 0.15, height * 0.15);
        
        if (espOptions.boxFilled) {
            espCtx.fillStyle = hexToRgba(espOptions.boxFillColor, 0.25);
            espCtx.fillRect(left, top, width, height);
        }
        
        espCtx.strokeStyle = '#000';
        espCtx.lineWidth = 3.5;
        drawCorners(left, top, right, bottom, cornerSize);
        
        espCtx.strokeStyle = espOptions.boxColor;
        espCtx.lineWidth = 2;
        drawCorners(left, top, right, bottom, cornerSize);
        
    } else if (espOptions.boxType === 3) {
        draw3DBox();
    }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawCorners(left, top, right, bottom, size) {
    const cornerGlow = hexToRgba(espOptions.boxColor, 0.3);
    
    espCtx.strokeStyle = cornerGlow;
    espCtx.lineWidth = 4;
    drawCornerLines(left, top, right, bottom, size + 1);
    
    espCtx.strokeStyle = espOptions.boxColor;
    espCtx.lineWidth = 2;
    drawCornerLines(left, top, right, bottom, size);
}

function drawCornerLines(left, top, right, bottom, size) {
    espCtx.beginPath();
    espCtx.moveTo(left, top + size);
    espCtx.lineTo(left, top);
    espCtx.lineTo(left + size, top);
    espCtx.moveTo(right - size, top);
    espCtx.lineTo(right, top);
    espCtx.lineTo(right, top + size);
    espCtx.moveTo(right, bottom - size);
    espCtx.lineTo(right, bottom);
    espCtx.lineTo(right - size, bottom);
    espCtx.moveTo(left + size, bottom);
    espCtx.lineTo(left, bottom);
    espCtx.lineTo(left, bottom - size);
    espCtx.stroke();
}

function drawSkeleton(box, screen, scale, top, bottom) {
    const min = box.min;
    const max = box.max;
    const center = box.getCenter(new THREE.Vector3());
    
    const headPos = new THREE.Vector3(center.x, max.y, center.z);
    const neckPos = new THREE.Vector3(center.x, min.y + (max.y - min.y) * 0.85, center.z);
    const spineTopPos = new THREE.Vector3(center.x, min.y + (max.y - min.y) * 0.75, center.z);
    const spineMidPos = new THREE.Vector3(center.x, min.y + (max.y - min.y) * 0.6, center.z);
    const spineBottomPos = new THREE.Vector3(center.x, min.y + (max.y - min.y) * 0.45, center.z);
    const hipPos = new THREE.Vector3(center.x, min.y + (max.y - min.y) * 0.3, center.z);
    
    const shoulderWidth = (max.x - min.x) * 0.4;
    const leftShoulderPos = new THREE.Vector3(center.x - shoulderWidth/2, min.y + (max.y - min.y) * 0.75, center.z);
    const rightShoulderPos = new THREE.Vector3(center.x + shoulderWidth/2, min.y + (max.y - min.y) * 0.75, center.z);
    
    const leftElbowPos = new THREE.Vector3(center.x - shoulderWidth/2 - (max.x - min.x) * 0.15, min.y + (max.y - min.y) * 0.6, center.z + (max.z - min.z) * 0.1);
    const rightElbowPos = new THREE.Vector3(center.x + shoulderWidth/2 + (max.x - min.x) * 0.15, min.y + (max.y - min.y) * 0.6, center.z + (max.z - min.z) * 0.1);
    
    const leftHandPos = new THREE.Vector3(center.x - shoulderWidth/2 - (max.x - min.x) * 0.25, min.y + (max.y - min.y) * 0.45, center.z + (max.z - min.z) * 0.15);
    const rightHandPos = new THREE.Vector3(center.x + shoulderWidth/2 + (max.x - min.x) * 0.25, min.y + (max.y - min.y) * 0.45, center.z + (max.z - min.z) * 0.15);
    
    const leftHipPos = new THREE.Vector3(center.x - (max.x - min.x) * 0.15, min.y + (max.y - min.y) * 0.3, center.z);
    const rightHipPos = new THREE.Vector3(center.x + (max.x - min.x) * 0.15, min.y + (max.y - min.y) * 0.3, center.z);
    
    const leftKneePos = new THREE.Vector3(center.x - (max.x - min.x) * 0.15, min.y + (max.y - min.y) * 0.15, center.z);
    const rightKneePos = new THREE.Vector3(center.x + (max.x - min.x) * 0.15, min.y + (max.y - min.y) * 0.15, center.z);
    
    const leftFootPos = new THREE.Vector3(center.x - (max.x - min.x) * 0.15, min.y, center.z);
    const rightFootPos = new THREE.Vector3(center.x + (max.x - min.x) * 0.15, min.y, center.z);

    const head = worldToScreen(headPos);
    const neck = worldToScreen(neckPos);
    const spineTop = worldToScreen(spineTopPos);
    const spineMid = worldToScreen(spineMidPos);
    const spineBottom = worldToScreen(spineBottomPos);
    const hip = worldToScreen(hipPos);
    
    const leftShoulder = worldToScreen(leftShoulderPos);
    const rightShoulder = worldToScreen(rightShoulderPos);
    
    const leftElbow = worldToScreen(leftElbowPos);
    const rightElbow = worldToScreen(rightElbowPos);
    
    const leftHand = worldToScreen(leftHandPos);
    const rightHand = worldToScreen(rightHandPos);
    
    const leftHip = worldToScreen(leftHipPos);
    const rightHip = worldToScreen(rightHipPos);
    
    const leftKnee = worldToScreen(leftKneePos);
    const rightKnee = worldToScreen(rightKneePos);
    
    const leftFoot = worldToScreen(leftFootPos);
    const rightFoot = worldToScreen(rightFootPos);

    espCtx.strokeStyle = '#000';
    espCtx.lineWidth = 3;
    
    if (head && neck) drawLine(head, neck);
    
    if (neck && spineTop) drawLine(neck, spineTop);
    if (spineTop && spineMid) drawLine(spineTop, spineMid);
    if (spineMid && spineBottom) drawLine(spineMid, spineBottom);
    if (spineBottom && hip) drawLine(spineBottom, hip);
    
    if (spineTop && leftShoulder) drawLine(spineTop, leftShoulder);
    if (leftShoulder && leftElbow) drawLine(leftShoulder, leftElbow);
    if (leftElbow && leftHand) drawLine(leftElbow, leftHand);
    
    if (spineTop && rightShoulder) drawLine(spineTop, rightShoulder);
    if (rightShoulder && rightElbow) drawLine(rightShoulder, rightElbow);
    if (rightElbow && rightHand) drawLine(rightElbow, rightHand);
    
    if (hip && leftHip) drawLine(hip, leftHip);
    if (leftHip && leftKnee) drawLine(leftHip, leftKnee);
    if (leftKnee && leftFoot) drawLine(leftKnee, leftFoot);
    
    if (hip && rightHip) drawLine(hip, rightHip);
    if (rightHip && rightKnee) drawLine(rightHip, rightKnee);
    if (rightKnee && rightFoot) drawLine(rightKnee, rightFoot);
    
    espCtx.strokeStyle = espOptions.skeletonColor;
    espCtx.lineWidth = 1.5;
    
    if (head && neck) drawLine(head, neck);
    
    if (neck && spineTop) drawLine(neck, spineTop);
    if (spineTop && spineMid) drawLine(spineTop, spineMid);
    if (spineMid && spineBottom) drawLine(spineMid, spineBottom);
    if (spineBottom && hip) drawLine(spineBottom, hip);
    
    if (spineTop && leftShoulder) drawLine(spineTop, leftShoulder);
    if (leftShoulder && leftElbow) drawLine(leftShoulder, leftElbow);
    if (leftElbow && leftHand) drawLine(leftElbow, leftHand);
    
    if (spineTop && rightShoulder) drawLine(spineTop, rightShoulder);
    if (rightShoulder && rightElbow) drawLine(rightShoulder, rightElbow);
    if (rightElbow && rightHand) drawLine(rightElbow, rightHand);
    
    if (hip && leftHip) drawLine(hip, leftHip);
    if (leftHip && leftKnee) drawLine(leftHip, leftKnee);
    if (leftKnee && leftFoot) drawLine(leftKnee, leftFoot);
    
    if (hip && rightHip) drawLine(hip, rightHip);
    if (rightHip && rightKnee) drawLine(rightHip, rightKnee);
    if (rightKnee && rightFoot) drawLine(rightKnee, rightFoot);
}

function drawLine(point1, point2) {
    espCtx.beginPath();
    espCtx.moveTo(point1.x, point1.y);
    espCtx.lineTo(point2.x, point2.y);
    espCtx.stroke();
}

function drawTracers(screen) {
    let startX, startY;
    if (espOptions.tracerStart === 0) {
        startX = espCanvas.width / 2;
        startY = espCanvas.height;
    } else if (espOptions.tracerStart === 1) {
        startX = espCanvas.width / 2;
        startY = 0;
    } else if (espOptions.tracerStart === 2) {
        startX = mouseX;
        startY = mouseY;
    } else {
        startX = espCanvas.width / 2;
        startY = espCanvas.height / 2;
    }

    espCtx.strokeStyle = '#000';
    espCtx.lineWidth = 3.5;
    espCtx.beginPath();
    espCtx.moveTo(startX, startY);
    espCtx.lineTo(screen.x, screen.y);
    espCtx.stroke();

    espCtx.strokeStyle = espOptions.tracerColor;
    espCtx.lineWidth = 2;
    espCtx.beginPath();
    espCtx.moveTo(startX, startY);
    espCtx.lineTo(screen.x, screen.y);
    espCtx.stroke();
}

function drawHealthBar(left, top, bottom, boxHeight) {
    const barWidth = 4;
    const healthPercent = Math.max(0, Math.min(1, currentHealth / 100));

    espCtx.fillStyle = 'rgba(50, 50, 50, 0.8)';
    espCtx.fillRect(left - barWidth - 2, top, barWidth, boxHeight);

    let r, g;
    if (healthPercent > 0.5) {
        r = Math.floor(255 * ((1 - healthPercent) * 2));
        g = 255;
    } else {
        r = 255;
        g = Math.floor(255 * (healthPercent * 2));
    }
    
    espCtx.fillStyle = `rgb(${r}, ${g}, 0)`;

    const healthBarHeight = boxHeight * healthPercent;
    espCtx.fillRect(left - barWidth - 2, bottom - healthBarHeight, barWidth, healthBarHeight);

    espCtx.strokeStyle = '#000';
    espCtx.lineWidth = 1;
    espCtx.strokeRect(left - barWidth - 2, top, barWidth, boxHeight);
}

function drawName(screen, top, scale) {
    espCtx.font = `${14 * scale}px -apple-system, sans-serif`;
    espCtx.textAlign = 'center';

    espCtx.strokeStyle = '#000';
    espCtx.lineWidth = 3;
    espCtx.strokeText('Model', screen.x, top - 10 * scale);
    espCtx.fillStyle = espOptions.nameColor;
    espCtx.fillText('Model', screen.x, top - 10 * scale);
}

function drawDistance(screen, bottom, scale) {
    const dist = Math.floor(camera.position.distanceTo(new THREE.Vector3(0, 0, 0)));
    espCtx.font = `${12 * scale}px -apple-system, sans-serif`;
    espCtx.textAlign = 'center';

    espCtx.strokeStyle = '#000';
    espCtx.lineWidth = 3;
    espCtx.strokeText(`[${dist}m]`, screen.x, bottom + 20 * scale);
    espCtx.fillStyle = espOptions.distanceColor;
    espCtx.fillText(`[${dist}m]`, screen.x, bottom + 20 * scale);
}

function draw3DBox() {
    if (!model) return;
    
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const min = box.min;
    const max = box.max;
    
    const corners3D = [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z),
        new THREE.Vector3(min.x, max.y, max.z)
    ];

    const screenCorners = corners3D.map(corner => {
        return worldToScreen(corner);
    }).filter(pos => pos !== null);

    if (screenCorners.length < 8) return;

    const edges = [
        [0,1],[1,2],[2,3],[3,0],
        [4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7]
    ];
    
    if (espOptions.boxFilled) {
        espCtx.fillStyle = hexToRgba(espOptions.boxFillColor, 0.15);
        
        if (screenCorners[0] && screenCorners[1] && screenCorners[5] && screenCorners[4]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[0].x, screenCorners[0].y);
            espCtx.lineTo(screenCorners[1].x, screenCorners[1].y);
            espCtx.lineTo(screenCorners[5].x, screenCorners[5].y);
            espCtx.lineTo(screenCorners[4].x, screenCorners[4].y);
            espCtx.closePath();
            espCtx.fill();
        }
        
        if (screenCorners[2] && screenCorners[3] && screenCorners[7] && screenCorners[6]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[2].x, screenCorners[2].y);
            espCtx.lineTo(screenCorners[3].x, screenCorners[3].y);
            espCtx.lineTo(screenCorners[7].x, screenCorners[7].y);
            espCtx.lineTo(screenCorners[6].x, screenCorners[6].y);
            espCtx.closePath();
            espCtx.fill();
        }
        
        if (screenCorners[4] && screenCorners[5] && screenCorners[6] && screenCorners[7]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[4].x, screenCorners[4].y);
            espCtx.lineTo(screenCorners[5].x, screenCorners[5].y);
            espCtx.lineTo(screenCorners[6].x, screenCorners[6].y);
            espCtx.lineTo(screenCorners[7].x, screenCorners[7].y);
            espCtx.closePath();
            espCtx.fill();
        }
        
        if (screenCorners[0] && screenCorners[1] && screenCorners[2] && screenCorners[3]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[0].x, screenCorners[0].y);
            espCtx.lineTo(screenCorners[1].x, screenCorners[1].y);
            espCtx.lineTo(screenCorners[2].x, screenCorners[2].y);
            espCtx.lineTo(screenCorners[3].x, screenCorners[3].y);
            espCtx.closePath();
            espCtx.fill();
        }
        
        if (screenCorners[0] && screenCorners[3] && screenCorners[7] && screenCorners[4]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[0].x, screenCorners[0].y);
            espCtx.lineTo(screenCorners[3].x, screenCorners[3].y);
            espCtx.lineTo(screenCorners[7].x, screenCorners[7].y);
            espCtx.lineTo(screenCorners[4].x, screenCorners[4].y);
            espCtx.closePath();
            espCtx.fill();
        }
        
        if (screenCorners[1] && screenCorners[2] && screenCorners[6] && screenCorners[5]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[1].x, screenCorners[1].y);
            espCtx.lineTo(screenCorners[2].x, screenCorners[2].y);
            espCtx.lineTo(screenCorners[6].x, screenCorners[6].y);
            espCtx.lineTo(screenCorners[5].x, screenCorners[5].y);
            espCtx.closePath();
            espCtx.fill();
        }
    }
    
    espCtx.strokeStyle = '#000';
    espCtx.lineWidth = 3;
    edges.forEach(([a, b]) => {
        if (screenCorners[a] && screenCorners[b]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[a].x, screenCorners[a].y);
            espCtx.lineTo(screenCorners[b].x, screenCorners[b].y);
            espCtx.stroke();
        }
    });

    espCtx.strokeStyle = espOptions.boxColor;
    espCtx.lineWidth = 2;
    edges.forEach(([a, b]) => {
        if (screenCorners[a] && screenCorners[b]) {
            espCtx.beginPath();
            espCtx.moveTo(screenCorners[a].x, screenCorners[a].y);
            espCtx.lineTo(screenCorners[b].x, screenCorners[b].y);
            espCtx.stroke();
        }
    });
}

function drawChineseHat(screen, top, width, height) {
    if (!model) return;
    
    const box = new THREE.Box3().setFromObject(model);
    const headPos3D = new THREE.Vector3(
        box.getCenter(new THREE.Vector3()).x,
        box.max.y,
        box.getCenter(new THREE.Vector3()).z
    );
    
    const hatTopCenter = new THREE.Vector3(headPos3D.x, headPos3D.y + 0.2, headPos3D.z);
    const hatBaseCenter = new THREE.Vector3(headPos3D.x, headPos3D.y - 0.3, headPos3D.z);

    const hatTopRadius = 0.2;
    const brimRadius = 1.5;
    const segments = 16;

    const topPoints3D = [];
    const brimPoints3D = [];

    for (let i = 0; i <= segments; i++) {
        const angle = (i * 2 * Math.PI) / segments;

        const topPoint = new THREE.Vector3(
            hatTopCenter.x + Math.cos(angle) * hatTopRadius,
            hatTopCenter.y,
            hatTopCenter.z + Math.sin(angle) * hatTopRadius
        );
        topPoints3D.push(topPoint);

        const brimPoint = new THREE.Vector3(
            hatBaseCenter.x + Math.cos(angle) * brimRadius,
            hatBaseCenter.y - 0.1,
            hatBaseCenter.z + Math.sin(angle) * brimRadius
        );
        brimPoints3D.push(brimPoint);
    }

    const topPoints2D = [];
    const brimPoints2D = [];

    for (let point of topPoints3D) {
        const screenPoint = worldToScreen(point);
        if (screenPoint) topPoints2D.push(screenPoint);
    }

    for (let point of brimPoints3D) {
        const screenPoint = worldToScreen(point);
        if (screenPoint) brimPoints2D.push(screenPoint);
    }

    if (topPoints2D.length > 1 && brimPoints2D.length > 1) {
        espCtx.strokeStyle = hexToRgba(espOptions.chineseHatColor, 0.8);
        espCtx.lineWidth = 1;

        for (let i = 0; i < topPoints2D.length - 1; i++) {
            espCtx.beginPath();
            espCtx.moveTo(topPoints2D[i].x, topPoints2D[i].y);
            espCtx.lineTo(brimPoints2D[i].x, brimPoints2D[i].y);
            espCtx.stroke();
        }

        espCtx.strokeStyle = hexToRgba(espOptions.chineseHatColor, 0.9);
        espCtx.lineWidth = 1.5;
        espCtx.beginPath();
        for (let i = 0; i < topPoints2D.length; i++) {
            if (i === 0) espCtx.moveTo(topPoints2D[i].x, topPoints2D[i].y);
            else espCtx.lineTo(topPoints2D[i].x, topPoints2D[i].y);
        }
        espCtx.stroke();

        espCtx.strokeStyle = hexToRgba(espOptions.chineseHatColor, 0.9);
        espCtx.lineWidth = 1.5;
        espCtx.beginPath();
        for (let i = 0; i < brimPoints2D.length; i++) {
            if (i === 0) espCtx.moveTo(brimPoints2D[i].x, brimPoints2D[i].y);
            else espCtx.lineTo(brimPoints2D[i].x, brimPoints2D[i].y);
        }
        espCtx.stroke();
    }
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, true);
    
    espCanvas.width = width;
    espCanvas.height = height;
    
    mouseX = width / 2;
    mouseY = height / 2;
    
    controls.update();
}

function onMouseDown(event) {
    const rect = espCanvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    
    if (!activeAxis || !model) return;
    isDragging = true;
    controls.enabled = false;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseMove(event) {
    const rect = espCanvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    
    if (!isDragging || !activeAxis || !model) return;
    
    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;
    
    const movementSpeed = 0.01;
    
    if (activeAxis === 'x') {
        model.position.x += deltaX * movementSpeed;
    } else if (activeAxis === 'y') {
        model.position.y -= deltaY * movementSpeed;
    } else if (activeAxis === 'z') {
        model.position.z += (deltaX - deltaY) * movementSpeed * 0.5;
    }
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

function onMouseUp(event) {
    const rect = espCanvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    
    isDragging = false;
    if (!activeAxis) {
        controls.enabled = true;
    }
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = espCanvas.getBoundingClientRect();
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
        
        previousMousePosition = {
            x: touch.clientX,
            y: touch.clientY
        };
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        const rect = espCanvas.getBoundingClientRect();
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
    }
}

function onTouchEnd(event) {
    event.preventDefault();
}

// Event listeners for UI controls
document.querySelectorAll('.checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', () => {
        checkbox.classList.toggle('checked');
        if (espOptions.hasOwnProperty(checkbox.id)) {
            espOptions[checkbox.id] = checkbox.classList.contains('checked');
        }
    });
});

document.querySelectorAll('.color-picker').forEach(picker => {
    picker.addEventListener('input', (e) => {
        espOptions[e.target.id] = e.target.value;
    });
});

document.getElementById('boxType').addEventListener('change', (e) => {
    espOptions.boxType = parseInt(e.target.value);
});

document.getElementById('tracerStart').addEventListener('change', (e) => {
    espOptions.tracerStart = parseInt(e.target.value);
});

document.querySelectorAll('.section-title').forEach(title => {
    title.addEventListener('click', () => {
        title.parentElement.classList.toggle('expanded');
    });
});

window.addEventListener('load', () => {
    init();
});