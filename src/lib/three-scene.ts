import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ifcManager } from './ifc-manager';

export type ViewMode = 'perspective' | 'top' | 'front' | 'side';

export class ThreeScene {
  private container: HTMLElement;
  public scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  private controls: OrbitControls;
  public activeCamera: THREE.Camera;
  
  private animationFrameId: number | null = null;
  private modelGroup: THREE.Group;
  private gridHelper: THREE.GridHelper;
  
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  
  private onSelectCallback?: (expressID: number | null) => void;
  
  // Selection
  private selectedMesh: THREE.Mesh | null = null;
  private highlightMaterial: THREE.MeshBasicMaterial;
  private originalMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]> = new Map();

  // Clipping
  private clippingPlane: THREE.Plane;
  private isClippingActive = false;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827); // Tailored to dark theme background
    
    // Grid
    this.gridHelper = new THREE.GridHelper(100, 100, 0x374151, 0x1f2937);
    this.gridHelper.position.y = -0.01; // Slightly below 0 to avoid z-fighting
    this.scene.add(this.gridHelper);
    
    // Group for the model to handle easy removal/centering
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Set up clipping planes
    this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10000);
    this.renderer.localClippingEnabled = true;
    
    container.appendChild(this.renderer.domElement);
    
    // Cameras
    const aspect = container.clientWidth / container.clientHeight;
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.perspectiveCamera.position.set(30, 30, 30);
    
    const frustumSize = 50;
    this.orthographicCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    
    this.activeCamera = this.perspectiveCamera;
    
    // Controls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(100, 200, 50);
    this.scene.add(dirLight1);
    
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-100, 100, -50);
    this.scene.add(dirLight2);
    
    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Highlight material
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0x3B82F6, // Primary accent blue
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      side: THREE.DoubleSide
    });
    
    // Events
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('click', this.onClick);
    
    // Start loop
    this.animate();
  }
  
  public setOnSelect(callback: (id: number | null) => void) {
    this.onSelectCallback = callback;
  }
  
  public async loadModelGeometries() {
    // Clear existing
    while(this.modelGroup.children.length > 0) {
      const child = this.modelGroup.children[0];
      this.modelGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    }
    this.originalMaterials.clear();
    this.selectedMesh = null;
    
    const modelID = ifcManager.getModelID();
    if (modelID === null) return;
    
    const ifcApi = ifcManager.getIfcApi();
    
    return new Promise<void>((resolve) => {
      let bounds = new THREE.Box3();
      
      try {
        ifcApi.StreamAllMeshes(modelID, (mesh) => {
          const placedGeometries = mesh.geometries;
          for (let i = 0; i < placedGeometries.size(); i++) {
            const placedGeometry = placedGeometries.get(i);
            const geometry = ifcApi.GetGeometry(modelID, placedGeometry.geometryExpressID);
            const verts = ifcApi.GetRawFileVerts(geometry.GetVertexData(), geometry.GetVertexDataSize());
            const indices = ifcApi.GetRawFileVerts(geometry.GetIndexData(), geometry.GetIndexDataSize());
            
            const positions = [];
            const normals = [];
            for (let j = 0; j < verts.length; j += 6) {
              positions.push(verts[j], verts[j+1], verts[j+2]);
              normals.push(verts[j+3], verts[j+4], verts[j+5]);
            }
            
            const bufferGeometry = new THREE.BufferGeometry();
            bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            bufferGeometry.setIndex(Array.from(indices));
            
            const color = placedGeometry.color;
            const material = new THREE.MeshPhongMaterial({
              color: new THREE.Color(color.x, color.y, color.z),
              transparent: color.w < 1,
              opacity: color.w,
              side: THREE.DoubleSide,
              clippingPlanes: [this.clippingPlane],
            });
            
            const threeMesh = new THREE.Mesh(bufferGeometry, material);
            
            const flatMatrix = placedGeometry.flatTransformation;
            const matrix = new THREE.Matrix4().fromArray(flatMatrix);
            threeMesh.applyMatrix4(matrix);
            
            threeMesh.userData = { expressID: mesh.expressID };
            
            this.modelGroup.add(threeMesh);
            bounds.expandByObject(threeMesh);
          }
        });
        
        // Center camera on model
        if (!bounds.isEmpty()) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          
          this.controls.target.copy(center);
          this.perspectiveCamera.position.copy(center).add(new THREE.Vector3(maxDim, maxDim, maxDim));
          this.perspectiveCamera.lookAt(center);
          this.controls.update();
        }
        
      } catch (err) {
        console.error("Error streaming meshes", err);
      }
      resolve();
    });
  }
  
  public setViewMode(mode: ViewMode) {
    const target = this.controls.target.clone();
    let dist = 50; // Default distance
    
    // Estimate distance based on bounding box
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      dist = Math.max(size.x, size.y, size.z) * 1.5;
    }
    
    if (mode === 'perspective') {
      this.activeCamera = this.perspectiveCamera;
      // Slightly offset perspective so it looks 3D
      this.perspectiveCamera.position.copy(target).add(new THREE.Vector3(dist, dist, dist));
      this.perspectiveCamera.lookAt(target);
    } else {
      this.activeCamera = this.orthographicCamera;
      
      // Setup frustum for ortho
      const aspect = this.container.clientWidth / this.container.clientHeight;
      this.orthographicCamera.left = -dist * aspect / 2;
      this.orthographicCamera.right = dist * aspect / 2;
      this.orthographicCamera.top = dist / 2;
      this.orthographicCamera.bottom = -dist / 2;
      this.orthographicCamera.updateProjectionMatrix();
      
      if (mode === 'top') {
        this.orthographicCamera.position.set(target.x, target.y + dist, target.z);
      } else if (mode === 'front') {
        this.orthographicCamera.position.set(target.x, target.y, target.z + dist);
      } else if (mode === 'side') {
        this.orthographicCamera.position.set(target.x + dist, target.y, target.z);
      }
      this.orthographicCamera.lookAt(target);
    }
    
    this.controls.object = this.activeCamera;
    this.controls.update();
  }
  
  public setStoreyClipping(elevation: number | null) {
    if (elevation === null) {
      this.isClippingActive = false;
      this.clippingPlane.constant = 10000;
    } else {
      this.isClippingActive = true;
      // Clip from the top down. The plane normal is (0, -1, 0)
      // So the constant is the max Y value to keep.
      // We add a small offset so we can see the storey itself.
      this.clippingPlane.constant = -(elevation + 3.0); // 3m above storey elevation
    }
  }

  public selectElement(expressID: number | null) {
    // Restore previous
    if (this.selectedMesh) {
      const origMat = this.originalMaterials.get(this.selectedMesh);
      if (origMat) {
        this.selectedMesh.material = origMat;
      }
      this.selectedMesh = null;
    }
    
    if (expressID !== null) {
      // Find mesh
      for (const child of this.modelGroup.children) {
        if (child instanceof THREE.Mesh && child.userData.expressID === expressID) {
          this.selectedMesh = child;
          if (!this.originalMaterials.has(child)) {
            this.originalMaterials.set(child, child.material);
          }
          // Preserve clipping planes on the highlight material
          const highlightMat = this.highlightMaterial.clone();
          highlightMat.clippingPlanes = [this.clippingPlane];
          child.material = highlightMat;
          
          // Optionally zoom to fit element
          break;
        }
      }
    }
  }
  
  private onClick = (event: MouseEvent) => {
    event.preventDefault();
    
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.activeCamera);
    
    const intersects = this.raycaster.intersectObjects(this.modelGroup.children, false);
    
    if (intersects.length > 0) {
      // Find the first visible intersecting object (considering clipping)
      const selected = intersects[0].object as THREE.Mesh;
      const expressID = selected.userData.expressID;
      this.selectElement(expressID);
      if (this.onSelectCallback) {
        this.onSelectCallback(expressID);
      }
    } else {
      this.selectElement(null);
      if (this.onSelectCallback) {
        this.onSelectCallback(null);
      }
    }
  };
  
  private onResize = () => {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.renderer.setSize(width, height);
    
    const aspect = width / height;
    
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
    
    const dist = (this.orthographicCamera.top - this.orthographicCamera.bottom);
    this.orthographicCamera.left = -dist * aspect / 2;
    this.orthographicCamera.right = dist * aspect / 2;
    this.orthographicCamera.updateProjectionMatrix();
  };
  
  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.activeCamera);
  };
  
  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    
    this.renderer.dispose();
    this.controls.dispose();
    
    // Deep dispose geometry/materials
    this.modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
