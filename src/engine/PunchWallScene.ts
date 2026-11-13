import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { PunchAudioEngine } from '../audio/PunchAudioEngine';
import {
  getBagById,
  getBagColorPreset,
  getGloveById,
  getGloveColorPreset,
  getSkinTonePreset,
  getWallSpecForStage,
} from '../constants/gameData';
import type {
  BagStyleVariant,
  GloveDefinition,
  GloveStyleVariant,
  GraphicsQuality,
  TargetMode,
  WallMaterialKind,
} from '../types/game';
import {
  createArenaFloorMaps,
  createBagMaps,
  createGloveMaps,
  createSkinArmMaps,
  createWallMaterialMaps,
  type SurfaceMaps,
  type WallMaterialMaps,
} from './proceduralTextures';

interface PooledDebris {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  ax: number;
  ay: number;
  az: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  life: number;
  maxLife: number;
}

interface PooledSpark {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  scale: number;
  life: number;
  maxLife: number;
}

interface PooledShockRing {
  active: boolean;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface WallBlockState {
  col: number;
  row: number;
  layer: 0 | 1; // 0 = front face, 1 = rear core
  baseX: number;
  baseY: number;
  baseZ: number;
  hp: number; // 1.0 -> 0.0
  broken: boolean;
  recessZ: number;
  tiltX: number;
  tiltY: number;
}

interface ArmModel {
  root: THREE.Group;
  wristGroup: THREE.Group;
  gloveMesh: THREE.Mesh;
  dorsalPlate: THREE.Mesh;
  boxingShell: THREE.Group;
  cuffMesh: THREE.Mesh;
  wristStrap: THREE.Mesh;
  wristBuckle: THREE.Mesh;
  knuckleMesh: THREE.Mesh;
  knuckleCaps: THREE.Group;
  fingerGroup: THREE.Group;
  wrapBands: THREE.Group;
  brassSpikes: THREE.Group;
  robotParts: THREE.Group;
  robotPistons: THREE.Mesh[];
  flamingPlates: THREE.Group;
  diamondSpikes: THREE.Group;
  plasmaCoils: THREE.Group;
  celestialCrown: THREE.Group;
  thumbMesh: THREE.Group;
  forearmMesh: THREE.Mesh;
  forearmSleeve: THREE.Mesh;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  targetOffsetX: number;
  targetOffsetY: number;
  targetApexZ: number;
  targetYaw: number;
  targetPitch: number;
  impactWorldX: number;
  impactWorldY: number;
  punchProgress: number;
  isCritSwing: boolean;
  isWeakSpotSwing: boolean;
  hitTriggered: boolean;
}

export interface SceneCallbacks {
  onPunchHit: (
    target: TargetMode,
    isCrit: boolean,
    screenXPercent: number,
    screenYPercent: number,
    isWeakSpot: boolean,
    chunksBroken: number
  ) => void;
  onWallBreakTransitionComplete: () => void;
}

// Pre-allocated math scratch objects for zero-GC render loop
const _vec3 = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _color = new THREE.Color();
const _mouse = new THREE.Vector2();

const WALL_COLS = 9;
const WALL_ROWS = 6;
const WALL_LAYERS = 2;
const TOTAL_WALL_BLOCKS = WALL_COLS * WALL_ROWS * WALL_LAYERS;
const WALL_WIDTH = 5.1;
const WALL_HEIGHT = 4.0;
const WALL_BOTTOM_Y = 0.08;
const BLOCK_W = WALL_WIDTH / WALL_COLS;
const BLOCK_H = WALL_HEIGHT / WALL_ROWS;
const BLOCK_D = 0.285;

const MAX_DEBRIS = 220;
const MAX_SPARKS = 140;
const MAX_RINGS = 10;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export class PunchWallScene {
  private container: HTMLElement;
  private audio: PunchAudioEngine;
  private callbacks: SceneCallbacks;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraRig: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;

  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  // First-person POV arms
  private leftArm!: ArmModel;
  private rightArm!: ArmModel;
  private nextIsRight = true;
  private currentGloveStyle: GloveStyleVariant = 'wraps';
  private gloveMaterial!: THREE.MeshPhysicalMaterial;
  private knuckleMaterial!: THREE.MeshPhysicalMaterial;
  private cuffMaterial!: THREE.MeshStandardMaterial;
  private trimMaterial!: THREE.MeshStandardMaterial;
  private seamMaterial!: THREE.MeshStandardMaterial;
  private skinMaterial!: THREE.MeshStandardMaterial;
  private gloveMaps!: { map: THREE.CanvasTexture; normalMap: THREE.DataTexture };
  private skinMaps!: { map: THREE.CanvasTexture; normalMap: THREE.DataTexture };
  private emberSpawnTimer = 0;
  private auraAudioTimer = 0;

  // Post-processing Depth of Field (GPU only)
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bokehPass: BokehPass | null = null;
  private outputPass: OutputPass | null = null;
  private dofEnabled = true;
  private graphicsQuality: GraphicsQuality = 'high';
  private paused = false;
  private shakeMultiplier = 1.0;

  // Destructible grid-block wall assembly
  private wallGroup!: THREE.Group;
  private wallInstancedMesh!: THREE.InstancedMesh;
  private wallBlockStates: WallBlockState[] = [];
  private wallDamageAttr!: THREE.InstancedBufferAttribute;
  private wallHitPlane!: THREE.Mesh;
  private wallMaterial!: THREE.MeshPhysicalMaterial;
  private wallMapCache = new Map<WallMaterialKind, WallMaterialMaps>();
  private floorMaps!: SurfaceMaps;
  private currentMaterialKind: WallMaterialKind = 'drywall';
  private currentWallMaxHp = 65;
  private estimatedBasePower = 5;
  private estimatedWeakSpotMult = 3.5;

  // 3D Splash-Damage Area Reticle on wall
  private splashReticleGroup!: THREE.Group;
  private splashOuterRingMat!: THREE.MeshBasicMaterial;
  private splashFillMat!: THREE.MeshBasicMaterial;
  private splashCenterMat!: THREE.MeshBasicMaterial;
  private effectiveSplashRadius = 0.88;
  private isHoveringWeakSpot = false;

  // Active Weak Spot event
  private weakSpotGroup!: THREE.Group;
  private weakSpotHitbox!: THREE.Mesh;
  private weakSpotRing!: THREE.Mesh;
  private weakSpotCore!: THREE.Mesh;
  private weakSpotActive = false;
  private weakSpotTimer = 6.0;
  private weakSpotLife = 0;
  private weakSpotScale = 0;
  private weakSpotPos = new THREE.Vector2(0, 1.85);
  private weakSpotCooldownReduction = 0;

  // Heavy Bag assembly (customizable)
  private bagPivot!: THREE.Group;
  private bagBodyMesh!: THREE.Mesh;
  private bagStudsGroup!: THREE.Group;
  private bagAuraRing!: THREE.Mesh;
  private bagMaterial!: THREE.MeshPhysicalMaterial;
  private bagStrapMaterial!: THREE.MeshStandardMaterial;
  private bagMetalMaterial!: THREE.MeshStandardMaterial;
  private bagMapCache = new Map<BagStyleVariant, SurfaceMaps>();
  private currentBagStyle: BagStyleVariant = 'leather';
  private bagAngleX = 0;
  private bagAngleZ = 0;
  private bagVelX = 0;
  private bagVelZ = 0;

  // Dynamic zero-GC InstancedMesh & Ring Pools
  private debrisMesh!: THREE.InstancedMesh;
  private debrisData: PooledDebris[] = [];
  private debrisCursor = 0;

  private sparkMesh!: THREE.InstancedMesh;
  private sparkData: PooledSpark[] = [];
  private sparkCursor = 0;

  private shockRingPool: PooledShockRing[] = [];
  private ringCursor = 0;
  private sharedRingGeo = new THREE.RingGeometry(0.14, 0.23, 32);

  // Lighting & mode dynamics
  private impactFlashLight!: THREE.PointLight;
  private backBayLight!: THREE.PointLight;
  private thresholdTrimMat!: THREE.MeshStandardMaterial;
  private impactFlashIntensity = 0;
  private overdriveActive = false;
  private bossModeActive = false;

  // Camera & target dynamics
  private targetMode: TargetMode = 'WALL';
  private cameraYaw = 0;
  private cursorNdcX = 0;
  private cursorNdcY = 0;
  private smoothAimX = 0;
  private smoothAimY = 0;
  private currentAimWorldX = 0;
  private currentAimWorldY = 1.82;
  private wallFacePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.29);
  private aimPointScratch = new THREE.Vector3();
  private shakeIntensity = 0;
  private shakeDirX = 1;
  private cameraPunchRoll = 0;
  private cameraPunchPitch = 0;
  private cameraPunchZ = 0;
  private wallRecoilZ = 0;
  private fovBoost = 0;
  private hitStopTimer = 0;
  private breakDashTimer = 0;
  private breakSwapped = false;
  private punchSpeedMult = 1;
  private autoPunchEnabled = false;
  private autoPunchTimer = 0;
  private wallDamageRatio = 0;

  constructor(
    container: HTMLElement,
    audio: PunchAudioEngine,
    callbacks: SceneCallbacks
  ) {
    this.container = container;
    this.audio = audio;
    this.callbacks = callbacks;

    this.isSoftwareGl = this.detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const width = Math.max(320, container.clientWidth || window.innerWidth);
    const height = Math.max(320, container.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0f13);
    this.scene.fog = new THREE.FogExp2(0x0d0f13, 0.028);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.cameraRig = new THREE.Group();
    this.cameraRig.position.set(0, 1.68, 3.05);
    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.05, 90);
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    this.setupLighting();
    this.buildArenaEnvironment();
    this.buildDestructibleWall();
    this.buildSplashReticle();
    this.buildWeakSpotTarget();
    this.buildHeavyBag();
    this.buildFirstPersonArms();
    this.buildEffectPools();

    if (!this.isSoftwareGl) {
      this.setupPostProcessing(width, height);
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.startLoop();
  }

  private setupPostProcessing(width: number, height: number) {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 2.76,
      aperture: 0.00105,
      maxblur: 0.0044,
    });
    this.bokehPass.setSize(width, height);
    this.composer.addPass(this.bokehPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private setupLighting() {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x261d16, 0.74);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.9);
    keyLight.position.set(3.8, 7.6, 5.6);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = this.isSoftwareGl ? 512 : 2048;
    keyLight.shadow.mapSize.height = this.isSoftwareGl ? 512 : 2048;
    keyLight.shadow.radius = 2.5;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.05);
    rimLight.position.set(-4.2, 4.4, -3.6);
    this.scene.add(rimLight);

    const overheadSpot = new THREE.PointLight(0xffedd5, 2.5, 16, 1.35);
    overheadSpot.position.set(0, 4.15, 2.1);
    this.scene.add(overheadSpot);

    // Backlight behind the wall so punched-through holes glow with atmospheric bay depth!
    this.backBayLight = new THREE.PointLight(0x38bdf8, 1.3, 14, 1.4);
    this.backBayLight.position.set(0, 2.6, -4.2);
    this.scene.add(this.backBayLight);

    this.impactFlashLight = new THREE.PointLight(0xfbbf24, 0, 7.5, 1.6);
    this.impactFlashLight.position.set(0, 1.75, 0.85);
    this.scene.add(this.impactFlashLight);
  }

  private buildArenaEnvironment() {
    this.floorMaps = createArenaFloorMaps(this.maxAnisotropy);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.floorMaps.map,
      normalMap: this.floorMaps.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: this.floorMaps.roughnessMap,
      roughness: 0.85,
      metalness: 0.16,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 52), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x262a33,
      roughness: 0.56,
      metalness: 0.5,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.3,
      metalness: 0.68,
    });
    const girderMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d24,
      roughness: 0.45,
      metalness: 0.78,
    });
    const fixtureMat = new THREE.MeshBasicMaterial({
      color: 0xffedd5,
      toneMapped: false,
    });

    const pillarGeo = new THREE.BoxGeometry(0.76, 5.2, 0.76);
    const baseFootGeo = new THREE.BoxGeometry(0.96, 0.24, 0.96);
    const trimGeo = new THREE.BoxGeometry(0.82, 0.14, 0.82);
    const trussGeo = new THREE.BoxGeometry(10.6, 0.38, 0.52);
    const fixtureGeo = new THREE.BoxGeometry(3.4, 0.08, 0.16);

    [-10, -5, 0, 5].forEach((zPos) => {
      [-4.6, 4.6].forEach((xPos) => {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(xPos, 2.6, zPos);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.scene.add(pillar);

        const baseFoot = new THREE.Mesh(baseFootGeo, girderMat);
        baseFoot.position.set(xPos, 0.12, zPos);
        baseFoot.receiveShadow = true;
        this.scene.add(baseFoot);

        const trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.set(xPos, 0.92, zPos);
        this.scene.add(trim);
      });

      const truss = new THREE.Mesh(trussGeo, girderMat);
      truss.position.set(0, 5.05, zPos);
      this.scene.add(truss);

      const lightBar = new THREE.Mesh(fixtureGeo, fixtureMat);
      lightBar.position.set(0, 4.82, zPos);
      this.scene.add(lightBar);
    });

    const sideWallMat = new THREE.MeshStandardMaterial({
      color: 0x14171d,
      roughness: 0.85,
      metalness: 0.14,
    });
    [-5.2, 5.2].forEach((xPos) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.4, 36), sideWallMat);
      side.position.set(xPos, 2.7, -4);
      this.scene.add(side);
    });
  }

  private getOrCreateWallMaps(material: WallMaterialKind): WallMaterialMaps {
    let cached = this.wallMapCache.get(material);
    if (!cached) {
      cached = createWallMaterialMaps(material, this.maxAnisotropy);
      this.wallMapCache.set(material, cached);
    }
    return cached;
  }

  private buildDestructibleWall() {
    this.wallGroup = new THREE.Group();
    this.wallGroup.position.set(0, 0, 0);
    this.scene.add(this.wallGroup);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x272b35,
      roughness: 0.38,
      metalness: 0.82,
    });
    this.thresholdTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.35,
      metalness: 0.65,
    });

    const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.44, 4.25, 0.88), frameMat);
    leftPost.position.set(-2.76, 2.125, 0);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    this.wallGroup.add(leftPost);

    const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.44, 4.25, 0.88), frameMat);
    rightPost.position.set(2.76, 2.125, 0);
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;
    this.wallGroup.add(rightPost);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.5, 0.94), frameMat);
    lintel.position.set(0, 4.3, 0);
    lintel.castShadow = true;
    this.wallGroup.add(lintel);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(5.96, 0.14, 1.02), frameMat);
    plinth.position.set(0, 0.07, 0);
    plinth.receiveShadow = true;
    this.wallGroup.add(plinth);

    const thresholdTrim = new THREE.Mesh(new THREE.BoxGeometry(5.14, 0.04, 0.14), this.thresholdTrimMat);
    thresholdTrim.position.set(0, 0.145, 0.42);
    this.wallGroup.add(thresholdTrim);

    // Build 9x6x2 Instanced Destructible Grid Wall with per-block UVs & procedural cracks!
    const blockGeo = new THREE.BoxGeometry(BLOCK_W * 0.992, BLOCK_H * 0.992, BLOCK_D);
    const uvRects = new Float32Array(TOTAL_WALL_BLOCKS * 4);
    const damageValues = new Float32Array(TOTAL_WALL_BLOCKS);

    let idx = 0;
    for (let layer = 0 as 0 | 1; layer < WALL_LAYERS; layer = (layer + 1) as 0 | 1) {
      for (let row = 0; row < WALL_ROWS; row++) {
        for (let col = 0; col < WALL_COLS; col++) {
          uvRects[idx * 4] = col / WALL_COLS;
          uvRects[idx * 4 + 1] = row / WALL_ROWS;
          uvRects[idx * 4 + 2] = 1 / WALL_COLS;
          uvRects[idx * 4 + 3] = 1 / WALL_ROWS;
          damageValues[idx] = 0;

          const baseX = -WALL_WIDTH * 0.5 + (col + 0.5) * BLOCK_W;
          const baseY = WALL_BOTTOM_Y + (row + 0.5) * BLOCK_H;
          const baseZ = layer === 0 ? BLOCK_D * 0.5 : -BLOCK_D * 0.5;

          this.wallBlockStates.push({
            col,
            row,
            layer,
            baseX,
            baseY,
            baseZ,
            hp: 1.0,
            broken: false,
            recessZ: 0,
            tiltX: 0,
            tiltY: 0,
          });
          idx++;
        }
      }
    }

    blockGeo.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(uvRects, 4));
    this.wallDamageAttr = new THREE.InstancedBufferAttribute(damageValues, 1);
    this.wallDamageAttr.setUsage(THREE.DynamicDrawUsage);
    blockGeo.setAttribute('aBlockDamage', this.wallDamageAttr);

    const initialMaps = this.getOrCreateWallMaps('drywall');
    this.wallMaterial = new THREE.MeshPhysicalMaterial({
      map: initialMaps.map,
      normalMap: initialMaps.normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: initialMaps.roughnessMap,
      roughness: 0.82,
      metalness: 0.05,
      clearcoat: 0,
      clearcoatRoughness: 0.25,
    });

    // Inject per-instance tile UV slicing & per-block procedural pixel fractures
    this.wallMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec4 aUvRect;
          attribute float aBlockDamage;
          varying vec2 vLocalBlockUv;
          varying float vBlockDamage;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vLocalBlockUv = uv;
          vBlockDamage = aBlockDamage;
          #ifdef USE_MAP
            vMapUv = uv * aUvRect.zw + aUvRect.xy;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv = uv * aUvRect.zw + aUvRect.xy;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = uv * aUvRect.zw + aUvRect.xy;
          #endif
          #ifdef USE_EMISSIVEMAP
            vEmissiveMapUv = uv * aUvRect.zw + aUvRect.xy;
          #endif`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vLocalBlockUv;
          varying float vBlockDamage;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (vBlockDamage > 0.02) {
            vec2 p = vLocalBlockUv * 2.0 - 1.0;
            float edgeDist = max(abs(p.x), abs(p.y));
            float borderChip = smoothstep(0.7, 1.0, edgeDist) * vBlockDamage * 0.55;
            float diagA = abs(p.x + p.y * 0.82 + sin(p.y * 7.5) * 0.14);
            float diagB = abs(p.x * 0.88 - p.y + cos(p.x * 6.5) * 0.14);
            float crackLine = 1.0 - smoothstep(0.018, 0.058 + vBlockDamage * 0.04, min(diagA, diagB));
            float fracture = clamp(crackLine * vBlockDamage * 0.95 + borderChip, 0.0, 0.86);
            diffuseColor.rgb *= (1.0 - fracture);
          }`
        );
    };

    this.wallInstancedMesh = new THREE.InstancedMesh(
      blockGeo,
      this.wallMaterial,
      TOTAL_WALL_BLOCKS
    );
    this.wallInstancedMesh.castShadow = true;
    this.wallInstancedMesh.receiveShadow = true;
    this.wallInstancedMesh.frustumCulled = false;
    this.wallInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.resetWallBlocks();
    this.wallGroup.add(this.wallInstancedMesh);

    // Invisible raycast plane across wall face for accurate pointer impact coordinates
    this.wallHitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_WIDTH, WALL_HEIGHT),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.wallHitPlane.position.set(0, WALL_BOTTOM_Y + WALL_HEIGHT * 0.5, 0.29);
    this.wallGroup.add(this.wallHitPlane);
  }

  private resetWallBlocks() {
    for (let i = 0; i < TOTAL_WALL_BLOCKS; i++) {
      const b = this.wallBlockStates[i];
      b.hp = 1.0;
      b.broken = false;
      b.recessZ = 0;
      b.tiltX = 0;
      b.tiltY = 0;
      this.wallDamageAttr.setX(i, 0);

      // Rear core layer slightly darker so punched front craters show crisp depth!
      if (b.layer === 1) {
        _color.setRGB(0.68, 0.68, 0.72);
      } else {
        _color.setRGB(1, 1, 1);
      }
      this.wallInstancedMesh.setColorAt(i, _color);

      _pos.set(b.baseX, b.baseY, b.baseZ);
      _quat.identity();
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      this.wallInstancedMesh.setMatrixAt(i, _mat4);
    }
    this.wallDamageAttr.needsUpdate = true;
    this.wallInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.wallInstancedMesh.instanceColor) {
      this.wallInstancedMesh.instanceColor.needsUpdate = true;
    }
  }

  private syncWallBlockTransform(index: number) {
    const b = this.wallBlockStates[index];
    if (b.broken) {
      _mat4.makeScale(0, 0, 0);
      this.wallInstancedMesh.setMatrixAt(index, _mat4);
      return;
    }

    const dmg = 1 - b.hp;
    this.wallDamageAttr.setX(index, dmg);
    const shrink = 1 - dmg * 0.08;
    _pos.set(b.baseX, b.baseY, b.baseZ + b.recessZ);
    _euler.set(b.tiltX, b.tiltY, 0);
    _quat.setFromEuler(_euler);
    _scale.set(shrink, shrink, 1);
    _mat4.compose(_pos, _quat, _scale);
    this.wallInstancedMesh.setMatrixAt(index, _mat4);
  }

  /**
   * Synchronizes localized 3D block chipping strictly to the wall's actual HP bar damage ratio!
   * Front blocks chip into craters first; rear core blocks only open full holes once HP <= 48%.
   */
  private applyLocalizedWallChip(
    hitX: number,
    hitY: number,
    projectedDamageRatio: number,
    isCrit: boolean,
    isWeakSpot: boolean
  ): number {
    let currentVisualHp = 0;
    for (let i = 0; i < TOTAL_WALL_BLOCKS; i++) {
      const b = this.wallBlockStates[i];
      if (!b.broken) currentVisualHp += b.hp;
    }

    const targetVisualHp = Math.max(0, (1 - projectedDamageRatio) * TOTAL_WALL_BLOCKS);
    let remainingBudget = Math.max(0, currentVisualHp - targetVisualHp);
    if (remainingBudget <= 0.001) return 0;

    const baseRadius =
      this.effectiveSplashRadius * (isWeakSpot ? 1.55 : isCrit ? 1.25 : 1.0);
    // Prevent open see-through holes until the wall is below ~48% HP
    const allowRearBreak = projectedDamageRatio >= 0.52;
    const rearMinHp = allowRearBreak ? 0 : 0.22;

    let chunksBroken = 0;
    const colorHex = this.getDebrisColor(this.currentMaterialKind);

    const radiusMultipliers = [1.0, 1.65, 2.8, 6.0];
    for (let pass = 0; pass < radiusMultipliers.length && remainingBudget > 0.01; pass++) {
      const passRadius = baseRadius * radiusMultipliers[pass];
      let totalWeight = 0;

      for (let col = 0; col < WALL_COLS; col++) {
        for (let row = 0; row < WALL_ROWS; row++) {
          const frontIdx = row * WALL_COLS + col;
          const rearIdx = WALL_COLS * WALL_ROWS + frontIdx;
          const front = this.wallBlockStates[frontIdx];
          const rear = this.wallBlockStates[rearIdx];

          const targetBlock = !front.broken ? front : !rear.broken ? rear : null;
          if (!targetBlock) continue;
          const minAllowedHp = targetBlock.layer === 1 ? rearMinHp : 0;
          if (targetBlock.hp <= minAllowedHp + 0.001) continue;

          const dx = front.baseX - hitX;
          const dy = front.baseY - hitY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > passRadius) continue;

          const falloff = 1 - dist / passRadius;
          totalWeight += 0.2 + 0.8 * falloff * falloff;
        }
      }

      if (totalWeight <= 0.0001) continue;

      const passBudget = remainingBudget;
      let spentThisPass = 0;

      for (let col = 0; col < WALL_COLS; col++) {
        for (let row = 0; row < WALL_ROWS; row++) {
          const frontIdx = row * WALL_COLS + col;
          const rearIdx = WALL_COLS * WALL_ROWS + frontIdx;
          const front = this.wallBlockStates[frontIdx];
          const rear = this.wallBlockStates[rearIdx];

          const targetBlock = !front.broken ? front : !rear.broken ? rear : null;
          const targetIdx = !front.broken ? frontIdx : rearIdx;
          if (!targetBlock) continue;

          const minAllowedHp = targetBlock.layer === 1 ? rearMinHp : 0;
          const availableHp = targetBlock.hp - minAllowedHp;
          if (availableHp <= 0.001) continue;

          const dx = front.baseX - hitX;
          const dy = front.baseY - hitY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > passRadius) continue;

          const falloff = 1 - dist / passRadius;
          const weight = 0.2 + 0.8 * falloff * falloff;
          const share = passBudget * (weight / totalWeight);
          const appliedDmg = Math.min(availableHp, share);
          if (appliedDmg <= 0.001) continue;

          targetBlock.hp = Math.max(minAllowedHp, targetBlock.hp - appliedDmg);
          spentThisPass += appliedDmg;

          // Subtle physical indent proportional to applied damage
          const dentScale = Math.min(1, appliedDmg * 1.4) * (0.35 + 0.65 * falloff);
          targetBlock.recessZ = Math.max(-0.085, targetBlock.recessZ - 0.042 * dentScale);
          targetBlock.tiltX += (Math.random() - 0.5) * 0.07 * dentScale;
          targetBlock.tiltY += (Math.random() - 0.5) * 0.07 * dentScale;

          if (targetBlock.hp <= 0.001 && !targetBlock.broken) {
            targetBlock.hp = 0;
            targetBlock.broken = true;
            chunksBroken++;

            const burstCount = targetBlock.layer === 0 ? 4 : 5;
            for (let k = 0; k < burstCount; k++) {
              this.spawnPooledDebris(
                targetBlock.baseX + (Math.random() - 0.5) * BLOCK_W * 0.6,
                targetBlock.baseY + (Math.random() - 0.5) * BLOCK_H * 0.6,
                targetBlock.baseZ + (targetBlock.layer === 0 ? 0.12 : -0.1),
                (Math.random() - 0.5) * 4.5 + dx * 1.4,
                1.4 + Math.random() * 3.8,
                targetBlock.layer === 0
                  ? 1.2 + Math.random() * 2.8
                  : -(2.2 + Math.random() * 4.0),
                1.15 + Math.random() * 0.85,
                colorHex,
                1.0 + Math.random() * 0.45
              );
            }
          } else {
            const shade = targetBlock.layer === 1 ? 0.68 : 1.0 - (1 - targetBlock.hp) * 0.25;
            _color.setRGB(shade, shade, shade);
            this.wallInstancedMesh.setColorAt(targetIdx, _color);
          }

          this.syncWallBlockTransform(targetIdx);
        }
      }

      remainingBudget = Math.max(0, remainingBudget - spentThisPass);
      if (spentThisPass <= 0.001) break;
    }

    this.wallDamageAttr.needsUpdate = true;
    this.wallInstancedMesh.instanceMatrix.needsUpdate = true;
    if (this.wallInstancedMesh.instanceColor) {
      this.wallInstancedMesh.instanceColor.needsUpdate = true;
    }
    return chunksBroken;
  }

  private buildSplashReticle() {
    this.splashReticleGroup = new THREE.Group();
    this.splashReticleGroup.position.set(0, 1.82, 0.305);
    this.wallGroup.add(this.splashReticleGroup);

    this.splashOuterRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      toneMapped: false,
    });
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.955, 1.0, 56),
      this.splashOuterRingMat
    );
    this.splashReticleGroup.add(outerRing);

    this.splashFillMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      toneMapped: false,
    });
    const innerFill = new THREE.Mesh(
      new THREE.CircleGeometry(0.955, 48),
      this.splashFillMat
    );
    this.splashReticleGroup.add(innerFill);

    this.splashCenterMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      toneMapped: false,
    });
    const centerDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.048, 20),
      this.splashCenterMat
    );
    this.splashReticleGroup.add(centerDot);

    // 4 crisp perimeter crosshair ticks
    const tickGeo = new THREE.PlaneGeometry(0.032, 0.14);
    const tickPositions: Array<[number, number, number]> = [
      [0, 1.0, 0],
      [0, -1.0, 0],
      [1.0, 0, Math.PI / 2],
      [-1.0, 0, Math.PI / 2],
    ];
    tickPositions.forEach(([tx, ty, rot]) => {
      const tick = new THREE.Mesh(tickGeo, this.splashOuterRingMat);
      tick.position.set(tx, ty, 0.002);
      tick.rotation.z = rot;
      this.splashReticleGroup.add(tick);
    });
  }

  private buildWeakSpotTarget() {
    this.weakSpotGroup = new THREE.Group();
    this.weakSpotGroup.position.set(0, 1.85, 0.32);
    this.weakSpotGroup.visible = false;
    this.wallGroup.add(this.weakSpotGroup);

    this.weakSpotCore = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.94,
        toneMapped: false,
      })
    );
    this.weakSpotGroup.add(this.weakSpotCore);

    this.weakSpotRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.42, 36),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.96,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    this.weakSpotRing.position.z = 0.005;
    this.weakSpotGroup.add(this.weakSpotRing);

    this.weakSpotHitbox = new THREE.Mesh(
      new THREE.CircleGeometry(0.64, 20),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.weakSpotHitbox.position.z = 0.01;
    this.weakSpotGroup.add(this.weakSpotHitbox);
  }

  private getOrCreateBagMaps(style: BagStyleVariant): SurfaceMaps {
    let cached = this.bagMapCache.get(style);
    if (!cached) {
      cached = createBagMaps(style, this.maxAnisotropy);
      this.bagMapCache.set(style, cached);
    }
    return cached;
  }

  private buildHeavyBag() {
    this.bagPivot = new THREE.Group();
    this.bagPivot.position.set(-2.45, 4.9, 1.35);
    this.scene.add(this.bagPivot);

    const initialBag = getBagById('leather');
    const initialMaps = this.getOrCreateBagMaps(initialBag.style);

    this.bagMetalMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialBag.metalColor),
      metalness: 0.92,
      roughness: 0.22,
    });
    this.bagMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initialBag.bodyColor),
      map: initialMaps.map,
      normalMap: initialMaps.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: initialMaps.roughnessMap,
      roughness: initialBag.roughness,
      metalness: initialBag.metalness,
      emissive: new THREE.Color(initialBag.emissiveColor),
      emissiveIntensity: initialBag.emissiveIntensity,
      clearcoat: 0,
      clearcoatRoughness: 0.22,
    });
    this.bagStrapMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialBag.strapColor),
      roughness: 0.65,
      metalness: 0.16,
    });

    const chain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 1.55, 10),
      this.bagMetalMaterial
    );
    chain.position.set(0, -0.78, 0);
    this.bagPivot.add(chain);

    const swivel = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.02, 8, 16),
      this.bagMetalMaterial
    );
    swivel.position.set(0, -1.52, 0);
    this.bagPivot.add(swivel);

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.22, 24),
      this.bagStrapMaterial
    );
    topCap.position.set(0, -1.65, 0);
    this.bagPivot.add(topCap);

    this.bagBodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 1.65, 28),
      this.bagMaterial
    );
    this.bagBodyMesh.position.set(0, -2.58, 0);
    this.bagBodyMesh.castShadow = true;
    this.bagPivot.add(this.bagBodyMesh);

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.47, 0.47, 0.26, 28),
      this.bagStrapMaterial
    );
    band.position.set(0, -2.55, 0);
    this.bagPivot.add(band);

    const upperTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.468, 0.022, 8, 28),
      this.bagMetalMaterial
    );
    upperTrim.rotation.x = Math.PI / 2;
    upperTrim.position.set(0, -1.86, 0);
    this.bagPivot.add(upperTrim);

    const lowerTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.468, 0.022, 8, 28),
      this.bagMetalMaterial
    );
    lowerTrim.rotation.x = Math.PI / 2;
    lowerTrim.position.set(0, -3.28, 0);
    this.bagPivot.add(lowerTrim);

    // Armored perimeter studs/facets for high-tier Heavy Bags
    this.bagStudsGroup = new THREE.Group();
    const studGeo = new THREE.OctahedronGeometry(0.048, 0);
    [-2.08, -3.02].forEach((sy) => {
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const stud = new THREE.Mesh(studGeo, this.bagMetalMaterial);
        stud.position.set(Math.cos(ang) * 0.472, sy, Math.sin(ang) * 0.472);
        stud.rotation.y = -ang;
        this.bagStudsGroup.add(stud);
      }
    });
    this.bagStudsGroup.visible = false;
    this.bagPivot.add(this.bagStudsGroup);

    // Orbiting energy halo ring for high-tier cyber / cosmic Heavy Bags
    this.bagAuraRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.64, 0.022, 10, 40),
      this.bagMetalMaterial
    );
    this.bagAuraRing.position.set(0, -2.58, 0);
    this.bagAuraRing.rotation.set(Math.PI / 2 - 0.25, 0.2, 0);
    this.bagAuraRing.visible = false;
    this.bagPivot.add(this.bagAuraRing);

    const botCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.36, 0.2, 24),
      this.bagStrapMaterial
    );
    botCap.position.set(0, -3.5, 0);
    this.bagPivot.add(botCap);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
    sGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
    sGrad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const contactTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(-2.45, 0.02, 1.35);
    this.scene.add(contactShadow);
  }

  /**
   * Builds high-detail 3D POV forearms, layered bracer cuffs & buckles,
   * sculpted dorsal hand armor, 4 chamfered knuckle caps, 3-segment creased curled fingers,
   * articulated thumbs, and 10 distinct customizable glove silhouettes.
   */
  private buildFirstPersonArms() {
    const initialGlove = getGloveById('wraps');
    this.gloveMaps = createGloveMaps(this.maxAnisotropy);
    this.skinMaps = createSkinArmMaps(this.maxAnisotropy);

    this.gloveMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initialGlove.color),
      map: this.gloveMaps.map,
      normalMap: this.gloveMaps.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: initialGlove.roughness,
      metalness: initialGlove.metalness,
      emissive: new THREE.Color(initialGlove.emissiveColor),
      emissiveIntensity: initialGlove.emissiveIntensity,
      clearcoat: 0,
      clearcoatRoughness: 0.2,
    });

    this.cuffMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(initialGlove.cuffColor),
      map: this.gloveMaps.map,
      normalMap: this.gloveMaps.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.54,
      metalness: 0.32,
    });

    this.trimMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f4f5,
      roughness: 0.38,
      metalness: 0.24,
    });

    this.seamMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.15,
    });

    this.knuckleMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initialGlove.knuckleColor),
      roughness: Math.max(0.08, initialGlove.roughness - 0.15),
      metalness: Math.min(0.96, initialGlove.metalness + 0.25),
      emissive: new THREE.Color(initialGlove.emissiveColor),
      emissiveIntensity: initialGlove.emissiveIntensity * 1.25,
      clearcoat: 0.3,
      clearcoatRoughness: 0.14,
    });

    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6a37a,
      map: this.skinMaps.map,
      normalMap: this.skinMaps.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.56,
      metalness: 0.02,
    });

    // Sculpted beveled blocky palm silhouette via ExtrudeGeometry
    const palmShape = new THREE.Shape();
    palmShape.moveTo(-0.096, -0.076);
    palmShape.lineTo(0.096, -0.076);
    palmShape.quadraticCurveTo(0.114, 0, 0.102, 0.078);
    palmShape.lineTo(-0.102, 0.078);
    palmShape.quadraticCurveTo(-0.114, 0, -0.096, -0.076);
    const palmGeo = new THREE.ExtrudeGeometry(palmShape, {
      depth: 0.184,
      bevelEnabled: true,
      bevelThickness: 0.026,
      bevelSize: 0.022,
      bevelSegments: 3,
    });
    palmGeo.center();

    // Sculpted anatomical forearm via LatheGeometry (defined muscle swell -> tapered wrist)
    const forearmPoints = [
      new THREE.Vector2(0.073, -0.28),
      new THREE.Vector2(0.078, -0.17),
      new THREE.Vector2(0.097, -0.04),
      new THREE.Vector2(0.112, 0.13),
      new THREE.Vector2(0.104, 0.29),
    ];
    const forearmGeo = new THREE.LatheGeometry(forearmPoints, 24);
    forearmGeo.rotateX(Math.PI / 2);

    const createArm = (side: -1 | 1): ArmModel => {
      const root = new THREE.Group();
      const basePos = new THREE.Vector3(side * 0.44, -0.36, -0.56);
      const baseRot = new THREE.Euler(0.24, side * -0.18, side * -0.12);
      root.position.copy(basePos);
      root.rotation.copy(baseRot);

      const forearmMesh = new THREE.Mesh(forearmGeo, this.skinMaterial);
      forearmMesh.position.set(0, -0.02, 0.35);
      root.add(forearmMesh);

      // Lower athletic bracer / sleeve guard band on forearm
      const forearmSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.098, 0.108, 0.14, 20),
        this.cuffMaterial
      );
      forearmSleeve.rotation.x = Math.PI / 2;
      forearmSleeve.position.set(0, -0.015, 0.27);
      root.add(forearmSleeve);

      const wristGroup = new THREE.Group();
      root.add(wristGroup);

      // Layered wrist wrap collar + Velcro strap + sculpted clasp buckle
      const cuffMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.088, 0.18, 22),
        this.cuffMaterial
      );
      cuffMesh.rotation.x = Math.PI / 2;
      cuffMesh.position.set(0, 0, 0.105);
      wristGroup.add(cuffMesh);

      const wristStrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.095, 0.015, 10, 24),
        this.trimMaterial
      );
      wristStrap.position.set(0, 0, 0.062);
      wristGroup.add(wristStrap);

      const wristBuckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.068, 0.032, 0.044),
        this.knuckleMaterial
      );
      wristBuckle.position.set(0, 0.094, 0.065);
      wristGroup.add(wristBuckle);

      // Beveled sculpted palm & hand chassis
      const gloveMesh = new THREE.Mesh(palmGeo, this.gloveMaterial);
      gloveMesh.position.set(0, 0.01, -0.055);
      wristGroup.add(gloveMesh);

      // Dorsal armored metacarpal backplate for silhouette depth
      const dorsalPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.184, 0.028, 0.148),
        this.cuffMaterial
      );
      dorsalPlate.position.set(0, 0.098, -0.052);
      wristGroup.add(dorsalPlate);

      // Diagonal cloth wrap bands (for Taped Wraps look)
      const wrapBands = new THREE.Group();
      [-0.085, -0.025, 0.035].forEach((bz, i) => {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.232, 0.178, 0.028),
          this.trimMaterial
        );
        band.position.set(0, 0.01, bz);
        band.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.12;
        wrapBands.add(band);
      });
      wristGroup.add(wrapBands);

      // 4 Chamfered Knuckle Caps (individual articulated metacarpal heads)
      const knuckleCaps = new THREE.Group();
      const capGeo = new THREE.BoxGeometry(0.045, 0.044, 0.048);
      for (let i = 0; i < 4; i++) {
        const kx = -0.072 + i * 0.048;
        const cap = new THREE.Mesh(capGeo, this.knuckleMaterial);
        cap.position.set(kx, 0.062, -0.158);
        cap.rotation.x = 0.16;
        knuckleCaps.add(cap);
      }
      wristGroup.add(knuckleCaps);

      // 4 Multi-joint 3-segment curled fingers with dark joint creases!
      const fingerGroup = new THREE.Group();
      const proxGeo = new THREE.BoxGeometry(0.044, 0.066, 0.06);
      const midGeo = new THREE.BoxGeometry(0.042, 0.054, 0.05);
      const distGeo = new THREE.BoxGeometry(0.039, 0.046, 0.044);
      const seamGeo = new THREE.BoxGeometry(0.046, 0.01, 0.056);

      for (let i = 0; i < 4; i++) {
        const fx = -0.072 + i * 0.048;
        const lengthBias = i === 1 ? 0.006 : i === 3 ? -0.006 : 0;

        const prox = new THREE.Mesh(proxGeo, this.gloveMaterial);
        prox.position.set(fx, 0.024, -0.168 - lengthBias);
        prox.rotation.x = 0.22;
        fingerGroup.add(prox);

        const seam1 = new THREE.Mesh(seamGeo, this.seamMaterial);
        seam1.position.set(fx, -0.008, -0.184 - lengthBias);
        seam1.rotation.x = 0.48;
        fingerGroup.add(seam1);

        const mid = new THREE.Mesh(midGeo, this.gloveMaterial);
        mid.position.set(fx, -0.032, -0.178 - lengthBias);
        mid.rotation.x = 0.78;
        fingerGroup.add(mid);

        const seam2 = new THREE.Mesh(seamGeo, this.seamMaterial);
        seam2.position.set(fx, -0.056, -0.162 - lengthBias);
        seam2.rotation.x = 1.08;
        fingerGroup.add(seam2);

        const dist = new THREE.Mesh(distGeo, this.gloveMaterial);
        dist.position.set(fx, -0.068, -0.136 - lengthBias);
        dist.rotation.x = 1.32;
        fingerGroup.add(dist);
      }
      wristGroup.add(fingerGroup);

      // Articulated Thumb (2 segments tucked across palm with knuckle pad + crease)
      const thumbMesh = new THREE.Group();
      const thumbBase = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.035, 0.075, 6, 12),
        this.gloveMaterial
      );
      thumbBase.rotation.set(Math.PI / 2 - 0.35, 0, side * 0.42);
      thumbBase.position.set(side * -0.116, -0.012, -0.042);
      thumbMesh.add(thumbBase);

      const thumbSeam = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.006, 6, 12),
        this.seamMaterial
      );
      thumbSeam.rotation.y = Math.PI / 2;
      thumbSeam.position.set(side * -0.1, -0.034, -0.082);
      thumbMesh.add(thumbSeam);

      const thumbTip = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.031, 0.052, 6, 12),
        this.gloveMaterial
      );
      thumbTip.rotation.set(0.22, 0, side * 1.15);
      thumbTip.position.set(side * -0.078, -0.054, -0.114);
      thumbMesh.add(thumbTip);
      wristGroup.add(thumbMesh);

      // Plump Crimson Leather Boxing Glove Shell (with stitched thumb guard + trim stripe)
      const boxingShell = new THREE.Group();
      const mainPuff = new THREE.Mesh(
        new THREE.SphereGeometry(0.156, 26, 20),
        this.gloveMaterial
      );
      mainPuff.scale.set(1.06, 0.93, 1.25);
      mainPuff.position.set(0, 0.018, -0.085);
      boxingShell.add(mainPuff);

      const boxingThumbPuff = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.044, 0.085, 8, 12),
        this.gloveMaterial
      );
      boxingThumbPuff.rotation.set(0.45, 0, side * 0.72);
      boxingThumbPuff.position.set(side * -0.125, -0.025, -0.078);
      boxingShell.add(boxingThumbPuff);

      const boxingStripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.106, 0.102, 0.048, 22),
        this.trimMaterial
      );
      boxingStripe.rotation.x = Math.PI / 2;
      boxingStripe.position.set(0, 0.005, 0.025);
      boxingShell.add(boxingStripe);
      boxingShell.visible = false;
      wristGroup.add(boxingShell);

      // Reinforced Knuckle Strike Bar
      const knuckleMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.224, 0.068, 0.068),
        this.knuckleMaterial
      );
      knuckleMesh.position.set(0, 0.054, -0.164);
      wristGroup.add(knuckleMesh);

      // Brass / Spiked Knuckles
      const brassSpikes = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.025, 0.078, 8),
          this.knuckleMaterial
        );
        spike.rotation.x = -Math.PI / 2;
        spike.position.set(-0.072 + i * 0.048, 0.052, -0.224);
        brassSpikes.add(spike);
      }
      brassSpikes.visible = false;
      wristGroup.add(brassSpikes);

      // Cyber-Robot / Titanium Hydraulic Armor & Reciprocating Pistons
      const robotParts = new THREE.Group();
      const robotPistons: THREE.Mesh[] = [];
      [-0.088, 0.088].forEach((px) => {
        const piston = new THREE.Mesh(
          new THREE.CylinderGeometry(0.023, 0.023, 0.34, 10),
          this.knuckleMaterial
        );
        piston.rotation.x = Math.PI / 2;
        piston.position.set(px, 0.096, 0.15);
        robotParts.add(piston);
        robotPistons.push(piston);
      });
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.188, 0.028, 0.182),
        this.knuckleMaterial
      );
      visor.position.set(0, 0.114, -0.068);
      robotParts.add(visor);
      robotParts.visible = false;
      wristGroup.add(robotParts);

      // Flaming Molten Fissure Plates
      const flamingPlates = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(0.194, 0.024, 0.044),
          this.knuckleMaterial
        );
        vent.position.set(0, 0.112, -0.12 + i * 0.065);
        flamingPlates.add(vent);
      }
      flamingPlates.visible = false;
      wristGroup.add(flamingPlates);

      // Diamond / Celestial Crystalline Spikes
      const diamondSpikes = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.041, 0),
          this.knuckleMaterial
        );
        crystal.scale.set(0.84, 0.84, 1.75);
        crystal.position.set(-0.072 + i * 0.048, 0.052, -0.22);
        diamondSpikes.add(crystal);
      }
      diamondSpikes.visible = false;
      wristGroup.add(diamondSpikes);

      // Plasma Reactor Dorsal Arc Coils
      const plasmaCoils = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const arcRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.098, 0.013, 8, 22, Math.PI),
          this.knuckleMaterial
        );
        arcRing.position.set(0, 0.02, -0.11 + i * 0.065);
        plasmaCoils.add(arcRing);
      }
      plasmaCoils.visible = false;
      wristGroup.add(plasmaCoils);

      // Celestial Sovereign Crown Ridge
      const celestialCrown = new THREE.Group();
      const crownCrest = new THREE.Mesh(
        new THREE.BoxGeometry(0.052, 0.052, 0.18),
        this.knuckleMaterial
      );
      crownCrest.position.set(0, 0.122, -0.055);
      celestialCrown.add(crownCrest);
      const wristHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.112, 0.012, 8, 24),
        this.knuckleMaterial
      );
      wristHalo.position.set(0, 0, 0.045);
      celestialCrown.add(wristHalo);
      celestialCrown.visible = false;
      wristGroup.add(celestialCrown);

      this.camera.add(root);
      return {
        root,
        wristGroup,
        gloveMesh,
        dorsalPlate,
        boxingShell,
        cuffMesh,
        wristStrap,
        wristBuckle,
        knuckleMesh,
        knuckleCaps,
        fingerGroup,
        wrapBands,
        brassSpikes,
        robotParts,
        robotPistons,
        flamingPlates,
        diamondSpikes,
        plasmaCoils,
        celestialCrown,
        thumbMesh,
        forearmMesh,
        forearmSleeve,
        basePos,
        baseRot,
        targetOffsetX: 0,
        targetOffsetY: 0,
        targetApexZ: -1.78,
        targetYaw: 0,
        targetPitch: 0,
        impactWorldX: 0,
        impactWorldY: 1.75,
        punchProgress: -1,
        isCritSwing: false,
        isWeakSpotSwing: false,
        hitTriggered: false,
      };
    };

    this.leftArm = createArm(-1);
    this.rightArm = createArm(1);
  }

  private buildEffectPools() {
    const debrisGeo = new THREE.DodecahedronGeometry(0.115, 0);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.18,
    });
    this.debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, MAX_DEBRIS);
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    _mat4.makeScale(0, 0, 0);
    _color.setHex(0xffffff);
    for (let i = 0; i < MAX_DEBRIS; i++) {
      this.debrisMesh.setMatrixAt(i, _mat4);
      this.debrisMesh.setColorAt(i, _color);
      this.debrisData.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        ax: 0,
        ay: 0,
        az: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        life: 0,
        maxLife: 1,
      });
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.debrisMesh);

    const sparkGeo = new THREE.OctahedronGeometry(0.055, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, _color);
      this.sparkData.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: 9.8,
        scale: 1,
        life: 0,
        maxLife: 0.4,
      });
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.sparkMesh);

    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(this.sharedRingGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockRingPool.push({
        active: false,
        mesh,
        material: mat,
        life: 0,
        maxLife: 0.3,
        maxScale: 4.0,
      });
    }
  }

  public applyGlove(gloveId: string, colorPresetId = 'default', skinToneId = 'tan') {
    const g: GloveDefinition = getGloveById(gloveId);
    const paint = getGloveColorPreset(colorPresetId);
    const skin = getSkinTonePreset(skinToneId);
    this.currentGloveStyle = g.style;

    const primaryColor = paint.primaryHex || g.color;
    const accentColor = paint.accentHex || g.knuckleColor;

    this.gloveMaterial.color.set(primaryColor);
    this.gloveMaterial.roughness = g.roughness;
    this.gloveMaterial.metalness = g.metalness;
    this.gloveMaterial.emissive.set(g.emissiveColor);
    this.gloveMaterial.emissiveIntensity = g.emissiveIntensity;
    this.gloveMaterial.clearcoat =
      g.style === 'diamond' ||
      g.style === 'celestial' ||
      g.style === 'frost' ||
      g.style === 'quantum' ||
      g.style === 'galaxian'
        ? 1.0
        : g.style === 'boxing' || g.style === 'carbon' || g.style === 'samurai'
          ? 0.42
          : 0;

    this.cuffMaterial.color.set(g.cuffColor);

    this.knuckleMaterial.color.set(accentColor);
    this.knuckleMaterial.roughness = Math.max(0.08, g.roughness - 0.15);
    this.knuckleMaterial.metalness = Math.min(0.96, g.metalness + 0.25);
    this.knuckleMaterial.emissive.set(g.emissiveColor);
    this.knuckleMaterial.emissiveIntensity = g.emissiveIntensity * 1.25;
    this.knuckleMaterial.clearcoat =
      g.style === 'diamond' ||
      g.style === 'celestial' ||
      g.style === 'frost' ||
      g.style === 'quantum' ||
      g.style === 'galaxian'
        ? 1.0
        : 0.25;

    this.trimMaterial.color.set(
      paint.accentHex ? paint.accentHex : g.style === 'wraps' ? 0xfafaf9 : g.knuckleColor
    );

    this.skinMaterial.color.set(skin.hex);
    if (skin.id === 'slate' || skin.id === 'golden' || skin.id === 'void') {
      this.skinMaterial.roughness = 0.38;
      this.skinMaterial.metalness = skin.id === 'golden' ? 0.85 : 0.42;
    } else {
      this.skinMaterial.roughness = 0.56;
      this.skinMaterial.metalness = 0.02;
    }

    const isBoxing = g.style === 'boxing';
    const isRobo =
      g.style === 'robot' ||
      g.style === 'titanium' ||
      g.style === 'mecha_gold' ||
      g.style === 'neon_synth';
    const isSpiked =
      g.style === 'brass' || g.style === 'samurai' || g.style === 'crimson_demon';
    const isFlaming =
      g.style === 'flaming' ||
      g.style === 'carbon' ||
      g.style === 'emerald' ||
      g.style === 'obsidian_fist' ||
      g.style === 'crimson_demon';
    const isCrystalline =
      g.style === 'diamond' ||
      g.style === 'celestial' ||
      g.style === 'frost' ||
      g.style === 'obsidian_fist' ||
      g.style === 'void_reaver' ||
      g.style === 'galaxian';
    const hasPlasma =
      g.style === 'plasma' ||
      g.style === 'neon_synth' ||
      g.style === 'void_reaver' ||
      g.style === 'quantum' ||
      g.style === 'galaxian';
    const hasCrown =
      g.style === 'celestial' ||
      g.style === 'samurai' ||
      g.style === 'mecha_gold' ||
      g.style === 'quantum' ||
      g.style === 'galaxian';

    [this.leftArm, this.rightArm].forEach((arm) => {
      arm.boxingShell.visible = isBoxing;
      arm.gloveMesh.visible = !isBoxing;
      arm.dorsalPlate.visible = !isBoxing;
      arm.fingerGroup.visible = !isBoxing;
      arm.knuckleMesh.visible = !isBoxing;
      arm.knuckleCaps.visible = !isBoxing;
      arm.thumbMesh.visible = !isBoxing;
      arm.wrapBands.visible = g.style === 'wraps';
      arm.brassSpikes.visible = isSpiked;
      arm.robotParts.visible = isRobo;
      arm.flamingPlates.visible = isFlaming;
      arm.diamondSpikes.visible = isCrystalline;
      arm.plasmaCoils.visible = hasPlasma;
      arm.celestialCrown.visible = hasCrown;
      arm.forearmMesh.material = isRobo ? this.cuffMaterial : this.skinMaterial;
      arm.forearmSleeve.visible = g.style !== 'wraps';
    });
  }

  public applyHeavyBag(bagId: string, bagColorPresetId = 'default') {
    const bag = getBagById(bagId);
    const paint = getBagColorPreset(bagColorPresetId);

    if (bag.style !== this.currentBagStyle) {
      this.currentBagStyle = bag.style;
      const maps = this.getOrCreateBagMaps(bag.style);
      this.bagMaterial.map = maps.map;
      this.bagMaterial.normalMap = maps.normalMap;
      this.bagMaterial.roughnessMap = maps.roughnessMap;
      this.bagMaterial.needsUpdate = true;
    }

    this.bagMaterial.color.set(paint.primaryHex || bag.bodyColor);
    this.bagMaterial.roughness = bag.roughness;
    this.bagMaterial.metalness = bag.metalness;
    this.bagMaterial.emissive.set(bag.emissiveColor);
    this.bagMaterial.emissiveIntensity = bag.emissiveIntensity;
    this.bagMaterial.clearcoat =
      bag.style === 'diamond' ||
      bag.style === 'chrome' ||
      bag.style === 'gold' ||
      bag.style === 'celestial' ||
      bag.style === 'jade'
        ? 0.95
        : bag.style === 'iron' || bag.style === 'titanium' || bag.style === 'void'
          ? 0.45
          : 0;

    this.bagStrapMaterial.color.set(bag.strapColor);
    this.bagMetalMaterial.color.set(paint.accentHex || bag.metalColor);
    this.bagStudsGroup.visible =
      bag.style !== 'leather' &&
      bag.style !== 'canvas' &&
      bag.style !== 'kevlar' &&
      bag.style !== 'chrome';
    this.bagAuraRing.visible =
      bag.style === 'cyber' ||
      bag.style === 'titanium' ||
      bag.style === 'inferno' ||
      bag.style === 'void' ||
      bag.style === 'neon' ||
      bag.style === 'celestial';
  }

  public configureWall(stage: number, hpRatio: number) {
    const spec = getWallSpecForStage(stage);
    this.currentWallMaxHp = spec.maxHp;
    this.wallDamageRatio = 1 - Math.max(0, Math.min(1, hpRatio));

    if (spec.material !== this.currentMaterialKind) {
      this.currentMaterialKind = spec.material;
      const maps = this.getOrCreateWallMaps(spec.material);
      this.wallMaterial.map = maps.map;
      this.wallMaterial.normalMap = maps.normalMap;
      this.wallMaterial.roughnessMap = maps.roughnessMap;
      this.wallMaterial.emissiveMap = maps.emissiveMap;

      this.wallMaterial.roughness =
        spec.material === 'steel'
          ? 0.42
          : spec.material === 'diamond'
            ? 0.2
            : spec.material === 'obsidian'
              ? 0.45
              : 0.88;
      this.wallMaterial.metalness =
        spec.material === 'steel' ? 0.86 : spec.material === 'diamond' ? 0.42 : 0.08;
      this.wallMaterial.clearcoat =
        spec.material === 'diamond' ? 1.0 : spec.material === 'obsidian' ? 0.35 : 0;
      this.wallMaterial.clearcoatRoughness = spec.material === 'diamond' ? 0.08 : 0.28;

      if (spec.material === 'obsidian') {
        this.wallMaterial.emissive.set(0xf97316);
        this.wallMaterial.emissiveIntensity = 1.35;
      } else if (spec.material === 'diamond') {
        this.wallMaterial.emissive.set(0x38bdf8);
        this.wallMaterial.emissiveIntensity = 0.38;
      } else {
        this.wallMaterial.emissive.set(0x000000);
        this.wallMaterial.emissiveIntensity = 0;
      }
      this.wallMaterial.needsUpdate = true;
    }
  }

  public resetWallCracks() {
    this.wallDamageRatio = 0;
    this.resetWallBlocks();
  }

  public setTargetMode(mode: TargetMode) {
    this.targetMode = mode;
    if (mode === 'BAG') {
      this.weakSpotGroup.visible = false;
      this.splashReticleGroup.visible = false;
    } else {
      if (this.weakSpotActive) this.weakSpotGroup.visible = true;
      this.splashReticleGroup.visible = this.breakDashTimer <= 0;
    }
  }

  public setDofEnabled(enabled: boolean) {
    this.dofEnabled = enabled;
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
  }

  public setShakeMultiplier(mult: number) {
    this.shakeMultiplier = Math.max(0, Math.min(1.5, mult));
  }

  public setGraphicsQuality(quality: GraphicsQuality) {
    this.graphicsQuality = quality;
    if (this.isSoftwareGl) return;
    const ratio =
      quality === 'low' ? 1 : quality === 'medium' ? Math.min(window.devicePixelRatio, 1.35) : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = quality !== 'low';
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(320, this.container.clientHeight || window.innerHeight);
    if (this.composer && this.bokehPass) {
      this.composer.setSize(w, h);
      this.bokehPass.setSize(w, h);
    }
  }

  public setSplashRadius(radius: number) {
    this.effectiveSplashRadius = Math.max(0.5, radius);
  }

  public setPunchSpeedMultiplier(mult: number) {
    this.punchSpeedMult = Math.max(1, mult);
  }

  public setAutoPunch(enabled: boolean) {
    this.autoPunchEnabled = enabled;
  }

  public setPrestigeModifiers(weakSpotCooldownReduction: number) {
    this.weakSpotCooldownReduction = Math.max(0, weakSpotCooldownReduction);
  }

  public setEstimatedPunchPower(basePower: number, weakSpotMult: number) {
    this.estimatedBasePower = Math.max(1, basePower);
    this.estimatedWeakSpotMult = Math.max(1, weakSpotMult);
  }

  public setOverdriveMode(active: boolean) {
    this.overdriveActive = active;
  }

  public setBossMode(isBoss: boolean) {
    this.bossModeActive = isBoss;
    this.thresholdTrimMat.color.setHex(isBoss ? 0xef4444 : 0xd97706);
    this.backBayLight.color.setHex(isBoss ? 0xf43f5e : 0x38bdf8);
    this.backBayLight.intensity = isBoss ? 2.1 : 1.3;
  }

  public aimAtPointer(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const ndcX = THREE.MathUtils.clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    const ndcY = THREE.MathUtils.clamp(-((clientY - rect.top) / rect.height) * 2 + 1, -1, 1);
    this.cursorNdcX = ndcX;
    this.cursorNdcY = ndcY;

    if (this.targetMode === 'WALL') {
      _mouse.set(ndcX, ndcY);
      this.raycaster.setFromCamera(_mouse, this.camera);

      if (this.weakSpotActive && this.weakSpotGroup.visible) {
        const wsHits = this.raycaster.intersectObject(this.weakSpotHitbox, false);
        if (wsHits.length > 0) {
          this.isHoveringWeakSpot = true;
          this.currentAimWorldX = this.weakSpotPos.x;
          this.currentAimWorldY = this.weakSpotPos.y;
          return;
        }
      }
      this.isHoveringWeakSpot = false;

      const hit = this.raycaster.ray.intersectPlane(this.wallFacePlane, this.aimPointScratch);
      if (hit) {
        this.currentAimWorldX = THREE.MathUtils.clamp(hit.x, -2.35, 2.35);
        this.currentAimWorldY = THREE.MathUtils.clamp(hit.y, 0.35, 3.85);
      } else {
        this.currentAimWorldX = THREE.MathUtils.clamp(ndcX * 2.25, -2.35, 2.35);
        this.currentAimWorldY = THREE.MathUtils.clamp(1.82 + ndcY * 1.45, 0.35, 3.85);
      }
    } else {
      this.isHoveringWeakSpot = false;
    }
  }

  public punchAtPointer(clientX: number, clientY: number, isCrit: boolean) {
    this.aimAtPointer(clientX, clientY);
    let hitWeakSpot = false;
    let aimX: number | undefined;
    let aimY: number | undefined;

    if (this.targetMode === 'WALL') {
      _mouse.set(this.cursorNdcX, this.cursorNdcY);
      this.raycaster.setFromCamera(_mouse, this.camera);

      if (this.weakSpotActive && this.weakSpotGroup.visible) {
        const wsHits = this.raycaster.intersectObject(this.weakSpotHitbox, false);
        if (wsHits.length > 0) {
          hitWeakSpot = true;
          aimX = this.weakSpotPos.x;
          aimY = this.weakSpotPos.y;
        }
      }

      if (!hitWeakSpot) {
        aimX = this.currentAimWorldX;
        aimY = this.currentAimWorldY;
      }
    }

    this.triggerPunch(isCrit || hitWeakSpot, hitWeakSpot, aimX, aimY);
  }

  public triggerPunch(isCrit = false, isWeakSpot = false, aimX?: number, aimY?: number) {
    this.audio.unlock();
    const arm = this.nextIsRight ? this.rightArm : this.leftArm;
    const altArm = this.nextIsRight ? this.leftArm : this.rightArm;

    const chosen = arm.punchProgress < 0 || arm.punchProgress > 0.48 ? arm : altArm;
    if (chosen.punchProgress >= 0 && chosen.punchProgress < 0.32) return;

    const isRightChosen = chosen === this.rightArm;
    const side = isRightChosen ? 1 : -1;
    this.nextIsRight = !isRightChosen;
    chosen.punchProgress = 0;
    chosen.isCritSwing = isCrit;
    chosen.isWeakSpotSwing = isWeakSpot;
    chosen.hitTriggered = false;

    let worldTargetZ = 0.29;
    if (this.targetMode === 'BAG') {
      // Aim directly onto the Heavy Bag's front leather surface facing the camera
      const bagCenterX = -2.45;
      const bagCenterZ = 1.35;
      const toCamX = 0 - bagCenterX;
      const toCamZ = 3.05 - bagCenterZ;
      const len = Math.hypot(toCamX, toCamZ) || 1;
      const nx = toCamX / len;
      const nz = toCamZ / len;
      const tangentX = -nz;
      const tangentZ = nx;
      const sideJitter = THREE.MathUtils.clamp(this.cursorNdcX * 0.16, -0.18, 0.18);
      chosen.impactWorldX = bagCenterX + nx * 0.44 + tangentX * sideJitter;
      chosen.impactWorldY = THREE.MathUtils.clamp(2.15 + this.cursorNdcY * 0.42, 1.65, 2.75);
      worldTargetZ = bagCenterZ + nz * 0.44 + tangentZ * sideJitter;
    } else if (isWeakSpot && this.weakSpotActive) {
      chosen.impactWorldX = this.weakSpotPos.x;
      chosen.impactWorldY = this.weakSpotPos.y;
    } else if (aimX !== undefined && aimY !== undefined) {
      chosen.impactWorldX = THREE.MathUtils.clamp(aimX, -2.35, 2.35);
      chosen.impactWorldY = THREE.MathUtils.clamp(aimY, 0.35, 3.85);
    } else {
      // Keyboard / Auto-Punch tracks the active cursor or last tapped wall spot
      chosen.impactWorldX = THREE.MathUtils.clamp(
        this.currentAimWorldX + (Math.random() - 0.5) * 0.1,
        -2.35,
        2.35
      );
      chosen.impactWorldY = THREE.MathUtils.clamp(
        this.currentAimWorldY + (Math.random() - 0.5) * 0.1,
        0.35,
        3.85
      );
    }

    this.camera.updateMatrixWorld();
    _vec3.set(chosen.impactWorldX, chosen.impactWorldY, worldTargetZ);
    this.camera.worldToLocal(_vec3);

    const forwardDist = Math.max(1.2, -_vec3.z);
    chosen.targetApexZ = -Math.max(1.3, Math.min(2.1, forwardDist - 0.96));
    const reachScale = (-chosen.targetApexZ - 0.16) / forwardDist;

    chosen.targetOffsetX = THREE.MathUtils.clamp(_vec3.x * reachScale, -1.75, 1.75);
    chosen.targetOffsetY = THREE.MathUtils.clamp(_vec3.y * reachScale, -1.15, 1.35);
    chosen.targetYaw = THREE.MathUtils.clamp(
      -Math.atan2(_vec3.x - side * 0.2, forwardDist),
      -0.72,
      0.72
    );
    chosen.targetPitch = THREE.MathUtils.clamp(
      Math.atan2(_vec3.y + 0.06, forwardDist),
      -0.46,
      0.54
    );

    this.audio.playPunchSwing(isCrit || isWeakSpot);
  }

  private spawnPooledDebris(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    scale: number,
    colorHex: number,
    life: number
  ) {
    const idx = this.debrisCursor;
    const slot = this.debrisData[idx];
    this.debrisCursor = (idx + 1) % MAX_DEBRIS;

    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.rx = (Math.random() - 0.5) * 14;
    slot.ry = (Math.random() - 0.5) * 14;
    slot.rz = (Math.random() - 0.5) * 14;
    slot.ax = Math.random() * Math.PI;
    slot.ay = Math.random() * Math.PI;
    slot.az = Math.random() * Math.PI;
    slot.scaleX = scale * (0.7 + Math.random() * 0.6);
    slot.scaleY = scale * (0.6 + Math.random() * 0.5);
    slot.scaleZ = scale * (0.7 + Math.random() * 0.6);
    slot.life = life;
    slot.maxLife = life;

    _color.setHex(colorHex);
    this.debrisMesh.setColorAt(idx, _color);
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }

  private spawnPooledSpark(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    scale: number,
    colorHex: number,
    life: number,
    gravity = 9.5
  ) {
    const idx = this.sparkCursor;
    const slot = this.sparkData[idx];
    this.sparkCursor = (idx + 1) % MAX_SPARKS;

    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.gravity = gravity;
    slot.scale = scale;
    slot.life = life;
    slot.maxLife = life;

    _color.setHex(colorHex);
    this.sparkMesh.setColorAt(idx, _color);
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
  }

  private spawnShockRing(x: number, y: number, colorHex: number, maxLife: number, maxScale: number) {
    const ring = this.shockRingPool[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % MAX_RINGS;

    ring.active = true;
    ring.life = maxLife;
    ring.maxLife = maxLife;
    ring.maxScale = maxScale;
    ring.material.color.setHex(colorHex);
    ring.material.opacity = 0.92;
    ring.mesh.position.set(x, y, 0.315);
    ring.mesh.scale.setScalar(1);
    ring.mesh.visible = true;
  }

  public triggerWallShatter(material: WallMaterialKind) {
    this.audio.playWallShatter(material);
    this.shakeIntensity = 0.28;
    this.fovBoost = 10.5;
    this.hitStopTimer = 0.055;
    this.breakDashTimer = 0.72;
    this.breakSwapped = false;
    this.weakSpotActive = false;
    this.weakSpotGroup.visible = false;
    this.weakSpotScale = 0;
    this.weakSpotTimer = Math.max(3.5, 7.5 - this.weakSpotCooldownReduction * 0.5);

    this.impactFlashLight.color.setHex(
      material === 'diamond' ? 0x38bdf8 : material === 'obsidian' ? 0xf97316 : 0xfbbf24
    );
    this.impactFlashIntensity = 8.0;

    const colorHex = this.getDebrisColor(material);
    // Blast every remaining intact block outward as rubble!
    for (let i = 0; i < TOTAL_WALL_BLOCKS; i++) {
      const b = this.wallBlockStates[i];
      if (!b.broken) {
        b.broken = true;
        this.syncWallBlockTransform(i);
        if (Math.random() < 0.72) {
          this.spawnPooledDebris(
            b.baseX,
            b.baseY,
            b.baseZ,
            (b.baseX * 1.4) + (Math.random() - 0.5) * 4.5,
            1.6 + Math.random() * 4.8,
            -(3.2 + Math.random() * 6.8),
            1.25 + Math.random() * 1.3,
            colorHex,
            1.25 + Math.random() * 0.45
          );
        }
      }
    }
    this.wallInstancedMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 36; i++) {
      this.spawnPooledSpark(
        (Math.random() - 0.5) * 4.0,
        0.5 + Math.random() * 3.2,
        0.25,
        (Math.random() - 0.5) * 9.5,
        1.5 + Math.random() * 6.5,
        -(2 + Math.random() * 6),
        1.15,
        material === 'diamond' ? 0x7dd3fc : 0xfbbf24,
        0.52 + Math.random() * 0.25
      );
    }
  }

  private getDebrisColor(material: WallMaterialKind): number {
    switch (material) {
      case 'drywall':
        return 0xd6cec2;
      case 'wood':
        return 0x8b5a2b;
      case 'brick':
        return 0x9b3e2b;
      case 'concrete':
        return 0x6b7280;
      case 'steel':
        return 0x94a3b8;
      case 'obsidian':
        return 0xf97316;
      case 'diamond':
        return 0x38bdf8;
    }
  }

  private spawnImpactEffects(
    arm: ArmModel,
    isRightArm: boolean,
    isCrit: boolean,
    isWeakSpot: boolean
  ) {
    const side = isRightArm ? 1 : -1;
    this.cameraPunchRoll = side * (isWeakSpot ? -0.038 : isCrit ? -0.025 : -0.014);
    this.cameraPunchPitch = isWeakSpot ? 0.028 : isCrit ? 0.018 : 0.008;
    this.cameraPunchZ = isWeakSpot ? -0.11 : isCrit ? -0.07 : -0.035;
    this.shakeDirX = side;

    if (this.targetMode === 'WALL') {
      this.audio.playWallImpact(this.currentMaterialKind, isCrit, isWeakSpot);
      this.wallRecoilZ = isWeakSpot ? -0.24 : isCrit ? -0.16 : -0.085;
      this.shakeIntensity = isWeakSpot ? 0.16 : isCrit ? 0.1 : 0.042;
      this.fovBoost = isWeakSpot ? 6.5 : isCrit ? 4.2 : 1.6;

      if (isWeakSpot) {
        this.hitStopTimer = 0.052;
      } else if (isCrit) {
        this.hitStopTimer = 0.028;
      }

      const hitX = arm.impactWorldX;
      const hitY = arm.impactWorldY;

      if (isWeakSpot && this.weakSpotActive) {
        this.weakSpotActive = false;
        this.weakSpotGroup.visible = false;
        this.weakSpotScale = 0;
        this.weakSpotTimer = Math.max(4, 11 - this.weakSpotCooldownReduction + Math.random() * 3.5);
      }

      this.impactFlashLight.position.set(hitX, hitY, 0.85);
      this.impactFlashLight.color.setHex(
        isWeakSpot
          ? 0xf43f5e
          : isCrit
            ? 0xfbbf24
            : this.currentMaterialKind === 'diamond'
              ? 0x38bdf8
              : 0xffedd5
      );
      this.impactFlashIntensity = isWeakSpot ? 6.8 : isCrit ? 4.4 : 2.1;

      const estimatedDmg = Math.max(
        1,
        Math.round(
          this.estimatedBasePower *
            (isCrit ? 2.0 : 1) *
            (isWeakSpot ? this.estimatedWeakSpotMult : 1)
        )
      );
      const hitDamageRatio = Math.min(1, estimatedDmg / Math.max(1, this.currentWallMaxHp));
      const projectedDamageRatio = Math.min(1, this.wallDamageRatio + hitDamageRatio);
      this.wallDamageRatio = projectedDamageRatio;

      const chunksBroken =
        projectedDamageRatio >= 1
          ? 0
          : this.applyLocalizedWallChip(
              hitX,
              hitY,
              projectedDamageRatio,
              isCrit,
              isWeakSpot
            );

      this.spawnShockRing(
        hitX,
        hitY,
        isWeakSpot
          ? 0xf43f5e
          : this.overdriveActive
            ? 0xf97316
            : isCrit
              ? 0xfbbf24
              : 0xffffff,
        isWeakSpot || this.overdriveActive ? 0.38 : 0.28,
        isWeakSpot ? 5.2 : this.overdriveActive ? 4.7 : 3.8
      );

      const debrisCount = isWeakSpot ? 18 : this.overdriveActive ? 14 : isCrit ? 12 : 7;
      const colorHex = isWeakSpot ? 0xf59e0b : this.getDebrisColor(this.currentMaterialKind);
      for (let i = 0; i < debrisCount; i++) {
        this.spawnPooledDebris(
          hitX,
          hitY,
          0.32,
          (Math.random() - 0.5) * (isWeakSpot ? 6.8 : 4.6),
          1.4 + Math.random() * 4.2,
          1.5 + Math.random() * 3.8,
          (isWeakSpot ? 0.72 : 0.48) + Math.random() * 0.62,
          colorHex,
          0.75 + Math.random() * 0.4
        );
      }

      const sparkCount = isWeakSpot ? 18 : this.overdriveActive ? 14 : isCrit ? 10 : 5;
      const sparkHex = isWeakSpot
        ? 0xfb7185
        : this.overdriveActive
          ? 0xf97316
          : isCrit
            ? 0xfde047
            : this.currentMaterialKind === 'steel'
              ? 0xfdba74
              : 0xffffff;
      for (let i = 0; i < sparkCount; i++) {
        this.spawnPooledSpark(
          hitX,
          hitY,
          0.35,
          (Math.random() - 0.5) * 6.5,
          (Math.random() - 0.2) * 5.2,
          1.8 + Math.random() * 4.5,
          isWeakSpot || this.overdriveActive ? 1.15 : 0.85,
          sparkHex,
          0.26 + Math.random() * 0.18
        );
      }

      _vec3.set(hitX, hitY, 0.32).project(this.camera);
      const sx = ((_vec3.x + 1) * 0.5) * 100;
      const sy = ((1 - _vec3.y) * 0.5) * 100;
      this.callbacks.onPunchHit('WALL', isCrit, sx, sy, isWeakSpot, chunksBroken);
    } else {
      this.audio.playBagImpact(isCrit);
      this.bagVelZ -= isCrit ? 4.4 : 2.5;
      this.bagVelX += -side * (isCrit ? 2.2 : 1.1);
      this.shakeIntensity = isCrit ? 0.065 : 0.025;
      this.fovBoost = isCrit ? 3.0 : 1.1;

      _vec3.set(arm.impactWorldX, arm.impactWorldY, 1.55).project(this.camera);
      const sx = ((_vec3.x + 1) * 0.5) * 100;
      const sy = ((1 - _vec3.y) * 0.5) * 100;
      this.callbacks.onPunchHit('BAG', isCrit, sx, sy, false, 0);
    }
  }

  private updateArm(arm: ArmModel, isRight: boolean, dt: number, elapsed: number) {
    const side = isRight ? 1 : -1;
    const idleBob = Math.sin(elapsed * 4.2 + (isRight ? 0 : Math.PI)) * 0.017;
    const idleSway = Math.cos(elapsed * 2.1 + (isRight ? 0 : 0.8)) * 0.014;
    const idleRoll = Math.sin(elapsed * 2.1) * 0.022;

    const guardAimX = this.smoothAimX * 0.26;
    const guardAimY = this.smoothAimY * 0.18;
    const guardAimYaw = -this.smoothAimX * 0.36;
    const guardAimPitch = this.smoothAimY * 0.28;
    const guardRollOffset = -this.smoothAimX * 0.08;

    const guardPosX = arm.basePos.x + guardAimX;
    const guardPosY = arm.basePos.y + guardAimY;
    const guardRotX = arm.baseRot.x + guardAimPitch;
    const guardRotY = arm.baseRot.y + guardAimYaw;
    const guardRotZ = arm.baseRot.z + guardRollOffset;

    if (arm.punchProgress < 0) {
      arm.root.position.x = THREE.MathUtils.damp(arm.root.position.x, guardPosX + idleSway, 16, dt);
      arm.root.position.y = THREE.MathUtils.damp(arm.root.position.y, guardPosY + idleBob, 16, dt);
      arm.root.position.z = THREE.MathUtils.damp(arm.root.position.z, arm.basePos.z, 16, dt);
      arm.root.rotation.x = THREE.MathUtils.damp(arm.root.rotation.x, guardRotX, 16, dt);
      arm.root.rotation.y = THREE.MathUtils.damp(arm.root.rotation.y, guardRotY, 16, dt);
      arm.root.rotation.z = THREE.MathUtils.damp(arm.root.rotation.z, guardRotZ + idleRoll, 16, dt);
      arm.wristGroup.position.z = THREE.MathUtils.damp(arm.wristGroup.position.z, 0, 18, dt);
      if (arm.robotPistons.length === 2) {
        arm.robotPistons[0].position.z = THREE.MathUtils.damp(arm.robotPistons[0].position.z, 0.15, 16, dt);
        arm.robotPistons[1].position.z = THREE.MathUtils.damp(arm.robotPistons[1].position.z, 0.15, 16, dt);
      }
      return;
    }

    const duration = 0.235 / this.punchSpeedMult;
    arm.punchProgress += dt / duration;
    const p = arm.punchProgress;

    if (p < 0.2) {
      const t = smoothstep(p / 0.2);
      arm.root.position.set(
        guardPosX + side * 0.068 * t,
        guardPosY - 0.044 * t,
        arm.basePos.z + 0.15 * t
      );
      arm.root.rotation.set(guardRotX + 0.16 * t, guardRotY, guardRotZ);
      arm.wristGroup.position.z = 0;
    } else if (p < 0.46) {
      const rawT = (p - 0.2) / 0.26;
      const ease = 1 - Math.pow(1 - rawT, 4);
      arm.root.position.set(
        THREE.MathUtils.lerp(guardPosX + side * 0.068, arm.targetOffsetX, ease),
        THREE.MathUtils.lerp(guardPosY - 0.044, arm.targetOffsetY, ease),
        THREE.MathUtils.lerp(arm.basePos.z + 0.15, arm.targetApexZ, ease)
      );
      arm.root.rotation.set(
        THREE.MathUtils.lerp(guardRotX + 0.16, arm.targetPitch, ease),
        THREE.MathUtils.lerp(guardRotY, arm.targetYaw, ease),
        THREE.MathUtils.lerp(guardRotZ, side * 0.76, ease)
      );
      // Compress wrist + slide hydraulic robot pistons at strike apex
      const impactSnap = rawT > 0.78 ? (rawT - 0.78) * 0.22 : 0;
      arm.wristGroup.position.z = impactSnap;
      if (arm.robotPistons.length === 2) {
        arm.robotPistons[0].position.z = 0.15 - ease * 0.07;
        arm.robotPistons[1].position.z = 0.15 - ease * 0.07;
      }

      if (rawT >= 0.84 && !arm.hitTriggered) {
        arm.hitTriggered = true;
        this.spawnImpactEffects(arm, isRight, arm.isCritSwing, arm.isWeakSpotSwing);
      }
    } else if (p < 1.0) {
      if (!arm.hitTriggered) {
        arm.hitTriggered = true;
        this.spawnImpactEffects(arm, isRight, arm.isCritSwing, arm.isWeakSpotSwing);
      }
      const t = smoothstep((p - 0.46) / 0.54);
      arm.root.position.set(
        THREE.MathUtils.lerp(arm.targetOffsetX, guardPosX + idleSway, t),
        THREE.MathUtils.lerp(arm.targetOffsetY, guardPosY + idleBob, t),
        THREE.MathUtils.lerp(arm.targetApexZ, arm.basePos.z, t)
      );
      arm.root.rotation.set(
        THREE.MathUtils.lerp(arm.targetPitch, guardRotX, t),
        THREE.MathUtils.lerp(arm.targetYaw, guardRotY, t),
        THREE.MathUtils.lerp(side * 0.76, guardRotZ + idleRoll, t)
      );
      arm.wristGroup.position.z = THREE.MathUtils.lerp(0.045, 0, t);
      if (arm.robotPistons.length === 2) {
        arm.robotPistons[0].position.z = THREE.MathUtils.lerp(0.08, 0.15, t);
        arm.robotPistons[1].position.z = THREE.MathUtils.lerp(0.08, 0.15, t);
      }
    } else {
      arm.punchProgress = -1;
      arm.wristGroup.position.z = 0;
    }
  }

  private updateWeakSpot(dt: number, elapsed: number) {
    if (this.targetMode !== 'WALL' || this.breakDashTimer > 0) return;

    if (!this.weakSpotActive) {
      this.weakSpotTimer -= dt;
      if (this.weakSpotTimer <= 0) {
        this.weakSpotActive = true;
        this.weakSpotLife = 7.5;
        this.weakSpotScale = 0.01;
        this.weakSpotPos.set((Math.random() - 0.5) * 2.8, 1.15 + Math.random() * 1.45);
        this.weakSpotGroup.position.set(this.weakSpotPos.x, this.weakSpotPos.y, 0.32);
        this.weakSpotGroup.scale.setScalar(0.01);
        this.weakSpotGroup.visible = true;
      }
    } else {
      this.weakSpotLife -= dt;
      this.weakSpotScale = THREE.MathUtils.damp(this.weakSpotScale, 1, 14, dt);
      this.weakSpotGroup.scale.setScalar(this.weakSpotScale);

      const pulse = 1 + Math.sin(elapsed * 10) * 0.12;
      this.weakSpotCore.scale.setScalar(pulse);
      this.weakSpotRing.scale.setScalar(1.12 - Math.sin(elapsed * 7) * 0.1);
      this.weakSpotRing.rotation.z += dt * 3.2;

      if (this.weakSpotLife <= 0) {
        this.weakSpotActive = false;
        this.weakSpotGroup.visible = false;
        this.weakSpotScale = 0;
        this.weakSpotTimer = Math.max(4, 11 - this.weakSpotCooldownReduction + Math.random() * 3.5);
      }
    }
  }

  private updatePools(simDt: number) {
    let debrisDirty = false;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const d = this.debrisData[i];
      if (!d.active) continue;
      debrisDirty = true;

      d.vy -= 14.5 * simDt;
      d.x += d.vx * simDt;
      d.y += d.vy * simDt;
      d.z += d.vz * simDt;
      d.ax += d.rx * simDt;
      d.ay += d.ry * simDt;
      d.az += d.rz * simDt;

      if (d.y < 0.08) {
        d.y = 0.08;
        d.vy = Math.abs(d.vy) * 0.35;
        d.vx *= 0.72;
        d.vz *= 0.72;
      }

      d.life -= simDt;
      if (d.life <= 0) {
        d.active = false;
        _mat4.makeScale(0, 0, 0);
        this.debrisMesh.setMatrixAt(i, _mat4);
      } else {
        const fade = Math.min(1, d.life / 0.25);
        _pos.set(d.x, d.y, d.z);
        _euler.set(d.ax, d.ay, d.az);
        _quat.setFromEuler(_euler);
        _scale.set(d.scaleX * fade, d.scaleY * fade, d.scaleZ * fade);
        _mat4.compose(_pos, _quat, _scale);
        this.debrisMesh.setMatrixAt(i, _mat4);
      }
    }
    if (debrisDirty) this.debrisMesh.instanceMatrix.needsUpdate = true;

    let sparksDirty = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparkData[i];
      if (!s.active) continue;
      sparksDirty = true;

      s.vy -= s.gravity * simDt;
      s.x += s.vx * simDt;
      s.y += s.vy * simDt;
      s.z += s.vz * simDt;

      s.life -= simDt;
      if (s.life <= 0) {
        s.active = false;
        _mat4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, _mat4);
      } else {
        const t = Math.max(0, s.life / s.maxLife);
        _pos.set(s.x, s.y, s.z);
        _quat.identity();
        _scale.setScalar(s.scale * t);
        _mat4.compose(_pos, _quat, _scale);
        this.sparkMesh.setMatrixAt(i, _mat4);
      }
    }
    if (sparksDirty) this.sparkMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < MAX_RINGS; i++) {
      const r = this.shockRingPool[i];
      if (!r.active) continue;
      r.life -= simDt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
      } else {
        const t = 1 - r.life / r.maxLife;
        r.mesh.scale.setScalar(1 + smoothstep(t) * r.maxScale);
        r.material.opacity = (1 - t) * 0.92;
      }
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const rawDt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;

      let simDt = rawDt;
      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= rawDt;
        simDt = rawDt * 0.08;
      }

      if (!this.paused && this.autoPunchEnabled && this.breakDashTimer <= 0) {
        this.autoPunchTimer -= simDt;
        if (this.autoPunchTimer <= 0) {
          this.autoPunchTimer = Math.max(0.13, 0.32 / this.punchSpeedMult);
          this.triggerPunch(false, false);
        }
      }

      if (
        this.overdriveActive ||
        this.currentGloveStyle === 'flaming' ||
        this.currentGloveStyle === 'plasma' ||
        this.currentGloveStyle === 'celestial' ||
        this.currentGloveStyle === 'emerald' ||
        this.currentGloveStyle === 'frost' ||
        this.currentGloveStyle === 'obsidian_fist' ||
        this.currentGloveStyle === 'neon_synth' ||
        this.currentGloveStyle === 'void_reaver' ||
        this.currentGloveStyle === 'crimson_demon' ||
        this.currentGloveStyle === 'quantum' ||
        this.currentGloveStyle === 'galaxian'
      ) {
        this.emberSpawnTimer -= rawDt;
        this.auraAudioTimer -= rawDt;
        if (this.emberSpawnTimer <= 0) {
          this.emberSpawnTimer =
            this.graphicsQuality === 'low' ? 0.11 : this.overdriveActive ? 0.04 : 0.065;
          const side = Math.random() < 0.5 ? -0.44 : 0.44;
          const sparkHex = this.overdriveActive
            ? Math.random() > 0.4
              ? 0xf97316
              : 0xf43f5e
            : this.currentGloveStyle === 'plasma' || this.currentGloveStyle === 'void_reaver'
              ? Math.random() > 0.4
                ? 0xc084fc
                : 0x38bdf8
              : this.currentGloveStyle === 'frost' || this.currentGloveStyle === 'quantum'
                ? Math.random() > 0.4
                  ? 0x22d3ee
                  : 0xe0f2fe
                : this.currentGloveStyle === 'emerald'
                  ? 0x34d399
                  : this.currentGloveStyle === 'neon_synth'
                    ? Math.random() > 0.5
                      ? 0xf472b6
                      : 0x22d3ee
                    : this.currentGloveStyle === 'celestial' || this.currentGloveStyle === 'galaxian'
                      ? Math.random() > 0.4
                        ? 0xfef08a
                        : 0xa855f7
                      : Math.random() > 0.35
                        ? 0xf97316
                        : 0xfacc15;
          this.spawnPooledSpark(
            side + (Math.random() - 0.5) * 0.16,
            1.36,
            2.42,
            (Math.random() - 0.5) * 0.35,
            0.9 + Math.random() * 0.7,
            -0.25,
            0.55 + Math.random() * 0.35,
            sparkHex,
            0.42,
            -1.4
          );

          if (!this.paused && this.auraAudioTimer <= 0) {
            this.auraAudioTimer = 0.34 + Math.random() * 0.16;
            this.audio.playGloveAuraTick(this.currentGloveStyle);
          }
        }
        this.knuckleMaterial.emissiveIntensity =
          (this.overdriveActive ? 1.45 : 1.05) + Math.sin(elapsed * 9) * 0.25;
      }

      if (this.impactFlashIntensity > 0.01) {
        this.impactFlashIntensity = THREE.MathUtils.damp(this.impactFlashIntensity, 0, 18, rawDt);
        this.impactFlashLight.intensity = this.impactFlashIntensity;
      } else {
        this.impactFlashLight.intensity = 0;
      }

      this.smoothAimX = THREE.MathUtils.damp(this.smoothAimX, this.cursorNdcX, 14, rawDt);
      this.smoothAimY = THREE.MathUtils.damp(this.smoothAimY, this.cursorNdcY, 14, rawDt);

      const desiredYaw =
        (this.targetMode === 'BAG' ? 0.94 : 0) -
        this.smoothAimX * (this.targetMode === 'BAG' ? 0.06 : 0.085);
      const desiredPitch = this.smoothAimY * 0.05;
      this.cameraYaw = THREE.MathUtils.damp(this.cameraYaw, desiredYaw, 10, rawDt);
      this.cameraPunchRoll = THREE.MathUtils.damp(this.cameraPunchRoll, 0, 16, rawDt);
      this.cameraPunchPitch = THREE.MathUtils.damp(this.cameraPunchPitch, 0, 16, rawDt);
      this.cameraPunchZ = THREE.MathUtils.damp(this.cameraPunchZ, 0, 16, rawDt);

      this.cameraRig.rotation.set(
        desiredPitch + this.cameraPunchPitch,
        this.cameraYaw,
        this.cameraPunchRoll
      );

      if (this.breakDashTimer > 0) {
        this.breakDashTimer -= simDt;
        const progress = 1 - Math.max(0, this.breakDashTimer) / 0.72;
        if (progress < 0.46) {
          const t = smoothstep(progress / 0.46);
          this.cameraRig.position.z = THREE.MathUtils.lerp(3.05, 0.85, t);
          this.wallGroup.position.z = THREE.MathUtils.lerp(0, -3.5, t);
        } else {
          if (!this.breakSwapped) {
            this.breakSwapped = true;
            this.callbacks.onWallBreakTransitionComplete();
          }
          const t = smoothstep((progress - 0.46) / 0.54);
          this.cameraRig.position.z = THREE.MathUtils.lerp(0.85, 3.05, t);
          this.wallGroup.position.z = THREE.MathUtils.lerp(-5.2, 0, t);
        }
        if (this.breakDashTimer <= 0) {
          this.cameraRig.position.z = 3.05;
          this.wallGroup.position.z = 0;
          if (!this.breakSwapped) {
            this.breakSwapped = true;
            this.callbacks.onWallBreakTransitionComplete();
          }
        }
      } else {
        this.cameraRig.position.z = THREE.MathUtils.damp(
          this.cameraRig.position.z,
          3.05 + this.cameraPunchZ,
          14,
          simDt
        );
        this.wallRecoilZ = THREE.MathUtils.damp(this.wallRecoilZ, 0, 20, simDt);
        this.wallGroup.position.z = this.wallRecoilZ;
      }

      if (this.shakeIntensity > 0.001) {
        const waveX = Math.sin(elapsed * 62) * 0.65 + Math.cos(elapsed * 94) * 0.35;
        const waveY = Math.cos(elapsed * 73) * 0.65 + Math.sin(elapsed * 109) * 0.35;
        const scaledShake = this.shakeIntensity * this.shakeMultiplier;
        this.camera.position.set(
          waveX * scaledShake * this.shakeDirX,
          waveY * scaledShake * 0.75,
          0
        );
        this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 18, rawDt);
      } else {
        this.camera.position.set(0, 0, 0);
      }

      this.fovBoost = THREE.MathUtils.damp(this.fovBoost, 0, 13, rawDt);
      const targetFov = 68 + (this.overdriveActive ? 4.0 : 0) + this.fovBoost;
      if (Math.abs(this.camera.fov - targetFov) > 0.04) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }

      const stiffness = 28;
      const damping = 3.4;
      this.bagVelX += (-stiffness * this.bagAngleX - damping * this.bagVelX) * simDt;
      this.bagVelZ += (-stiffness * this.bagAngleZ - damping * this.bagVelZ) * simDt;
      this.bagAngleX += this.bagVelX * simDt;
      this.bagAngleZ += this.bagVelZ * simDt;
      this.bagPivot.rotation.set(this.bagAngleZ, 0, -this.bagAngleX);
      if (this.bagAuraRing.visible) {
        this.bagAuraRing.rotation.z += simDt * 1.4;
      }
      if (this.bossModeActive) {
        this.backBayLight.intensity = 1.85 + Math.sin(elapsed * 4.5) * 0.35;
      }

      this.updateWeakSpot(simDt, elapsed);
      this.updateArm(this.leftArm, false, simDt, elapsed);
      this.updateArm(this.rightArm, true, simDt, elapsed);
      this.updatePools(simDt);

      // Update 3D Splash-Damage Reticle smoothly on Wall face
      const showReticle = this.targetMode === 'WALL' && this.breakDashTimer <= 0;
      this.splashReticleGroup.visible = showReticle;
      if (showReticle) {
        this.splashReticleGroup.position.x = THREE.MathUtils.damp(
          this.splashReticleGroup.position.x,
          this.currentAimWorldX,
          24,
          rawDt
        );
        this.splashReticleGroup.position.y = THREE.MathUtils.damp(
          this.splashReticleGroup.position.y,
          this.currentAimWorldY,
          24,
          rawDt
        );
        const reticleScale =
          this.effectiveSplashRadius * (this.isHoveringWeakSpot ? 1.55 : 1.0);
        const pulse = this.isHoveringWeakSpot ? 1 + Math.sin(elapsed * 12) * 0.05 : 1.0;
        this.splashReticleGroup.scale.setScalar(
          THREE.MathUtils.damp(this.splashReticleGroup.scale.x, reticleScale * pulse, 18, rawDt)
        );
        if (this.isHoveringWeakSpot) {
          this.splashOuterRingMat.color.setHex(0xf43f5e);
          this.splashOuterRingMat.opacity = 0.85;
          this.splashFillMat.color.setHex(0xf43f5e);
          this.splashFillMat.opacity = 0.17;
        } else {
          this.splashOuterRingMat.color.setHex(0xfbbf24);
          this.splashOuterRingMat.opacity = 0.56;
          this.splashFillMat.color.setHex(0xf59e0b);
          this.splashFillMat.opacity = 0.1;
        }
      }

      // Dynamically focus Depth of Field on active target (Wall vs Heavy Bag)
      if (
        this.dofEnabled &&
        this.graphicsQuality !== 'low' &&
        !this.isSoftwareGl &&
        this.composer &&
        this.bokehPass
      ) {
        const targetFocus =
          this.targetMode === 'WALL'
            ? Math.max(0.7, this.cameraRig.position.z - 0.29 - this.wallRecoilZ)
            : 2.52;
        const focusUniform = (
          this.bokehPass.uniforms as Record<string, THREE.IUniform<number>>
        )['focus'];
        if (focusUniform) {
          focusUniform.value = THREE.MathUtils.damp(focusUniform.value, targetFocus, 10, rawDt);
        }
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void) {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(320, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    if (this.composer && this.bokehPass) {
      this.composer.setSize(w, h);
      this.bokehPass.setSize(w, h);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);

    this.debrisMesh.geometry.dispose();
    (this.debrisMesh.material as THREE.Material).dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.wallInstancedMesh.geometry.dispose();
    this.wallMaterial.dispose();
    this.shockRingPool.forEach((r) => {
      this.scene.remove(r.mesh);
      r.material.dispose();
    });
    this.sharedRingGeo.dispose();

    this.wallMapCache.forEach((maps) => {
      maps.map.dispose();
      maps.normalMap.dispose();
      maps.roughnessMap.dispose();
      maps.emissiveMap?.dispose();
    });
    this.wallMapCache.clear();
    this.bagMapCache.forEach((maps) => {
      maps.map.dispose();
      maps.normalMap.dispose();
      maps.roughnessMap.dispose();
    });
    this.bagMapCache.clear();
    this.floorMaps.map.dispose();
    this.floorMaps.normalMap.dispose();
    this.floorMaps.roughnessMap.dispose();
    this.gloveMaps.map.dispose();
    this.gloveMaps.normalMap.dispose();
    this.skinMaps.map.dispose();
    this.skinMaps.normalMap.dispose();

    this.bokehPass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
