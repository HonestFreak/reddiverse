import * as THREE from 'three';
import { CloudManager } from './CloudManager';

export interface SkyConfig {
  timeOfDay: number; // 0-1, where 0 is midnight, 0.5 is noon
  skyType: 'day' | 'sunset' | 'night' | 'dawn';
  sunEnabled: boolean;
  moonEnabled: boolean;
  starsEnabled: boolean;
}

export interface SkyPreset {
  name: string;
  skyColor: THREE.Color;
  horizonColor: THREE.Color;
  groundColor: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientIntensity: number;
}

export class SkyManager {
  private scene: THREE.Scene;
  private skybox: THREE.Mesh | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private moon: THREE.Mesh | null = null;
  private stars: THREE.Points | null = null;
  private cloudManager: CloudManager | null = null;
  private config: SkyConfig;
  private presets: Map<string, SkyPreset>;
  
  // Smooth transition properties
  private currentPreset: SkyPreset | null = null;
  private targetPreset: SkyPreset | null = null;
  private transitionProgress: number = 0;
  private transitionSpeed: number = 0.5; // How fast transitions happen

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.config = {
      timeOfDay: 0.5, // Start at noon
      skyType: 'day',
      sunEnabled: true,
      moonEnabled: true,
      starsEnabled: true,
    };

    this.presets = new Map();
    this.initializePresets();
    this.createSkybox();
    this.createSun();
    this.createMoon();
    this.createStars();
    this.createClouds();
  }

  private initializePresets(): void {
    // Day preset - much lighter colors
    this.presets.set('day', {
      name: 'Day',
      skyColor: new THREE.Color(0xB0E0E6), // Very light sky blue
      horizonColor: new THREE.Color(0xF0F8FF), // Almost white blue
      groundColor: new THREE.Color(0x4A7C59), // Green
      sunColor: new THREE.Color(0xFFFFE0), // Very light yellow
      sunIntensity: 1.2,
      ambientIntensity: 0.8,
    });

    // Sunset preset - much lighter warm colors
    this.presets.set('sunset', {
      name: 'Sunset',
      skyColor: new THREE.Color(0xFFE4B5), // Very light peach
      horizonColor: new THREE.Color(0xFFF8DC), // Very light cream
      groundColor: new THREE.Color(0x4A7C59), // Green
      sunColor: new THREE.Color(0xFFFACD), // Very light golden yellow
      sunIntensity: 0.8,
      ambientIntensity: 0.6,
    });

    // Night preset
    this.presets.set('night', {
      name: 'Night',
      skyColor: new THREE.Color(0x191970), // Midnight blue
      horizonColor: new THREE.Color(0x2F2F4F), // Dark slate gray
      groundColor: new THREE.Color(0x2F2F2F), // Dark gray
      sunColor: new THREE.Color(0xFFFFFF), // White (moon)
      sunIntensity: 0.3,
      ambientIntensity: 0.2,
    });

    // Dawn preset - much lighter pink
    this.presets.set('dawn', {
      name: 'Dawn',
      skyColor: new THREE.Color(0xFFF0F5), // Very light pink
      horizonColor: new THREE.Color(0xFFF8F8), // Almost white pink
      groundColor: new THREE.Color(0x4A7C59), // Green
      sunColor: new THREE.Color(0xFFFACD), // Very light golden yellow
      sunIntensity: 0.6,
      ambientIntensity: 0.4,
    });
  }

  private createSkybox(): void {
    const geometry = new THREE.SphereGeometry(800, 32, 32); // Larger skybox
    const material = new THREE.ShaderMaterial({
      uniforms: {
        skyColor: { value: new THREE.Color(0x87CEEB) },
        horizonColor: { value: new THREE.Color(0xE0F6FF) },
        groundColor: { value: new THREE.Color(0x4A7C59) },
        sunPosition: { value: new THREE.Vector3(0, 1, 0) },
        timeOfDay: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 skyColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform vec3 sunPosition;
        uniform float timeOfDay;
        varying vec3 vWorldPosition;
        
        void main() {
          vec3 direction = normalize(vWorldPosition);
          float elevation = direction.y;
          
          // Create gradient from sky to horizon
          vec3 color;
          if (elevation > 0.0) {
            // Sky
            float factor = pow(elevation, 0.5);
            color = mix(horizonColor, skyColor, factor);
            
            // Add sun glow
            float sunDistance = distance(direction, sunPosition);
            float sunGlow = 1.0 - smoothstep(0.0, 0.3, sunDistance);
            color = mix(color, vec3(1.0, 0.9, 0.7), sunGlow * 0.3);
          } else {
            // Below horizon: do not draw a dark ground plane inside the skybox.
            // Use horizon color to avoid a visible flat band.
            color = horizonColor;
          }
          
          // Adjust brightness based on time of day
          float brightness = mix(0.2, 1.0, smoothstep(0.0, 0.5, timeOfDay) * smoothstep(1.0, 0.5, timeOfDay));
          color *= brightness;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    });

    this.skybox = new THREE.Mesh(geometry, material);
    // Ensure the skybox never writes to depth and is never culled
    (this.skybox.material as THREE.ShaderMaterial).depthWrite = false;
    this.skybox.frustumCulled = false;
    this.skybox.position.set(0, 0, 0); // Ensure skybox is centered
    this.scene.add(this.skybox);
  }

  private createSun(): void {
    if (!this.config.sunEnabled) return;

    this.sun = new THREE.DirectionalLight(0xFFFFAA, 1.2);
    this.sun.position.set(50, 50, 50);
    this.sun.castShadow = false; // Keep shadows off for performance
    this.scene.add(this.sun);

    // Sun disc removed - was causing the big circle that follows player
  }

  private createMoon(): void {
    if (!this.config.moonEnabled) return;

    const moonGeometry = new THREE.SphereGeometry(4, 16, 16);
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.8,
    });
    this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
    this.moon.position.set(-80, 120, -60); // Much higher and further away
    this.scene.add(this.moon);
  }

  private createStars(): void {
    if (!this.config.starsEnabled) return;

    const starCount = 1000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      
      // Random position on sphere - much higher and further
      const radius = 500; // Increased radius
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i3 + 1] = radius * Math.cos(phi) + 100; // Offset higher
      starPositions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      
      // Random star color (white to blue-white)
      const color = new THREE.Color();
      color.setHSL(0.6, 0.1, 0.8 + Math.random() * 0.2);
      starColors[i3] = color.r;
      starColors[i3 + 1] = color.g;
      starColors[i3 + 2] = color.b;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);
  }


  private createClouds(): void {
    this.cloudManager = new CloudManager(this.scene);
  }

  public updateTimeOfDay(timeOfDay: number): void {
    this.config.timeOfDay = Math.max(0, Math.min(1, timeOfDay));
    
    // Determine target sky type based on time
    let targetSkyType: string;
    if (this.config.timeOfDay < 0.1 || this.config.timeOfDay > 0.9) {
      targetSkyType = 'night';
    } else if (this.config.timeOfDay < 0.2) {
      targetSkyType = 'dawn';
    } else if (this.config.timeOfDay < 0.8) {
      targetSkyType = 'day';
    } else {
      targetSkyType = 'sunset';
    }

    // If sky type changed, start transition
    if (this.config.skyType !== targetSkyType) {
      this.config.skyType = targetSkyType as 'day' | 'sunset' | 'night' | 'dawn';
      this.targetPreset = this.presets.get(targetSkyType) || null;
      this.transitionProgress = 0;
    }

    this.updateSky();
    this.updateSunPosition();
    this.updateMoonVisibility();
    this.updateStarsVisibility();
    this.updateClouds();
  }

  private updateSky(): void {
    if (!this.skybox) return;

    const preset = this.presets.get(this.config.skyType);
    if (!preset) return;

    // Initialize current preset if not set
    if (!this.currentPreset) {
      this.currentPreset = { ...preset };
    }

    // If we have a target preset and are transitioning
    if (this.targetPreset && this.transitionProgress < 1) {
      // Interpolate between current and target presets
      const t = this.transitionProgress;
      const interpolatedPreset = this.interpolatePresets(this.currentPreset, this.targetPreset, t);
      
      const material = this.skybox.material as THREE.ShaderMaterial;
      if (material.uniforms.skyColor) material.uniforms.skyColor.value.copy(interpolatedPreset.skyColor);
      if (material.uniforms.horizonColor) material.uniforms.horizonColor.value.copy(interpolatedPreset.horizonColor);
      if (material.uniforms.groundColor) material.uniforms.groundColor.value.copy(interpolatedPreset.groundColor);
      if (material.uniforms.timeOfDay) material.uniforms.timeOfDay.value = this.config.timeOfDay;

      // Update current preset when transition is complete
      if (this.transitionProgress >= 1) {
        this.currentPreset = { ...this.targetPreset };
        this.targetPreset = null;
        this.transitionProgress = 0;
      }
    } else {
      // No transition, use preset directly
      const material = this.skybox.material as THREE.ShaderMaterial;
      if (material.uniforms.skyColor) material.uniforms.skyColor.value.copy(preset.skyColor);
      if (material.uniforms.horizonColor) material.uniforms.horizonColor.value.copy(preset.horizonColor);
      if (material.uniforms.groundColor) material.uniforms.groundColor.value.copy(preset.groundColor);
      if (material.uniforms.timeOfDay) material.uniforms.timeOfDay.value = this.config.timeOfDay;
      
      this.currentPreset = { ...preset };
    }
  }

  private updateSunPosition(): void {
    if (!this.sun) return;

    // Calculate sun position based on time of day
    const angle = (this.config.timeOfDay - 0.5) * Math.PI * 2; // -π to π
    const sunDistance = 200; // Increased distance
    const sunHeight = Math.sin(angle) * sunDistance;
    const sunDistanceXZ = Math.cos(angle) * sunDistance;

    this.sun.position.set(sunDistanceXZ, sunHeight, 0);
    // Update sky shader with sun direction so glow stays consistent
    if (this.skybox) {
      const mat = this.skybox.material as THREE.ShaderMaterial;
      if (mat && mat.uniforms && mat.uniforms.sunPosition) {
        const sunDir = new THREE.Vector3().copy(this.sun.position).normalize();
        mat.uniforms.sunPosition.value.copy(sunDir);
      }
    }
    
    // Update sun color and intensity based on time
    const preset = this.presets.get(this.config.skyType);
    if (preset) {
      // Use interpolated values if transitioning
      if (this.targetPreset && this.transitionProgress < 1) {
        const t = this.transitionProgress;
        const interpolatedPreset = this.interpolatePresets(this.currentPreset!, this.targetPreset, t);
        this.sun.color.copy(interpolatedPreset.sunColor);
        this.sun.intensity = interpolatedPreset.sunIntensity;
        
        // Update ambient light with interpolated values
        const ambientLight = this.scene.getObjectByName('ambientLight') as THREE.AmbientLight;
        if (ambientLight) {
          ambientLight.intensity = interpolatedPreset.ambientIntensity;
        }
      } else {
        this.sun.color.copy(preset.sunColor);
        this.sun.intensity = preset.sunIntensity;
        
        // Update ambient light
        const ambientLight = this.scene.getObjectByName('ambientLight') as THREE.AmbientLight;
        if (ambientLight) {
          ambientLight.intensity = preset.ambientIntensity;
        }
      }
    }
  }

  private updateMoonVisibility(): void {
    if (!this.moon) return;

    // Show moon during night and dawn
    const isVisible = this.config.timeOfDay < 0.2 || this.config.timeOfDay > 0.8;
    this.moon.visible = isVisible;
  }

  private updateStarsVisibility(): void {
    if (!this.stars) return;

    // Show stars during night and dawn
    const isVisible = this.config.timeOfDay < 0.2 || this.config.timeOfDay > 0.8;
    this.stars.visible = isVisible;
  }

  private updateClouds(): void {
    if (this.cloudManager) {
      this.cloudManager.setTimeOfDay(this.config.timeOfDay);
    }
  }


  public setSkyType(skyType: 'day' | 'sunset' | 'night' | 'dawn'): void {
    this.config.skyType = skyType;
    this.updateSky();
  }

  public getConfig(): SkyConfig {
    return { ...this.config };
  }

  public update(deltaTime: number): void {
    if (this.cloudManager) {
      this.cloudManager.update(deltaTime);
    }
    
    // Update transition progress
    if (this.targetPreset && this.transitionProgress < 1) {
      this.transitionProgress += this.transitionSpeed * deltaTime;
      this.transitionProgress = Math.min(1, this.transitionProgress);
      
      // Update sky during transition
      this.updateSky();
    }
  }

  public setCloudDensity(density: number): void {
    if (this.cloudManager) {
      this.cloudManager.setDensity(density);
    }
  }

  public setWindSpeed(speed: number): void {
    if (this.cloudManager) {
      this.cloudManager.setWindSpeed(speed);
    }
  }

  public setWindDirection(direction: number): void {
    if (this.cloudManager) {
      this.cloudManager.setWindDirection(direction);
    }
  }

  public updatePlayerPosition(position: THREE.Vector3): void {
    if (this.cloudManager) {
      this.cloudManager.updatePlayerPosition(position);
    }
    // Keep skydome and celestial objects centered on the player to avoid parallax artifacts
    if (this.skybox) this.skybox.position.copy(position);
    if (this.stars) this.stars.position.copy(position);
    if (this.moon) this.moon.position.set(position.x - 80, position.y + 120, position.z - 60);
  }

  private interpolatePresets(from: SkyPreset, to: SkyPreset, t: number): SkyPreset {
    return {
      name: to.name,
      skyColor: from.skyColor.clone().lerp(to.skyColor, t),
      horizonColor: from.horizonColor.clone().lerp(to.horizonColor, t),
      groundColor: from.groundColor.clone().lerp(to.groundColor, t),
      sunColor: from.sunColor.clone().lerp(to.sunColor, t),
      sunIntensity: from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t,
      ambientIntensity: from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * t,
    };
  }

  public dispose(): void {
    if (this.skybox) {
      this.scene.remove(this.skybox);
      this.skybox.geometry.dispose();
      if (this.skybox.material instanceof THREE.Material) {
        this.skybox.material.dispose();
      }
    }

    if (this.sun) {
      this.scene.remove(this.sun);
    }

    if (this.moon) {
      this.scene.remove(this.moon);
      this.moon.geometry.dispose();
      if (this.moon.material instanceof THREE.Material) {
        this.moon.material.dispose();
      }
    }

    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      if (this.stars.material instanceof THREE.Material) {
        this.stars.material.dispose();
      }
    }

    if (this.cloudManager) {
      this.cloudManager.dispose();
    }
  }
}
