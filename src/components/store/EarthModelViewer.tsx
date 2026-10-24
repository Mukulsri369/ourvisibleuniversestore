import { useEffect, useRef, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type * as THREE from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";

type ViewerControls = OrbitControlsType;

export function EarthModelViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<ViewerControls | null>(null);
  const [failed, setFailed] = useState(false);
  const prefersReducedMotion = !!useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: ViewerControls | undefined;
    let observer: ResizeObserver | undefined;
    let model: THREE.Object3D | undefined;
    let scene: THREE.Scene | undefined;
    let cloudLayer: THREE.Mesh | undefined;
    let releaseWheelListener: (() => void) | undefined;

    async function initialize() {
      try {
        const [THREE, { OrbitControls }] = await Promise.all([
          import("three"),
          import("three/addons/controls/OrbitControls.js"),
        ]);
        if (cancelled || !canvas) return;

        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 4.443, 0.25);
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        scene.add(new THREE.HemisphereLight(0xb8ddff, 0x050812, 0.38));
        const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.6);
        keyLight.position.set(-4, 2.5, 5);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x4d9dff, 0.15);
        rimLight.position.set(4, -1.5, -4);
        scene.add(rimLight);

        controls = new OrbitControls(camera, canvas);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.065;
        controls.enablePan = false;
        controls.enableZoom = true;
        controls.zoomSpeed = 0.75;
        controls.rotateSpeed = 0.55;
        controls.minDistance = 2.2;
        controls.maxDistance = 8;
        controls.autoRotate = !prefersReducedMotion;
        controls.autoRotateSpeed = 0.35;
        controls.target.set(0, 0, 0);
        controls.update();
        controls.saveState();

        // Intercept before OrbitControls prevents the native wheel default.
        // At maximum distance, an outward wheel gesture belongs to the page.
        const releasePageScroll = (event: WheelEvent) => {
          if (!controls || event.ctrlKey || event.deltaY <= 0) return;
          const distance = camera.position.distanceTo(controls.target);
          if (distance >= controls.maxDistance - 0.02) {
            event.stopImmediatePropagation();
          }
        };
        canvas.addEventListener("wheel", releasePageScroll, { capture: true, passive: true });
        releaseWheelListener = () => canvas.removeEventListener("wheel", releasePageScroll, true);

        const resize = () => {
          if (!renderer || !canvas) return;
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();

        new THREE.TextureLoader().load(
          "/models/earth-day-4k.png",
          (texture) => {
            if (cancelled || !scene || !renderer) { texture.dispose(); return; }
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            const geometry = new THREE.SphereGeometry(1.225, 192, 128);
            const material = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.86,
              metalness: 0,
            });
            model = new THREE.Group();
            model.add(new THREE.Mesh(geometry, material));
            const atmosphere = new THREE.ShaderMaterial({
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
              uniforms: { sunDirection: { value: keyLight.position.clone().normalize() } },
              vertexShader: `
                varying vec3 worldNormal;
                varying vec3 worldPosition;
                void main() {
                  vec4 world = modelMatrix * vec4(position, 1.0);
                  worldPosition = world.xyz;
                  worldNormal = normalize(mat3(modelMatrix) * normal);
                  gl_Position = projectionMatrix * viewMatrix * world;
                }
              `,
              fragmentShader: `
                uniform vec3 sunDirection;
                varying vec3 worldNormal;
                varying vec3 worldPosition;
                void main() {
                  vec3 normal = normalize(worldNormal);
                  vec3 viewDirection = normalize(cameraPosition - worldPosition);
                  float facing = max(dot(normal, viewDirection), 0.0);
                  float rim = pow(1.0 - facing, 4.0);
                  float daylight = smoothstep(-0.22, 0.65, dot(normal, sunDirection));
                  vec3 color = mix(vec3(0.08, 0.22, 0.65), vec3(0.22, 0.56, 1.0), daylight);
                  gl_FragColor = vec4(color, rim * (0.08 + daylight * 0.5));
                  #include <tonemapping_fragment>
                  #include <colorspace_fragment>
                }
              `,
            });
            model.add(new THREE.Mesh(new THREE.SphereGeometry(1.247, 96, 64), atmosphere));
            scene.add(model);
            const earthGroup = model;
            new THREE.TextureLoader().load("/models/earth-clouds-real-4k.png", (cloudTexture) => {
              if (cancelled || !renderer) { cloudTexture.dispose(); return; }
              cloudTexture.colorSpace = THREE.SRGBColorSpace;
              cloudTexture.wrapS = THREE.RepeatWrapping;
              cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
              cloudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
              cloudLayer = new THREE.Mesh(
                new THREE.SphereGeometry(1.236, 128, 96),
                new THREE.MeshStandardMaterial({
                  map: cloudTexture, transparent: true, opacity: 0.92,
                  depthWrite: false, roughness: 1, metalness: 0,
                }),
              );
              cloudLayer.name = "Earth cloud layer";
              earthGroup.add(cloudLayer);
            }, undefined, () => { /* Keep the surface visible if the optional cloud map fails. */ });
          },
          undefined,
          () => { if (!cancelled) setFailed(true); },
        );
        let previousTime = performance.now();
        const render = () => {
          if (cancelled || !renderer || !scene) return;
          const now = performance.now();
          const delta = Math.min((now - previousTime) / 1000, 0.1);
          previousTime = now;
          if (!document.hidden) controls?.update(delta);
          if (cloudLayer && !prefersReducedMotion && !document.hidden) cloudLayer.rotation.y += delta * 0.006;
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        render();
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      releaseWheelListener?.();
      controls?.dispose();
      controlsRef.current = null;
      if (model) {
        model.traverse((item) => {
          const mesh = item as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            for (const value of Object.values(material)) {
              if (value && typeof value === "object" && "isTexture" in value) {
                (value as THREE.Texture).dispose();
              }
            }
            material.dispose();
          });
        });
      }
      renderer?.dispose();
    };
  }, [prefersReducedMotion]);

  function zoom(factor: number) {
    const controls = controlsRef.current;
    if (!controls) return;
    if (factor < 1) controls.dollyIn(factor);
    else controls.dollyOut(1 / factor);
    controls.update();
  }

  function reset() {
    controlsRef.current?.reset();
  }

  return (
    <div className="earth-viewer" aria-label="Interactive 3D Earth">
      <canvas
        ref={canvasRef}
        className="earth-viewer-canvas"
        aria-label="3D Earth. Drag to rotate, scroll or pinch to zoom."
        role="img"
      />
      {failed && (
        <div className="earth-viewer-error" role="status">
          The 3D Earth could not be loaded in this browser.
        </div>
      )}
      <div className="earth-viewer-controls" aria-label="Earth controls">
        <button type="button" onClick={() => zoom(0.82)} aria-label="Zoom in" title="Zoom in"><ZoomIn /></button>
        <button type="button" onClick={() => zoom(1.22)} aria-label="Zoom out" title="Zoom out"><ZoomOut /></button>
        <button type="button" onClick={reset} aria-label="Reset Earth view" title="Reset view"><RotateCcw /></button>
      </div>
      <p className="earth-viewer-hint">DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM · KEEP SCROLLING TO EXPLORE</p>
    </div>
  );
}








