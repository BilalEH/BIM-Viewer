import * as WebIFC from 'web-ifc';

export interface ElementData {
  expressID: number;
  type: string;
  name?: string;
  globalId?: string;
  properties?: any;
  psets?: any[];
}

export interface StoreyData {
  expressID: number;
  name: string;
  elevation: number;
  elements: number[];
}

export class IFCManager {
  private static instance: IFCManager;
  private ifcApi: WebIFC.IfcAPI;
  private modelID: number | null = null;
  private wasmInitialized = false;

  public onProgress?: (progress: number, total: number) => void;

  private constructor() {
    this.ifcApi = new WebIFC.IfcAPI();
  }

  public static getInstance(): IFCManager {
    if (!IFCManager.instance) {
      IFCManager.instance = new IFCManager();
    }
    return IFCManager.instance;
  }

  public async init() {
    if (this.wasmInitialized) return;
    this.ifcApi.SetWasmPath('/'); // The WASM file is in public/web-ifc.wasm
    await this.ifcApi.Init();
    this.wasmInitialized = true;
  }

  public async loadModel(fileBuffer: Uint8Array): Promise<number> {
    await this.init();
    if (this.modelID !== null) {
      this.ifcApi.CloseModel(this.modelID);
      this.modelID = null;
    }

    try {
      this.modelID = this.ifcApi.OpenModel(fileBuffer, { COORDINATE_TO_ORIGIN: true });
      return this.modelID;
    } catch (err) {
      console.error("Error opening IFC model", err);
      throw err;
    }
  }

  public getModelID(): number | null {
    return this.modelID;
  }

  public getIfcApi(): WebIFC.IfcAPI {
    return this.ifcApi;
  }

  public async getSpatialStructure() {
    if (this.modelID === null) return null;
    return await this.ifcApi.properties.getSpatialStructure(this.modelID, true);
  }

  public async getElementProperties(expressID: number): Promise<ElementData> {
    if (this.modelID === null) return { expressID, type: 'Unknown' };
    
    try {
      const props = await this.ifcApi.properties.getItemProperties(this.modelID, expressID, true);
      const psets = await this.ifcApi.properties.getPropertySets(this.modelID, expressID, true);
      
      const typeNum = this.ifcApi.GetLine(this.modelID, expressID)?.type;
      let typeStr = 'Unknown';
      
      // We can iterate the IFCTYPE constants to find the string, but properties might have it
      if (props && props.type) {
        typeStr = props.type;
      }
      
      return {
        expressID,
        type: typeStr,
        name: props?.Name?.value,
        globalId: props?.GlobalId?.value,
        properties: props,
        psets: psets || []
      };
    } catch (e) {
      console.error(`Error fetching properties for ${expressID}`, e);
      return { expressID, type: 'Error' };
    }
  }

  public getStoreys(): StoreyData[] {
    if (this.modelID === null) return [];
    
    const storeys: StoreyData[] = [];
    try {
      const storeyLines = this.ifcApi.GetAllItemsOfType(this.modelID, WebIFC.IFCBUILDINGSTOREY, false);
      for (let i = 0; i < storeyLines.size(); i++) {
        const id = storeyLines.get(i);
        const props = this.ifcApi.GetLine(this.modelID, id);
        
        // Find elements in this storey by looking at IfcRelContainedInSpatialStructure
        // For a basic implementation, we just store the storey info
        storeys.push({
          expressID: id,
          name: props?.Name?.value || `Storey ${id}`,
          elevation: props?.Elevation?.value || 0,
          elements: [] // In a full implementation, we'd traverse relationships
        });
      }
    } catch (e) {
      console.warn("Could not get storeys", e);
    }
    
    // Sort by elevation
    return storeys.sort((a, b) => a.elevation - b.elevation);
  }
}

export const ifcManager = IFCManager.getInstance();
