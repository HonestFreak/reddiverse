import * as THREE from 'three';

export interface CloudConfig {
  density: number; // 0-1, how many clouds to generate
  windSpeed: number; // How fast clouds move
  windDirection: number; // Wind direction in radians
  cloudTypes: CloudType[];
  timeOfDay: number; // 0-1, affects cloud color and opacity
}

export interface CloudType {
  name: string;
  size: { min: number; max: number };
  height: { min: number; max: number };
  opacity: { min: number; max: number };
  color: THREE.Color;
  speedMultiplier: number; // How fast this cloud type moves relative to wind
}

export interface CloudInstance {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  type: CloudType;
  originalPosition: THREE.Vector3;
}

export class CloudManager {
  private scene: THREE.Scene;
  private clouds: CloudInstance[] = [];
  private config: CloudConfig;
  private cloudTypes: CloudType[];
  private cloudGroup: THREE.Group;
  private playerPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.cloudGroup = new THREE.Group();
    this.scene.add(this.cloudGroup);

    this.cloudTypes = [
      {
        name: 'Cumulus',
        size: { min: 12, max: 20 },
        height: { min: 80, max: 120 },
        opacity: { min: 0.7, max: 0.9 },
        color: new THREE.Color(0xFFFFFF),
        speedMultiplier: 1.0,
      },
      {
        name: 'Stratus',
        size: { min: 20, max: 35 },
        height: { min: 70, max: 100 },
        opacity: { min: 0.5, max: 0.8 },
        color: new THREE.Color(0xF8F8F8),
        speedMultiplier: 0.8,
      },
      {
        name: 'Cirrus',
        size: { min: 8, max: 15 },
        height: { min: 120, max: 150 },
        opacity: { min: 0.4, max: 0.7 },
        color: new THREE.Color(0xE8E8E8),
        speedMultiplier: 1.5,
      },
      {
        name: 'Storm',
        size: { min: 18, max: 35 },
        height: { min: 60, max: 90 },
        opacity: { min: 0.55, max: 0.75 },
        color: new THREE.Color(0xF8F8F8),
        speedMultiplier: 0.6,
      },
      {
        name: 'BigCumulus',
        size: { min: 30, max: 50 },
        height: { min: 90, max: 130 },
        opacity: { min: 0.6, max: 0.85 },
        color: new THREE.Color(0xFFFFFF),
        speedMultiplier: 0.7,
      },
      {
        name: 'BigStratus',
        size: { min: 50, max: 80 },
        height: { min: 75, max: 95 },
        opacity: { min: 0.4, max: 0.7 },
        color: new THREE.Color(0xF0F0F0),
        speedMultiplier: 0.5,
      },
    ];

    this.config = {
      density: 0.8, // Reduced density to avoid visible cloud group
      windSpeed: 2.5, // Fixed wind speed
      windDirection: 0,
      cloudTypes: this.cloudTypes,
      timeOfDay: 0.5,
    };

    this.generateClouds();
  }

  private generateClouds(): void {
    // Clear existing clouds
    this.clearClouds();

    const cloudCount = Math.floor(this.config.density * 50); // Max 50 clouds for 100% density

    for (let i = 0; i < cloudCount; i++) {
      this.createCloud();
    }
  }

  private createCloud(): void {
    // Randomly select cloud type
    const cloudType = this.cloudTypes[Math.floor(Math.random() * this.cloudTypes.length)];
    if (!cloudType) return; // Safety check
    
    // More natural cloud distribution - clusters and gaps
    const angle = Math.random() * Math.PI * 2; // Random angle 0-2π
    const distance = 100 + Math.random() * 300; // Distance from 100-400 units (smaller range)
    const x = Math.cos(angle) * distance;
    const y = cloudType.height.min + Math.random() * (cloudType.height.max - cloudType.height.min) + 60; // Add 60 to account for max terrain height (40) + buffer
    const z = Math.sin(angle) * distance;
    
    // Add some randomness to create more natural clustering
    const clusterOffset = (Math.random() - 0.5) * 50; // ±25 units
    const xOffset = Math.cos(angle + Math.PI/2) * clusterOffset;
    const zOffset = Math.sin(angle + Math.PI/2) * clusterOffset;

    // Create cloud geometry (multiple spheres for organic shape)
    const cloudGeometry = this.createCloudGeometry(cloudType);
    
    // Create cloud material - soft, slightly emissive to avoid black shading
    const cloudMaterial = new THREE.MeshLambertMaterial({
      color: cloudType.color,
      transparent: true,
      opacity: (cloudType.opacity.min + Math.random() * (cloudType.opacity.max - cloudType.opacity.min)) * 0.4,
      side: THREE.FrontSide,
      depthWrite: false,
      emissive: new THREE.Color(0x333333),
      emissiveIntensity: 0.22,
    });

    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.position.set(x + xOffset, y, z + zOffset);
    cloudMesh.castShadow = false; // Clouds don't cast shadows for performance
    cloudMesh.receiveShadow = false;
    cloudMesh.renderOrder = 1;

    // Calculate wind velocity
    const windVelocity = new THREE.Vector3(
      Math.cos(this.config.windDirection) * this.config.windSpeed * cloudType.speedMultiplier,
      0,
      Math.sin(this.config.windDirection) * this.config.windSpeed * cloudType.speedMultiplier
    );

    const cloudInstance: CloudInstance = {
      mesh: cloudMesh,
      velocity: windVelocity,
      type: cloudType,
      originalPosition: cloudMesh.position.clone(),
    };

    this.clouds.push(cloudInstance);
    this.cloudGroup.add(cloudMesh);
  }

  private createCloudGeometry(cloudType: CloudType): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Generate multiple cubes to form cloud shape
    const cubeCount = 3 + Math.floor(Math.random() * 5); // 3-7 cubes per cloud
    const baseSize = cloudType.size.min + Math.random() * (cloudType.size.max - cloudType.size.min);

    for (let i = 0; i < cubeCount; i++) {
      const cubeSize = baseSize * (0.6 + Math.random() * 0.8); // Vary size
      const offsetX = (Math.random() - 0.5) * baseSize * 0.8;
      const offsetY = (Math.random() - 0.5) * baseSize * 0.4;
      const offsetZ = (Math.random() - 0.5) * baseSize * 0.8;

      const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize * 0.6, cubeSize);
      const posAttr = cubeGeometry.getAttribute('position');
      const normAttr = cubeGeometry.getAttribute('normal');
      const uvAttr = cubeGeometry.getAttribute('uv');
      const idxAttr = cubeGeometry.getIndex();
      if (!posAttr || !normAttr || !uvAttr) {
        continue;
      }
      const cubeVertices = posAttr.array as ArrayLike<number>;
      const cubeNormals = normAttr.array as ArrayLike<number>;
      const cubeUvs = uvAttr.array as ArrayLike<number>;
      const cubeIndices = idxAttr ? (idxAttr.array as ArrayLike<number>) : undefined;

      const vertexOffset = vertices.length / 3;

      // Add vertices with offset
      for (let j = 0; j < cubeVertices.length; j += 3) {
        vertices.push(
          (cubeVertices[j] as number) + offsetX,
          (cubeVertices[j + 1] as number) + offsetY,
          (cubeVertices[j + 2] as number) + offsetZ
        );
      }

      // Add normals
      for (let j = 0; j < cubeNormals.length; j++) {
        normals.push(cubeNormals[j] as number);
      }

      // Add UVs
      for (let j = 0; j < cubeUvs.length; j++) {
        uvs.push(cubeUvs[j] as number);
      }

      // Add indices with offset
      if (cubeIndices) {
        for (let j = 0; j < cubeIndices.length; j++) {
          indices.push((cubeIndices[j] as number) + vertexOffset);
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
  }

  public update(deltaTime: number): void {
    // Update cloud group position to follow player
    this.cloudGroup.position.copy(this.playerPosition);
    
    this.clouds.forEach((cloud, index) => {
      // Update position based on wind (relative to cloud group)
      cloud.mesh.position.add(cloud.velocity.clone().multiplyScalar(deltaTime));
      
      // Add gentle floating motion (no rotation)
      const floatSpeed = 0.5 + (index % 3) * 0.3; // Vary floating speed
      const floatAmount = Math.sin(Date.now() * 0.001 * floatSpeed) * 0.5;
      cloud.mesh.position.y += floatAmount * deltaTime;

      // Update cloud color and opacity based on time of day
      this.updateCloudAppearance(cloud);
    });
  }

  private updateCloudAppearance(cloud: CloudInstance): void {
    const material = cloud.mesh.material as THREE.MeshLambertMaterial;
    
    // Adjust color based on time of day with more realistic variations
    let colorMultiplier = 1.0;
    let opacityMultiplier = 1.0;
    let colorTint = new THREE.Color(1, 1, 1); // White tint

    if (this.config.timeOfDay < 0.1 || this.config.timeOfDay > 0.9) {
      // Night - darker, bluish clouds
      colorMultiplier = 0.4;
      opacityMultiplier = 0.7;
      colorTint = new THREE.Color(0.6, 0.7, 0.9); // Slight blue tint
    } else if (this.config.timeOfDay < 0.2) {
      // Dawn - warm pinkish tint
      colorMultiplier = 0.9;
      opacityMultiplier = 0.8;
      colorTint = new THREE.Color(1.0, 0.8, 0.9); // Pink tint
    } else if (this.config.timeOfDay < 0.8) {
      // Day - bright white clouds
      colorMultiplier = 1.0;
      opacityMultiplier = 1.0;
      colorTint = new THREE.Color(1, 1, 1); // Pure white
    } else {
      // Sunset - warm orange/red tint
      colorMultiplier = 0.95;
      opacityMultiplier = 0.9;
      colorTint = new THREE.Color(1.0, 0.7, 0.6); // Orange tint
    }

    // Apply color and opacity changes with more realistic base opacity
    const baseColor = cloud.type.color.clone();
    baseColor.multiplyScalar(colorMultiplier);
    baseColor.multiply(colorTint);
    material.color.copy(baseColor);
    // Keep a small emissive term so clouds never go fully black
    if ('emissive' in material) {
      // Maintain a minimum emissive so clouds never go dark
      const minEmissive = 0.15;
      material.emissive.copy(baseColor).multiplyScalar(Math.max(minEmissive, 0.12 * colorMultiplier));
    }
    
    const baseOpacity = cloud.type.opacity.min + (cloud.type.opacity.max - cloud.type.opacity.min) * 0.5;
    material.opacity = (baseOpacity * opacityMultiplier) * 0.3; // Slightly more visible
  }

  public setTimeOfDay(timeOfDay: number): void {
    this.config.timeOfDay = timeOfDay;
  }

  public updatePlayerPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }

  public setDensity(density: number): void {
    this.config.density = Math.max(0, Math.min(1, density));
    this.generateClouds();
  }

  public setWindSpeed(speed: number): void {
    this.config.windSpeed = speed;
    this.updateWindVelocities();
  }

  public setWindDirection(direction: number): void {
    this.config.windDirection = direction;
    this.updateWindVelocities();
  }

  private updateWindVelocities(): void {
    this.clouds.forEach((cloud) => {
      cloud.velocity.set(
        Math.cos(this.config.windDirection) * this.config.windSpeed * cloud.type.speedMultiplier,
        0,
        Math.sin(this.config.windDirection) * this.config.windSpeed * cloud.type.speedMultiplier
      );
    });
  }

  public setCloudTypeEnabled(typeName: string, enabled: boolean): void {
    const cloudType = this.cloudTypes.find(type => type.name === typeName);
    if (cloudType) {
      // Filter clouds by type
      this.clouds.forEach((cloud) => {
        cloud.mesh.visible = enabled || cloud.type.name !== typeName;
      });
    }
  }

  public getConfig(): CloudConfig {
    return { ...this.config };
  }

  public getCloudCount(): number {
    return this.clouds.length;
  }

  private clearClouds(): void {
    this.clouds.forEach((cloud) => {
      this.cloudGroup.remove(cloud.mesh);
      cloud.mesh.geometry.dispose();
      if (cloud.mesh.material instanceof THREE.Material) {
        cloud.mesh.material.dispose();
      }
    });
    this.clouds = [];
  }

  public dispose(): void {
    this.clearClouds();
    this.scene.remove(this.cloudGroup);
  }
}
