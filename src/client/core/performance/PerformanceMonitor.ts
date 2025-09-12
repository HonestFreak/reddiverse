export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics = {
    blocksCreated: 0,
    materialsCached: 0,
    texturesLoaded: 0,
    geometriesReused: 0,
    memoryUsage: 0
  };

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordBlockCreated(): void {
    this.metrics.blocksCreated++;
  }

  recordMaterialCached(): void {
    this.metrics.materialsCached++;
  }

  recordTextureLoaded(): void {
    this.metrics.texturesLoaded++;
  }

  recordGeometryReused(): void {
    this.metrics.geometriesReused++;
  }

  updateMemoryUsage(): void {
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  }

  getMetrics() {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  logPerformanceReport(): void {
    const metrics = this.getMetrics();
    console.log('🚀 Block System Performance Report:');
    console.log(`📦 Blocks Created: ${metrics.blocksCreated}`);
    console.log(`🎨 Materials Cached: ${metrics.materialsCached}`);
    console.log(`🖼️ Textures Loaded: ${metrics.texturesLoaded}`);
    console.log(`📐 Geometries Reused: ${metrics.geometriesReused}`);
    console.log(`💾 Memory Usage: ${metrics.memoryUsage.toFixed(2)} MB`);
    
    const efficiency = metrics.blocksCreated > 0 
      ? ((metrics.materialsCached + metrics.geometriesReused) / metrics.blocksCreated * 100).toFixed(1)
      : '0';
    console.log(`⚡ Cache Efficiency: ${efficiency}%`);
  }

  reset(): void {
    this.metrics = {
      blocksCreated: 0,
      materialsCached: 0,
      texturesLoaded: 0,
      geometriesReused: 0,
      memoryUsage: 0
    };
  }
}
