import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { IFCMeshData, IFCStorey } from './ifc-manager';

// ── Public types ───────────────────────────────────────────────────

export type ViewMode = 'perspective' | 'top' | 'front' | 'side';
export type ToolMode =
  | 'orbit' | 'pan' | 'zoom' | 'firstPerson'
  | 'measure' | 'section' | 'explode' | 'markup';

export interface MeasureInfo {
  pointA: THREE.Vector3 | null;
  pointB: THREE.Vector3 | null;
  distance: number | null;
}

export interface MarkupItem {
  id: number;
  position: THREE.Vector3;
  text: string;
}

export interface GraphicsSettings {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  wireframe: boolean;
  flatShading: boolean;
  showGrid: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────

const QUALITY_PIXEL_RATIO: Record<GraphicsSettings['quality'], number> = {
  low:   0.5,
  medium: 1.0,
  high:   Math.min(window.devicePixelRatio, 1.5),
  ultra:  Math.min(window.devicePixelRatio, 2.0),
};

// requestIdleCallback polyfill
const scheduleIdle: (cb: (deadline: { timeRemaining(): number }) => void, opts?: { timeout: number }) => number =
  typeof requestIdleCallback !== 'undefined'
    ? (cb, opts) => requestIdleCallback(cb, opts)
    : (cb) => window.setTimeout(() => cb({ timeRemaining: () => 16 }), 0) as unknown as number;

const cancelIdle: (id: number) => void =
  typeof cancelIdleCallback !== 'undefined'
    ? (id) => cancelIdleCallback(id)
    : (id) => clearTimeout(id);

// ── ThreeScene ────────────────────────────────────────────────────

export class ThreeScene {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private perspCamera!: THREE.PerspectiveCamera;
  private orthoCamera!: THREE.OrthographicCamera;
  private controls!: OrbitControls;
  private canvas: HTMLCanvasElement | null = null;
  private animID = 0;
  private grid!: THREE.GridHelper;

  private meshGroup!: THREE.Group;
  private overlayGroup!: THREE.Group;
  private highlightMesh: THREE.Mesh | null = null;

  // expressID → meshes created for that element
  private allMeshes: Map<number, THREE.Mesh[]> = new Map();
  // raw data kept for fly-to bounding box and highlight extraction
  private rawData: Map<number, IFCMeshData[]> = new Map();

  private selectedExpressID = -1;
  private viewMode: ViewMode = 'perspective';
  private toolMode: ToolMode = 'orbit';

  // Clip planes: single (section) or dual (2D plan)
  private singleClipPlane: THREE.Plane | null = null;
  private dualClipPlanes: [THREE.Plane, THREE.Plane] | null = null;
  private _is2DPlan = false;

  // Callbacks
  private onSelectCB:        ((id: number) => void)  | null = null;
  private onMeasureUpdateCB: ((info: MeasureInfo) => void) | null = null;
  private onMarkupRequestCB: ((pos: THREE.Vector3, screen: { x: number; y: number }) => void) | null = null;
  private onSectionChangeCB: ((elevation: number) => void) | null = null;
  private onFpsUpdateCB:     ((fps: number) => void) | null = null;

  // Event handlers
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp:   ((e: PointerEvent) => void) | null = null;
  private boundKeyDown:     ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp:       ((e: KeyboardEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Drag tracking
  private _isDragging = false;
  private _dragStartX = 0;
  private _dragStartY = 0;

  // Measure
  private measurePoints: THREE.Vector3[] = [];
  private measureMarkers: THREE.Mesh[] = [];
  private measureLine: THREE.Line | null = null;

  // First-person
  private fpDragging = false;
  private fpLastX = 0;
  private fpLastY = 0;
  private fpKeys: Record<string, boolean> = {};
  private fpYaw = 0;
  private fpPitch = 0;
  private fpSpeed = 0.5;

  // Section drag
  private sectionDragging = false;
  private sectionDragStartY = 0;
  private sectionDragStartElev = 0;
  private modelHeight = 10;

  // Explode
  private explodeData: { mesh: THREE.Mesh; origPos: THREE.Vector3; centroid: THREE.Vector3 }[] = [];
  private _modelCenter = new THREE.Vector3();
  private _explodeFactor = 0;

  // Markup
  private markupItems: MarkupItem[] = [];
  private markupSpheres: Map<number, THREE.Mesh> = new Map();
  private markupIdCounter = 0;

  // ── FPS tracking ──────────────────────────────────────────────────
  private _fps = 0;
  private _fpsFrameCount = 0;
  private _fpsLastTime = 0;

  // ── Streaming mesh queue ──────────────────────────────────────────
  private _meshQueue: IFCMeshData[] = [];
  private _idleHandle: number | null = null;
  private _loadComplete = false;

  // ── Graphics settings ─────────────────────────────────────────────
  private _gfxSettings: GraphicsSettings = {
    quality: 'high',
    wireframe: false,
    flatShading: false,
    showGrid: true,
  };

  // ── Construction simulation ───────────────────────────────────────
  private _storeyElements: Map<number, Set<number>> = new Map(); // storeyExpressID → expressIDs
  private _simTimer: number | null = null;

  // ── Init ──────────────────────────────────────────────────────────

  init(
    canvas: HTMLCanvasElement,
    onSelect: (id: number) => void,
    onMeasureUpdate?: (info: MeasureInfo) => void,
    onMarkupRequest?: (pos: THREE.Vector3, screen: { x: number; y: number }) => void,
    onSectionChange?: (elevation: number) => void,
    onFpsUpdate?: (fps: number) => void,
  ): void {
    this.canvas = canvas;
    this.onSelectCB        = onSelect;
    this.onMeasureUpdateCB = onMeasureUpdate ?? null;
    this.onMarkupRequestCB = onMarkupRequest ?? null;
    this.onSectionChangeCB = onSectionChange ?? null;
    this.onFpsUpdateCB     = onFpsUpdate ?? null;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(QUALITY_PIXEL_RATIO[this._gfxSettings.quality]);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setClearColor(0x0d1117);
    this.renderer.localClippingEnabled = true;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);

    // Cameras
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    this.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.01, 10000);
    this.perspCamera.position.set(50, 50, 50);

    const orthoSize = 100;
    this.orthoCamera = new THREE.OrthographicCamera(
      (-orthoSize * aspect) / 2, (orthoSize * aspect) / 2,
      orthoSize / 2, -orthoSize / 2, 0.01, 10000,
    );
    this.orthoCamera.position.set(0, 500, 0);

    // Controls (perspective default)
    this.controls = new OrbitControls(this.perspCamera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(100, 200, 100);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0x6699cc, 0.3);
    fill.position.set(-100, -50, -100);
    this.scene.add(fill);

    // Grid
    this.grid = new THREE.GridHelper(500, 50, 0x1e293b, 0x1e293b);
    this.scene.add(this.grid);

    // Groups
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);
    this.overlayGroup = new THREE.Group();
    this.scene.add(this.overlayGroup);

    // Pointer / key handlers
    this.boundPointerDown = (e) => this._onPointerDown(e);
    this.boundPointerMove = (e) => this._onPointerMove(e);
    this.boundPointerUp   = (e) => this._onPointerUp(e);
    this.boundKeyDown     = (e) => this._onKeyDown(e);
    this.boundKeyUp       = (e) => this._onKeyUp(e);

    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointermove', this.boundPointerMove);
    canvas.addEventListener('pointerup',   this.boundPointerUp);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup',   this.boundKeyUp);

    // Resize
    this.resizeObserver = new ResizeObserver(() => this._resize(canvas));
    this.resizeObserver.observe(canvas.parentElement ?? canvas);

    // RAF loop
    const animate = () => {
      this.animID = requestAnimationFrame(animate);
      this._tickFps();
      if (this.toolMode === 'firstPerson') {
        this._updateFP();
      } else {
        this.controls.update();
      }
      const cam = this.viewMode === 'perspective' ? this.perspCamera : this.orthoCamera;
      this.renderer.render(this.scene, cam);
    };
    animate();
  }

  // ── FPS ───────────────────────────────────────────────────────────

  private _tickFps(): void {
    const now = performance.now();
    if (this._fpsLastTime === 0) { this._fpsLastTime = now; return; }
    this._fpsFrameCount++;
    const elapsed = now - this._fpsLastTime;
    if (elapsed >= 500) {
      this._fps = Math.round(this._fpsFrameCount * 1000 / elapsed);
      this._fpsFrameCount = 0;
      this._fpsLastTime = now;
      this.onFpsUpdateCB?.(this._fps);
    }
  }

  getFps(): number { return this._fps; }

  // ── Streaming mesh queue ──────────────────────────────────────────

  /** Called per mesh streamed from the Web Worker */
  queueMesh(data: IFCMeshData): void {
    this._meshQueue.push(data);
    if (this._idleHandle === null) this._scheduleQueueProcessing();
  }

  /** Called once when the worker signals LOAD_DONE */
  finalizeLoad(): void {
    this._loadComplete = true;
    // If queue already empty, finalize right now
    if (this._meshQueue.length === 0) this._onAllMeshesAdded();
  }

  private _scheduleQueueProcessing(): void {
    this._idleHandle = scheduleIdle(
      (dl) => this._processMeshQueue(dl),
      { timeout: 100 },
    );
  }

  private _processMeshQueue(deadline: { timeRemaining(): number }): void {
    this._idleHandle = null;
    let added = 0;
    while (this._meshQueue.length > 0 && (added < 10 || deadline.timeRemaining() > 2)) {
      this._addOneMesh(this._meshQueue.shift()!);
      added++;
      if (added >= 300) break; // hard cap per idle slot
    }
    if (this._meshQueue.length > 0) {
      this._scheduleQueueProcessing();
    } else if (this._loadComplete) {
      this._onAllMeshesAdded();
    }
  }

  private _addOneMesh(data: IFCMeshData): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(data.normals, 3));
    geo.setIndex(new THREE.Uint32BufferAttribute(data.indices, 1));

    const { r, g, b, a } = data.color;
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(r, g, b),
      opacity:     a < 0.99 ? a : 1,
      transparent: a < 0.99,
      side:        THREE.DoubleSide,
      wireframe:   this._gfxSettings.wireframe,
      flatShading: this._gfxSettings.flatShading,
      clippingPlanes: this._activeClipPlanes(),
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData['expressID'] = data.expressID;

    const m = data.matrix;
    const mat4 = new THREE.Matrix4();
    mat4.set(
      m[0], m[4], m[8],  m[12],
      m[1], m[5], m[9],  m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15],
    );
    mesh.applyMatrix4(mat4);

    if (!this.allMeshes.has(data.expressID)) this.allMeshes.set(data.expressID, []);
    this.allMeshes.get(data.expressID)!.push(mesh);

    // Keep raw data for fly-to and highlight
    if (!this.rawData.has(data.expressID)) this.rawData.set(data.expressID, []);
    this.rawData.get(data.expressID)!.push(data);

    this.meshGroup.add(mesh);
  }

  private _onAllMeshesAdded(): void {
    this.fitCamera();
    this._computeExplodeData();
  }

  // ── Graphics settings ─────────────────────────────────────────────

  applyGraphicsSettings(s: GraphicsSettings): void {
    this._gfxSettings = s;
    this.renderer.setPixelRatio(QUALITY_PIXEL_RATIO[s.quality]);
    this.grid.visible = s.showGrid;
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshPhongMaterial;
      mat.wireframe   = s.wireframe;
      mat.flatShading = s.flatShading;
      mat.needsUpdate = true;
    });
  }

  getGraphicsSettings(): GraphicsSettings { return { ...this._gfxSettings }; }

  // ── Fly-to element ────────────────────────────────────────────────

  flyToElement(expressID: number): void {
    const meshes = this.allMeshes.get(expressID);
    if (!meshes?.length) return;

    const box = new THREE.Box3();
    meshes.forEach(m => box.expandByObject(m));
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const dist   = Math.max(size.x, size.y, size.z) * 2.5 + 1;

    const endPos = center.clone().add(new THREE.Vector3(dist * 0.7, dist * 0.5, dist * 0.7));
    const startPos    = this.perspCamera.position.clone();
    const startTarget = this.controls.target.clone();

    // Ensure perspective
    if (this.viewMode !== 'perspective') {
      this.setViewMode('perspective');
    }

    let frame = 0;
    const totalFrames = 50;
    const tween = () => {
      frame++;
      const t = 1 - Math.pow(1 - frame / totalFrames, 3); // ease-out cubic
      this.perspCamera.position.lerpVectors(startPos, endPos, t);
      this.controls.target.lerpVectors(startTarget, center, t);
      this.controls.update();
      if (frame < totalFrames) requestAnimationFrame(tween);
    };
    tween();
    this.highlight(expressID);
  }

  // ── 2D Floor Plan ─────────────────────────────────────────────────

  show2DPlan(storeyExpressID: number, storeys: IFCStorey[]): void {
    const idx = storeys.findIndex(s => s.expressID === storeyExpressID);
    if (idx < 0) return;

    const bottom = storeys[idx].elevation;
    // Cut 1m above floor level (shows walls/doors at walking height)
    const cutHeight = bottom + 1.2;
    const top = storeys[idx + 1]?.elevation ?? bottom + 5;

    const planeBot = new THREE.Plane(new THREE.Vector3(0,  1, 0), -bottom + 0.05);
    const planeTop = new THREE.Plane(new THREE.Vector3(0, -1, 0), cutHeight);

    this.dualClipPlanes = [planeBot, planeTop];
    this.singleClipPlane = null;
    this._is2DPlan = true;

    this._applyCurrentClipPlanes();
    this.setViewMode('top');

    // Wireframe mode for a plan-like look
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshPhongMaterial;
      mat.wireframe = true;
      mat.needsUpdate = true;
    });

    void top; // suppress unused warning
  }

  exit2DPlan(): void {
    this._is2DPlan = false;
    this.dualClipPlanes = null;
    // Restore single clip plane if any
    this._applyCurrentClipPlanes();

    // Restore wireframe to settings
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshPhongMaterial;
      mat.wireframe = this._gfxSettings.wireframe;
      mat.needsUpdate = true;
    });

    this.setViewMode('perspective');
  }

  get is2DPlan(): boolean { return this._is2DPlan; }

  // ── Construction simulation ───────────────────────────────────────

  buildStoreyElementMap(map: Map<number, number[]>): void {
    this._storeyElements.clear();
    for (const [storeyID, elemIDs] of map) {
      this._storeyElements.set(storeyID, new Set(elemIDs));
    }
  }

  startSimulation(
    storeys: IFCStorey[],
    onStep: (step: number, total: number, name: string) => void,
    onDone: () => void,
    intervalMs = 1800,
  ): void {
    this.stopSimulation();

    // Hide everything first
    this.meshGroup.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) obj.visible = false;
    });

    let step = 0;

    const revealNext = () => {
      if (step >= storeys.length) { this._simTimer = null; onDone(); return; }

      const storey = storeys[step];
      const ids = this._storeyElements.get(storey.expressID) ?? new Set<number>();

      // Reveal elements of this storey
      ids.forEach(id => {
        this.allMeshes.get(id)?.forEach(m => { m.visible = true; });
      });

      // Also reveal any meshes not in any storey map on last step
      if (step === storeys.length - 1) {
        this.meshGroup.traverse(obj => { if ((obj as THREE.Mesh).isMesh) obj.visible = true; });
      }

      onStep(step + 1, storeys.length, storey.name);
      step++;
      this._simTimer = window.setTimeout(revealNext, intervalMs);
    };

    revealNext();
  }

  stopSimulation(): void {
    if (this._simTimer !== null) { clearTimeout(this._simTimer); this._simTimer = null; }
    // Restore all visibility
    this.meshGroup.traverse(obj => { if ((obj as THREE.Mesh).isMesh) obj.visible = true; });
  }

  isSimulating(): boolean { return this._simTimer !== null; }

  // ── Pointer events ────────────────────────────────────────────────

  private _onPointerDown(e: PointerEvent): void {
    this._isDragging = false;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;

    if (this.toolMode === 'firstPerson') {
      this.fpDragging = true;
      this.fpLastX = e.clientX;
      this.fpLastY = e.clientY;
      this.canvas?.setPointerCapture(e.pointerId);
    }
    if (this.toolMode === 'section') {
      this.sectionDragging = true;
      this.sectionDragStartY = e.clientY;
      this.sectionDragStartElev = this.singleClipPlane?.constant ?? 0;
      this.canvas?.setPointerCapture(e.pointerId);
    }
  }

  private _onPointerMove(e: PointerEvent): void {
    const dx = e.clientX - this._dragStartX;
    const dy = e.clientY - this._dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._isDragging = true;

    if (this.toolMode === 'firstPerson' && this.fpDragging) {
      const ddx = e.clientX - this.fpLastX;
      const ddy = e.clientY - this.fpLastY;
      this.fpLastX = e.clientX; this.fpLastY = e.clientY;
      this.fpYaw  -= ddx * 0.003;
      this.fpPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.fpPitch - ddy * 0.003));
      const yQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.fpYaw);
      const pQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.fpPitch);
      this.perspCamera.quaternion.copy(yQ.multiply(pQ));
    }

    if (this.toolMode === 'section' && this.sectionDragging && !this._is2DPlan) {
      const pixelDelta = e.clientY - this.sectionDragStartY;
      const worldDelta = -(pixelDelta / Math.max(this.canvas?.clientHeight ?? 600, 1)) * this.modelHeight * 3;
      const newElev = this.sectionDragStartElev + worldDelta;
      this.setClipPlane(newElev);
      this.onSectionChangeCB?.(newElev);
    }
  }

  private _onPointerUp(e: PointerEvent): void {
    const wasDragging = this._isDragging;
    this.fpDragging = false;
    this.sectionDragging = false;
    this._isDragging = false;
    if (!wasDragging) this._handleClick(e);
  }

  private _handleClick(e: PointerEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    const cam = this.viewMode === 'perspective' ? this.perspCamera : this.orthoCamera;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), cam);
    const hits = ray.intersectObjects(this.meshGroup.children, false);

    switch (this.toolMode) {
      case 'measure': {
        if (hits.length === 0) return;
        const pt = hits[0].point.clone();
        if (this.measurePoints.length >= 2) this.clearMeasure();
        this.measurePoints.push(pt);
        this._addMeasureMarker(pt);
        if (this.measurePoints.length === 2) {
          this._drawMeasureLine(this.measurePoints[0], this.measurePoints[1]);
          this.onMeasureUpdateCB?.({
            pointA: this.measurePoints[0],
            pointB: this.measurePoints[1],
            distance: this.measurePoints[0].distanceTo(this.measurePoints[1]),
          });
        } else {
          this.onMeasureUpdateCB?.({ pointA: pt, pointB: null, distance: null });
        }
        break;
      }
      case 'markup': {
        if (hits.length === 0) return;
        const pt = hits[0].point.clone();
        const screen = this.projectToScreen(pt);
        if (screen) this.onMarkupRequestCB?.(pt, screen);
        break;
      }
      default: {
        if (hits.length > 0) {
          const id = (hits[0].object as THREE.Mesh).userData['expressID'] as number;
          // Only highlight here; home.tsx handleSelect also calls highlight via
          // the onSelectCB — avoid doing it twice by letting the callback own it.
          this.onSelectCB?.(id);
        }
      }
    }
  }

  private _onKeyDown(e: KeyboardEvent): void { this.fpKeys[e.key.toLowerCase()] = true; }
  private _onKeyUp(e: KeyboardEvent): void   { this.fpKeys[e.key.toLowerCase()] = false; }

  // ── First-person ──────────────────────────────────────────────────

  private _updateFP(): void {
    const spd = this.fpSpeed;
    const cam = this.perspCamera;
    const fwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    if (this.fpKeys['w'] || this.fpKeys['arrowup'])    cam.position.addScaledVector(fwd,   spd);
    if (this.fpKeys['s'] || this.fpKeys['arrowdown'])  cam.position.addScaledVector(fwd,  -spd);
    if (this.fpKeys['a'] || this.fpKeys['arrowleft'])  cam.position.addScaledVector(right, -spd);
    if (this.fpKeys['d'] || this.fpKeys['arrowright']) cam.position.addScaledVector(right,  spd);
    if (this.fpKeys['q']) cam.position.y -= spd;
    if (this.fpKeys['e']) cam.position.y += spd;
  }

  // ── Measure ───────────────────────────────────────────────────────

  private _addMeasureMarker(pt: THREE.Vector3): void {
    const geo = new THREE.SphereGeometry(0.15, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, depthTest: false });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(pt);
    sphere.renderOrder = 999;
    this.overlayGroup.add(sphere);
    this.measureMarkers.push(sphere);
  }

  private _drawMeasureLine(a: THREE.Vector3, b: THREE.Vector3): void {
    if (this.measureLine) {
      this.overlayGroup.remove(this.measureLine);
      this.measureLine.geometry.dispose();
      (this.measureLine.material as THREE.Material).dispose();
      this.measureLine = null;
    }
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, depthTest: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 999;
    this.overlayGroup.add(line);
    this.measureLine = line;
  }

  clearMeasure(): void {
    this.measureMarkers.forEach(m => {
      this.overlayGroup.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.measureMarkers = [];
    if (this.measureLine) {
      this.overlayGroup.remove(this.measureLine);
      this.measureLine.geometry.dispose();
      (this.measureLine.material as THREE.Material).dispose();
      this.measureLine = null;
    }
    this.measurePoints = [];
    this.onMeasureUpdateCB?.({ pointA: null, pointB: null, distance: null });
  }

  getMeasureInfo(): MeasureInfo {
    return {
      pointA:   this.measurePoints[0] ?? null,
      pointB:   this.measurePoints[1] ?? null,
      distance: this.measurePoints.length === 2 ? this.measurePoints[0].distanceTo(this.measurePoints[1]) : null,
    };
  }

  // ── Markup ────────────────────────────────────────────────────────

  addMarkup(text: string, position: THREE.Vector3): MarkupItem {
    const id = ++this.markupIdCounter;
    const item: MarkupItem = { id, position: position.clone(), text };
    this.markupItems.push(item);
    const geo = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf97316, depthTest: false });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(position);
    sphere.renderOrder = 999;
    this.overlayGroup.add(sphere);
    this.markupSpheres.set(id, sphere);
    return item;
  }

  removeMarkup(id: number): void {
    this.markupItems = this.markupItems.filter(m => m.id !== id);
    const sphere = this.markupSpheres.get(id);
    if (sphere) {
      this.overlayGroup.remove(sphere);
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
      this.markupSpheres.delete(id);
    }
  }

  clearMarkups(): void {
    [...this.markupSpheres.values()].forEach(sphere => {
      this.overlayGroup.remove(sphere);
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
    });
    this.markupItems = [];
    this.markupSpheres.clear();
  }

  getMarkups(): MarkupItem[] { return [...this.markupItems]; }

  // ── Projection ────────────────────────────────────────────────────

  projectToScreen(point: THREE.Vector3): { x: number; y: number } | null {
    if (!this.canvas) return null;
    const cam = this.viewMode === 'perspective' ? this.perspCamera : this.orthoCamera;
    const ndc = point.clone().project(cam);
    if (ndc.z > 1) return null;
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((ndc.x + 1) / 2) * rect.width,
      y: ((-ndc.y + 1) / 2) * rect.height,
    };
  }

  // ── Highlight ─────────────────────────────────────────────────────

  highlight(expressID: number): void {
    // Remove previous highlight
    if (this.highlightMesh) {
      this.overlayGroup.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
      this.highlightMesh = null;
    }
    // Reset previous emissive
    if (this.selectedExpressID >= 0) {
      this.allMeshes.get(this.selectedExpressID)?.forEach(m => {
        const mat = m.material as THREE.MeshPhongMaterial;
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      });
    }

    this.selectedExpressID = expressID;

    // Apply emissive highlight to actual meshes
    this.allMeshes.get(expressID)?.forEach(m => {
      const mat = m.material as THREE.MeshPhongMaterial;
      mat.emissive.set(0x3b82f6);
      mat.emissiveIntensity = 0.6;
    });

    // Create a wireframe overlay for sharp selection outline
    const meshes = this.allMeshes.get(expressID);
    if (meshes?.length) {
      const box = new THREE.Box3();
      meshes.forEach(m => box.expandByObject(m));
      const size = box.getSize(new THREE.Vector3());
      if (size.length() > 0.01) {
        const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
        const boxMat = new THREE.MeshBasicMaterial({
          color: 0x60a5fa, wireframe: true, depthTest: false, opacity: 0.4, transparent: true,
        });
        this.highlightMesh = new THREE.Mesh(boxGeo, boxMat);
        box.getCenter(this.highlightMesh.position);
        this.highlightMesh.renderOrder = 998;
        this.overlayGroup.add(this.highlightMesh);
      }
    }
  }

  // ── Explode ───────────────────────────────────────────────────────

  private _computeExplodeData(): void {
    if (this.meshGroup.children.length === 0) return;
    const box = new THREE.Box3().setFromObject(this.meshGroup);
    box.getCenter(this._modelCenter);
    this.explodeData = [];
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const b = new THREE.Box3().setFromObject(mesh);
      this.explodeData.push({
        mesh,
        origPos: mesh.position.clone(),
        centroid: b.getCenter(new THREE.Vector3()),
      });
    });
  }

  setExplodeScale(factor: number): void {
    this._explodeFactor = factor;
    const scale = factor * this.modelHeight * 0.35;
    this.explodeData.forEach(({ mesh, origPos, centroid }) => {
      const dir = new THREE.Vector3().subVectors(centroid, this._modelCenter);
      if (dir.length() < 0.001) { mesh.position.copy(origPos); return; }
      dir.normalize();
      mesh.position.copy(origPos).addScaledVector(dir, scale);
    });
  }

  getExplodeScale(): number { return this._explodeFactor; }

  // ── Clip planes ───────────────────────────────────────────────────

  private _activeClipPlanes(): THREE.Plane[] {
    if (this.dualClipPlanes) return [...this.dualClipPlanes];
    if (this.singleClipPlane) return [this.singleClipPlane];
    return [];
  }

  private _applyCurrentClipPlanes(): void {
    const planes = this._activeClipPlanes();
    this.renderer.clippingPlanes = planes;
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshPhongMaterial;
      mat.clippingPlanes = planes;
      mat.needsUpdate = true;
    });
  }

  setClipPlane(elevation: number | null): void {
    if (this._is2DPlan) return; // 2D plan manages its own dual planes
    this.singleClipPlane = elevation !== null
      ? new THREE.Plane(new THREE.Vector3(0, -1, 0), elevation)
      : null;
    this._applyCurrentClipPlanes();
  }

  // ── Tool mode ─────────────────────────────────────────────────────

  setToolMode(mode: ToolMode): void {
    this.toolMode = mode;
    if (!this.canvas) return;

    if (mode === 'firstPerson') {
      if (this.viewMode !== 'perspective') {
        this.viewMode = 'perspective';
        this.controls.dispose();
        this.controls = new OrbitControls(this.perspCamera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.screenSpacePanning = true;
      }
      this.controls.enabled = false;
      this.fpKeys = {};
      const euler = new THREE.Euler().setFromQuaternion(this.perspCamera.quaternion, 'YXZ');
      this.fpYaw = euler.y; this.fpPitch = euler.x;
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.controls.enabled = true;
      this.controls.enableRotate = mode !== 'pan' && mode !== 'zoom';
      this.controls.enablePan    = mode !== 'zoom';
      this.controls.enableZoom   = true;
      this.canvas.style.cursor =
        mode === 'section' ? 'ns-resize' :
        mode === 'measure' ? 'crosshair'  :
        mode === 'markup'  ? 'copy'        :
        mode === 'pan'     ? 'grab'        :
        mode === 'zoom'    ? 'zoom-in'     : '';
    }
  }

  getToolMode(): ToolMode { return this.toolMode; }

  // ── Camera ────────────────────────────────────────────────────────

  fitCamera(): void {
    if (this.meshGroup.children.length === 0) return;
    const box = new THREE.Box3().setFromObject(this.meshGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist   = maxDim * 1.5;
    this.modelHeight = size.y;
    this.fpSpeed = maxDim * 0.012;

    this.perspCamera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.6);
    this.perspCamera.near = maxDim * 0.001;
    this.perspCamera.far  = maxDim * 100;
    this.perspCamera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();

    const aspect = this.perspCamera.aspect;
    const half = maxDim * 0.65;
    this.orthoCamera.left   = -half * aspect; this.orthoCamera.right  =  half * aspect;
    this.orthoCamera.top    =  half;          this.orthoCamera.bottom = -half;
    this.orthoCamera.near   = -maxDim * 10;  this.orthoCamera.far    =  maxDim * 10;
    this.orthoCamera.updateProjectionMatrix();

    this.fpYaw = -Math.PI / 4; this.fpPitch = -0.2;
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.controls.dispose();

    const canvas = this.canvas!;
    const box = this.meshGroup.children.length > 0
      ? new THREE.Box3().setFromObject(this.meshGroup)
      : new THREE.Box3(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50));
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z) * 1.5;

    if (mode === 'perspective') {
      this.controls = new OrbitControls(this.perspCamera, canvas);
      this.controls.enableDamping = true; this.controls.dampingFactor = 0.1;
      this.controls.screenSpacePanning = true;
      this.controls.target.copy(center);
      this.perspCamera.position.set(center.x + d * 0.6, center.y + d * 0.4, center.z + d * 0.6);
    } else {
      if (mode === 'top')        { this.orthoCamera.position.set(center.x, center.y + d, center.z); this.orthoCamera.up.set(0, 0, -1); }
      else if (mode === 'front') { this.orthoCamera.position.set(center.x, center.y, center.z + d); this.orthoCamera.up.set(0, 1, 0); }
      else                       { this.orthoCamera.position.set(center.x + d, center.y, center.z); this.orthoCamera.up.set(0, 1, 0); }
      this.orthoCamera.lookAt(center);
      this.controls = new OrbitControls(this.orthoCamera, canvas);
      this.controls.enableRotate = false;
      this.controls.screenSpacePanning = true;
      this.controls.target.copy(center);
    }
    this.setToolMode(this.toolMode);
  }

  // ── Mesh management ───────────────────────────────────────────────

  clearMeshes(): void {
    this.stopSimulation();

    if (this._idleHandle !== null) { cancelIdle(this._idleHandle); this._idleHandle = null; }
    this._meshQueue = [];
    this._loadComplete = false;

    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose()); else mat.dispose();
      }
    });
    this.meshGroup.clear();
    this.allMeshes.clear();
    this.rawData.clear();
    this.explodeData = [];
    this._explodeFactor = 0;
    this.selectedExpressID = -1;

    if (this.highlightMesh) {
      this.overlayGroup.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
      this.highlightMesh = null;
    }

    this.clearMeasure();
    this.clearMarkups();

    // Reset clip planes
    this.singleClipPlane = null;
    this.dualClipPlanes = null;
    this._is2DPlan = false;
    this._applyCurrentClipPlanes();
  }

  // ── Resize ────────────────────────────────────────────────────────

  private _resize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
    if (this.meshGroup.children.length > 0) {
      const box = new THREE.Box3().setFromObject(this.meshGroup);
      const half = Math.max(...box.getSize(new THREE.Vector3()).toArray()) * 0.6;
      this.orthoCamera.left  = -half * aspect; this.orthoCamera.right = half * aspect;
    } else {
      const s = 100;
      this.orthoCamera.left = (-s * aspect) / 2; this.orthoCamera.right = (s * aspect) / 2;
    }
    this.orthoCamera.updateProjectionMatrix();
  }

  // ── Dispose ───────────────────────────────────────────────────────

  dispose(): void {
    cancelAnimationFrame(this.animID);
    if (this._idleHandle !== null) { cancelIdle(this._idleHandle); this._idleHandle = null; }
    this.stopSimulation();
    if (this.canvas && this.boundPointerDown) this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    if (this.canvas && this.boundPointerMove) this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    if (this.canvas && this.boundPointerUp)   this.canvas.removeEventListener('pointerup',   this.boundPointerUp);
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp)   window.removeEventListener('keyup',   this.boundKeyUp);
    this.resizeObserver?.disconnect();
    this.clearMeshes();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
