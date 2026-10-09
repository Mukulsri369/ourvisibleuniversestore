import { useEffect, useRef } from "react";

/** The graphics engine loads only in the browser, after the store has rendered. */
export function GalaxyScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let dispose = () => {};

    void import("three").then((THREE) => {
      if (cancelled) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
      } catch {
        return; // The CSS starfield remains visible when WebGL is unavailable.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setClearAlpha(0);
      renderer.domElement.setAttribute("aria-hidden", "true");
      element.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
      camera.position.z = 20;
      const palette = getComputedStyle(element);
      const core = new THREE.Color(palette.getPropertyValue("--galaxy-core").trim());
      const dust = new THREE.Color(palette.getPropertyValue("--galaxy-dust").trim());
      const blue = new THREE.Color(palette.getPropertyValue("--galaxy-blue").trim());
      let seed = 1729;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const materials: InstanceType<typeof THREE.ShaderMaterial>[] = [];
      const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const makePoints = (count: number, radius: number, stars = false) => {
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const bulge = i % 4 === 0;
          const r = Math.pow(random(), bulge ? 3.5 : 1.3) * (bulge ? radius * 0.32 : radius);
          const arm = i % 3;
          const angle = bulge ? random() * Math.PI * 2 : arm * Math.PI * 2 / 3 + r * 1.85 + (random() - 0.5) * (0.35 + r * 0.24);
          const spread = (random() - 0.5) * (0.08 + r * 0.17);
          positions[i * 3] = stars ? (random() - 0.5) * 24 : Math.cos(angle) * r + spread;
          positions[i * 3 + 1] = stars ? (random() - 0.5) * 14 : Math.sin(angle) * r + spread;
          positions[i * 3 + 2] = stars ? -3 : (random() - 0.5) * 0.28;
          const color = core.clone().lerp(i % 5 === 0 ? dust : blue, Math.min(r / radius * 0.85, 1));
          color.multiplyScalar(stars ? 0.2 + random() * 0.4 : 0.45 + random() * 0.55);
          colors.set([color.r, color.g, color.b], i * 3);
          sizes[i] = stars ? 0.6 + random() * 1.1 : 0.7 + random() * 1.3;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("pointSize", new THREE.BufferAttribute(sizes, 1));
        const material = new THREE.ShaderMaterial({
          uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
          vertexShader: `attribute vec3 color; attribute float pointSize; varying vec3 vColor;
            uniform float pixelRatio;
            void main() { vColor = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = pointSize * pixelRatio; }`,
          fragmentShader: `varying vec3 vColor;
            void main() { float d = length(gl_PointCoord - vec2(0.5));
              if (d > 0.5) discard;
              gl_FragColor = vec4(vColor, pow(1.0 - d * 2.0, 1.25) * 0.85); }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        materials.push(material);
        geometries.push(geometry);
        return new THREE.Points(geometry, material);
      };
      const galaxy = makePoints(window.innerWidth < 640 ? 24000 : 40000, 3.5);
      const companion = makePoints(8500, 1.15);
      scene.add(galaxy, companion, makePoints(1500, 0, true));
      galaxy.rotation.x = 0.48;
      galaxy.rotation.z = -0.38;
      companion.rotation.x = 0.8;
      companion.rotation.z = 0.7;

      const resize = () => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        const mobile = width < 640;
        const halfHeight = mobile ? 6.2 : 5;
        camera.left = -halfHeight * width / height;
        camera.right = halfHeight * width / height;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        galaxy.scale.setScalar(mobile ? 0.75 : 1);
        galaxy.position.set(mobile ? 0.15 : camera.right * 0.46, mobile ? 2.4 : 0.15, 0);
        companion.scale.setScalar(mobile ? 0.5 : 0.85);
        companion.position.set(mobile ? -1.8 : camera.right * 0.12, mobile ? 4.3 : -2.7, 0);
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let visible = true;
      let frame = 0;
      let lastTime = 0;
      const render = (time: number) => {
        frame = requestAnimationFrame(render);
        if (!visible || document.hidden || reducedMotion.matches || time - lastTime < 33) return;
        const delta = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        galaxy.rotation.z += delta * 0.025;
        companion.rotation.z -= delta * 0.018;
        renderer.render(scene, camera);
      };
      const visibility = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; });
      visibility.observe(element);
      frame = requestAnimationFrame(render);
      const pointer = (event: PointerEvent) => {
        if (reducedMotion.matches || event.pointerType === "touch") return;
        const bounds = element.getBoundingClientRect();
        galaxy.rotation.y = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.12;
      };
      element.parentElement?.addEventListener("pointermove", pointer);
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        visibility.disconnect();
        element.parentElement?.removeEventListener("pointermove", pointer);
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => {});
    return () => { cancelled = true; dispose(); };
  }, []);

  return <div ref={host} className="galaxy-scene" aria-hidden="true" />;
}