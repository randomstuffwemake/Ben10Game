import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8";

const app = new PIXI.Application({ width: 1280, height: 720 });
const alien1Texture = PIXI.Texture.from("alien1.png");
const alien2Texture = PIXI.Texture.from("alien2.png");
const textureArray = [alien1Texture, alien2Texture];
const poppedAlienTexture = PIXI.Texture.from("popped.png");
const popSound = new Audio("pop.mp3");
const scoreText = new PIXI.Text('Score: 0', {
    fontFamily: 'Barlow',
    fontSize: 40,
    fill: 0x000000,
    align: 'center',
});
const livesText = new PIXI.Text('Lives: 5', {
    fontFamily: 'Barlow',
    fontSize: 40,
    fill: 0x000000,
    align: 'center',
});
livesText.y = 45;
const leftMarkerGraphics = new PIXI.Graphics();
const rightMarkerGraphics = new PIXI.Graphics();
const backgroundMusic = new Audio('./backgroundMusic.mp3');
backgroundMusic.volume = 0.5
backgroundMusic.loop = true;

let video = document.getElementById('webcam');

document.body.appendChild(app.view);

let handLandmarker;
let leftHandObj = {
    isPinched: false,
    indexTip: {x: -1, y: -1},
    thumbTip: {x: -1, y: -1}
}
let rightHandObj = {
    isPinched: false,
    indexTip: {x: -1, y: -1},
    thumbTip: {x: -1, y: -1}
}
let lastVideoTime = -1;
let aliens = [];
let leftPinchedFlag = false;
let rightPinchedFlag = false;
let isLeftHand = false;
let isRightHand = false;
let leftIndex = 0;
let rightIndex = 0;

let score = 0;
let prvsScore = 0;
let speed = 4.0;
let lives = 5;

async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
    });
}

setup();    

function setup() {
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }).then(function (stream) {
        video.srcObject = stream;
        video.play();
        video.onplay = function () {
            const videoTexture = PIXI.Texture.from(video);
            const videoSprite = new PIXI.Sprite(videoTexture);
            videoSprite.width = app.screen.width;
            videoSprite.height = app.screen.height;
            videoSprite.anchor.x = 1;
            videoSprite.scale.x *= -1;
            app.stage.addChildAt(videoSprite, 0);
        };
        video.addEventListener("loadeddata", async () => {
            await createHandLandmarker();
            createAliens();
            app.stage.addChild(scoreText);
            app.stage.addChild(livesText);
            app.stage.addChild(leftMarkerGraphics);
            app.stage.addChild(rightMarkerGraphics);
            backgroundMusic.play();
            app.ticker.add(delta => gameLoop(delta));
        });
    }).catch(function (err) {
        console.error("Error accessing webcam:", err);
    });
}

function calculateDistance(point1, point2) {
    return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
}

function processDetections(detections) {
    if (detections.handednesses.length) {
        const detectedHands = detections.handednesses.length;
        isLeftHand = detectedHands === 2 || detections.handednesses[0][0].index === 1;
        isRightHand = detectedHands === 2 || detections.handednesses[0][0].index === 0;
        if (detectedHands === 2) {
            [leftIndex, rightIndex] = detections.handednesses[0][0].index === 1 ? [0, 1] : [1, 0];
        }
    } else {
        isLeftHand = isRightHand = leftHandObj.isPinched = rightHandObj.isPinched = false;
    }

    function processHand(index) {
        let isPinched = false;
        const indexTip = detections.landmarks[index][8];
        const thumbTip = detections.landmarks[index][4];
        if (calculateDistance(indexTip, thumbTip) < 0.04) {
            isPinched = true;
        }
        let obj = {
            isPinched: isPinched,
            indexTip: indexTip,
            thumbTip: thumbTip
        }
        return obj;
    }

    if (isLeftHand && !isRightHand) {
        leftHandObj = processHand(0);
        rightMarkerGraphics.clear();
        leftMarkerGraphics.clear();
        leftMarkerGraphics.beginFill(0x4ce73c);
        leftMarkerGraphics.drawCircle(1280 - leftHandObj.indexTip.x * 1280, leftHandObj.indexTip.y * 720, 10);
        leftMarkerGraphics.drawCircle(1280 - leftHandObj.thumbTip.x * 1280, leftHandObj.thumbTip.y * 720, 10);
        leftMarkerGraphics.endFill();
    } else if (!isLeftHand && isRightHand) {
        rightHandObj = processHand(0);
        leftMarkerGraphics.clear();
        rightMarkerGraphics.clear();
        rightMarkerGraphics.beginFill(0x4ce73c);
        rightMarkerGraphics.drawCircle(1280 - rightHandObj.indexTip.x * 1280, rightHandObj.indexTip.y * 720, 10);
        rightMarkerGraphics.drawCircle(1280 - rightHandObj.thumbTip.x * 1280, rightHandObj.thumbTip.y * 720, 10);
        rightMarkerGraphics.endFill();
    } else if (isLeftHand && isRightHand) {
        leftHandObj = processHand(leftIndex);
        rightHandObj = processHand(rightIndex);
        leftMarkerGraphics.clear();
        leftMarkerGraphics.beginFill(0x4ce73c);
        leftMarkerGraphics.drawCircle(1280 - leftHandObj.indexTip.x * 1280, leftHandObj.indexTip.y * 720, 10);
        leftMarkerGraphics.drawCircle(1280 - leftHandObj.thumbTip.x * 1280, leftHandObj.thumbTip.y * 720, 10);
        leftMarkerGraphics.endFill();
        rightMarkerGraphics.clear();
        rightMarkerGraphics.beginFill(0x4ce73c);
        rightMarkerGraphics.drawCircle(1280 - rightHandObj.indexTip.x * 1280, rightHandObj.indexTip.y * 720, 10);
        rightMarkerGraphics.drawCircle(1280 - rightHandObj.thumbTip.x * 1280, rightHandObj.thumbTip.y * 720, 10);
        rightMarkerGraphics.endFill();
    } else {
        leftMarkerGraphics.clear();
        rightMarkerGraphics.clear();
    }

    if (leftHandObj.isPinched && !leftPinchedFlag) {
        leftPinchedFlag = true;
        const pinchedPoint = {x: (1280 - (((leftHandObj.indexTip.x + leftHandObj.thumbTip.x) / 2) * 1280)), y: (((leftHandObj.indexTip.y + leftHandObj.thumbTip.y) / 2) * 720)}
        for (let alien of aliens) {
            if (!alien.isPopped) {
                if (alien.alien.containsPoint(pinchedPoint)) {
                    alien.alien.emit('alienpop', alien);
                }
            }
        }
    } else if (leftPinchedFlag && calculateDistance(leftHandObj.indexTip, leftHandObj.thumbTip) >= 0.04) {
        leftPinchedFlag = false;
    }

    if (rightHandObj.isPinched && !rightPinchedFlag) {
        rightPinchedFlag = true;
        const pinchedPoint = {x: (1280 - (((rightHandObj.indexTip.x + rightHandObj.thumbTip.x) / 2) * 1280)), y: (((rightHandObj.indexTip.y + rightHandObj.thumbTip.y) / 2) * 720)}
        for (let alien of aliens) {
            if (!alien.isPopped) {
                if (alien.alien.containsPoint(pinchedPoint)) {
                    alien.alien.emit('alienpop', alien);
                }
            }
        }
    } else if (rightPinchedFlag && calculateDistance(rightHandObj.indexTip, rightHandObj.thumbTip) >= 0.04) {
        rightPinchedFlag = false;
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
}

function gameLoop(delta) {
    if (lives != 0) {
        if (score - prvsScore > 10) {
            prvsScore = score - 1;
            speed += 1.0;
        }
        for (let alien of aliens) {
            alien.alien.y += (delta * speed);
            if (alien.alien.y > app.screen.height) {
                if (!alien.isPopped) {
                    lives -= 1;
                    livesText.text = `Lives: ${lives}`;
                }
                alien.alien.x = getRandomInt(150, app.screen.width - 150);
                alien.alien.y = -100;
            }
        }
        let startTimeMs = performance.now();
        if (video.currentTime !== lastVideoTime) {
            const detections = handLandmarker.detectForVideo(video, startTimeMs);
            processDetections(detections);
            lastVideoTime = video.currentTime;
        }
    } else {
        leftMarkerGraphics.clear();
        rightMarkerGraphics.clear();
        backgroundMusic.pause();
        app.ticker.destroy();
    }
}

function createAliens() {
    for (let i = 0; i < 4; i++) {
        const randomTexture = textureArray[Math.floor(Math.random() * textureArray.length)];
        const alien = new PIXI.Sprite(randomTexture);
        alien.scale.set(0.5);
        alien.eventMode = 'static';
        alien.buttonMode = true;
        alien.anchor.set(0.5);
        alien.x = getRandomInt(150, app.screen.width - 150);
        alien.y = Math.random() * -app.screen.height;
        alien.on('alienpop', popAlien);
        aliens.push({alien: alien, isPopped: false});
        app.stage.addChild(alien);
    }
}

function popAlien(alien) {
    alien.alien.texture = poppedAlienTexture;
    alien.isPopped = true;
    setTimeout(() => {
        const randomTexture = textureArray[Math.floor(Math.random() * textureArray.length)];
        alien.alien.texture = randomTexture;
        alien.alien.x = getRandomInt(150, app.screen.width - 150);
        alien.alien.y = -100;
        alien.isPopped = false;
    }, 250)
    const sound = popSound.cloneNode();
    sound.play();
    score += 1;
    scoreText.text = `Score: ${score}`;
}