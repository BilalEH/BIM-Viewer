import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { IFCMeshData } from './ifc-manager';

export type ViewMode = 'perspective' | 'top' | 'front' | 'side';

export class ThreeScene {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private perspCamera!: THREE.PerspectiveCamera;
  private orthoCamera!: THREE.OrthographicCamera;
  private controls!: OrbitControls;
  private animID = 0;
  private meshGroup!: THREE.Group;
  private allMeshes: Map<number, THREE.Mesh[]> = new Map();
  private selectedExpressID = -1;
  private viewMode: ViewMode = 'perspective';
  private clippingPlane: THREE.Plane | null = null;
  private onSelectCallback: ((id: number) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private canvas: HTMLCanvasElement | null = null;

  init(canvas: HTMLCanvasElement, onSelect: (id: number) => void): void {
    this.canvas = canvas;
    this.onSelectCallback = onSelect;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setClearColor(0x0d1117);
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = false;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);

    // Cameras
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    this.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.01, 10000);
    this.perspCamera.position.set(50, 50, 50);
    this.perspCamera.lookAt(0, 0, 0);

    const orthoSize = 100;
    this.orthoCamera = new THREE.OrthographicCamera(
      (-orthoSize * aspect) / 2, (orthoSize * aspect) / 2,
      orthoSize / 2, -orthoSize / 2, 0.01, 10000,
    );
    this.orthoCamera.position.set(0, 500, 0);
    this.orthoCamera.lookAt(0, 0, 0);

    // Controls (perspective)
    this.controls = new OrbitControls(this.perspCamera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(100, 200, 100);
    this.scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x6699cc, 0.3);
    fillLight.position.set(-100, -50, -100);
    this.scene.add(fillLight);

    // Grid
    const grid = new THREE.GridHelper(500, 50, 0x1e293b, 0x1e293b);
    this.scene.add(grid);

    // Mesh group
    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    // Click handler
    this.clickHandler = (e: MouseEvent) => this.handleClick(e, canvas);
    canvas.addEventListener('click', this.clickHandler);

    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    this.resizeObserver.observe(canvas.parentElement ?? canvas);

    // Animation loop
    const animate = () => {
      this.animID = requestAnimationFrame(animate);
      this.controls.update();
      const cam = this.viewMode === 'perspective' ? this.perspCamera : this.orthoCamera;
      this.renderer.render(this.scene, cam);
    };
    animate();
  }

  private resize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth;
    const h = Math.max(canvas.clientHeight, 1);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    if (this.meshGroup.children.length > 0) {
      const box = new THREE.Box3().setFromObject(this.meshGroup);
      const size = box.getSize(new THREE.Vector3());
      const half = Math.max(size.x, size.y, size.z) * 0.6;
      this.orthoCamera.left = -half * aspect;
      this.orthoCamera.right = half * aspect;
    } else {
      const s = 100;
      this.orthoCamera.left = (-s * aspect) / 2;
      this.orthoCamera.right = (s * aspect) / 2;
    }
    this.orthoCamera.updateProjectionMatrix();
  }

  private handleClick(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const cam = this.viewMode === 'perspective' ? this.perspCamera : this.orthoCamera;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cam);
    const hits = raycaster.intersectObjects(this.meshGroup.children, false);
    if (hits.length > 0) {
      const mesh = hits[0].object as THREE.Mesh;
      const id = mesh.userData['expressID'] as number;
      this.highlight(id);
      this.onSelectCallback?.(id);
    }
  }

  addMeshes(meshDatas: IFCMeshData[]): void {
    const CHUNK = 500;
    let i = 0;

    const addChunk = () => {
      const end = Math.min(i + CHUNK, meshDatas.length);
      const toAdd: THREE.Mesh[] = [];

      for (; i < end; i++) {
        const data = meshDatas[i];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geometry.setIndex(new THREE.Uint32BufferAttribute(data.indices, 1));

        const { r, g, b, a } = data.color;
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(r, g, b),
          opacity: a < 0.99 ? a : 1,
          transparent: a < 0.99,
          side: THREE.DoubleSide,
          clippingPlanes: this.clippingPlane ? [this.clippingPlane] : [],
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData['expressID'] = data.expressID;

        // Column-major → row-major for Three.js Matrix4.set
        const m = data.matrix;
        const mat = new THREE.Matrix4();
        mat.set(
          m[0], m[4], m[8],  m[12],
          m[1], m[5], m[9],  m[13],
          m[2], m[6], m[10], m[14],
          m[3], m[7], m[11], m[15],
        );
        mesh.applyMatrix4(mat);

        if (!this.allMeshes.has(data.expressID)) {
          this.allMeshes.set(data.expressID, []);
        }
        this.allMeshes.get(data.expressID)!.push(mesh);
        toAdd.push(mesh);
      }

      if (toAdd.length > 0) this.meshGroup.add(...toAdd);

      if (i < meshDatas.length) {
        setTimeout(addChunk, 0);
      } else {
        this.fitCamera();
      }
    };

    addChunk();
  }

  fitCamera(): void {
    if (this.meshGroup.children.length === 0) return;
    const box = new THREE.Box3().setFromObject(this.meshGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.5;

    this.perspCamera.position.set(
      center.x + dist * 0.6,
      center.y + dist * 0.4,
      center.z + dist * 0.6,
    );
    this.perspCamera.near = maxDim * 0.001;
    this.perspCamera.far = maxDim * 100;
    this.perspCamera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();

    const aspect = this.perspCamera.aspect;
    const half = maxDim * 0.65;
    this.orthoCamera.left = -half * aspect;
    this.orthoCamera.right = half * aspect;
    this.orthoCamera.top = half;
    this.orthoCamera.bottom = -half;
    this.orthoCamera.near = -maxDim * 10;
    this.orthoCamera.far = maxDim * 10;
    this.orthoCamera.updateProjectionMatrix();
  }

  clearMeshes(): void {
    // Dispose GPU resources
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    });
    this.meshGroup.clear();
    this.allMeshes.clear();
    this.selectedExpressID = -1;
  }

  highlight(expressID: number): void {
    if (this.selectedExpressID >= 0) {
      const prev = this.allMeshes.get(this.selectedExpressID);
      prev?.forEach(m => {
        const mat = m.material as THREE.MeshPhongMaterial;
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      });
    }
    this.selectedExpressID = expressID;
    const meshes = this.allMeshes.get(expressID);
    meshes?.forEach(m => {
      const mat = m.material as THREE.MeshPhongMaterial;
      mat.emissive.set(0x3b82f6);
      mat.emissiveIntensity = 0.5;
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;

    // Dispose current controls before creating new ones
    this.controls.dispose();

    const canvas = this.canvas!;
    const box = this.meshGroup.children.length > 0
      ? new THREE.Box3().setFromObject(this.meshGroup)
      : new THREE.Box3(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z) * 1.5;

    if (mode === 'perspective') {
      this.controls = new OrbitControls(this.perspCamera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.1;
      this.controls.screenSpacePanning = true;
      this.controls.target.copy(center);
      this.perspCamera.position.set(center.x + d * 0.6, center.y + d * 0.4, center.z + d * 0.6);
    } else {
      if (mode === 'top') {
        this.orthoCamera.position.set(center.x, center.y + d, center.z);
        this.orthoCamera.up.set(0, 0, -1);
      } else if (mode === 'front') {
        this.orthoCamera.position.set(center.x, center.y, center.z + d);
        this.orthoCamera.up.set(0, 1, 0);
      } else {
        this.orthoCamera.position.set(center.x + d, center.y, center.z);
        this.orthoCamera.up.set(0, 1, 0);
      }
      this.orthoCamera.lookAt(center);
      this.controls = new OrbitControls(this.orthoCamera, canvas);
      this.controls.enableRotate = false;
      this.controls.screenSpacePanning = true;
      this.controls.target.copy(center);
    }
    this.controls.update();
  }

  setClipPlane(elevation: number | null): void {
    if (elevation === null) {
      this.renderer.clippingPlanes = [];
      this.clippingPlane = null;
    } else {
      this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), elevation);
      this.renderer.clippingPlanes = [this.clippingPlane];
    }
    this.meshGroup.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.MeshPhongMaterial;
        mat.clippingPlanes = this.clippingPlane ? [this.clippingPlane] : [];
        mat.needsUpdate = true;
      }
    });
  }

  dispose(): void {
    cancelAnimationFrame(this.animID);
    if (this.clickHandler && this.canvas) {
      this.canvas.removeEventListener('click', this.clickHandler);
    }
    this.resizeObserver?.disconnect();
    this.clearMeshes();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
