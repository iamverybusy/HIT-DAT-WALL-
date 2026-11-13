import * as THREE from 'three';
import type { BagStyleVariant, WallMaterialKind } from '../types/game';

export interface WallMaterialMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  emissiveMap: THREE.CanvasTexture | null;
}

export interface SurfaceMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Converts a 512x512 grayscale height canvas into crisp tangent-space normalMap
 * and linear roughnessMap DataTextures with mipmaps and anisotropic filtering.
 */
function buildNormalAndRoughnessMaps(
  heightCanvas: HTMLCanvasElement,
  roughCanvas: HTMLCanvasElement,
  strength: number,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): { normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture } {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const hPixels = hCtx.getImageData(0, 0, w, h).data;
  const rPixels = rCtx.getImageData(0, 0, w, h).data;

  const normalData = new Uint8Array(w * h * 4);
  const roughData = new Uint8Array(w * h * 4);

  const sampleH = (x: number, y: number): number => {
    const cx = ((x % w) + w) % w;
    const cy = ((y % h) + h) % h;
    return hPixels[(cy * w + cx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // 3x3 Sobel filter for smooth, artifact-free pixel normals
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dX;
      let ny = dY;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      normalData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;

      const rv = rPixels[idx];
      roughData[idx] = rv;
      roughData[idx + 1] = rv;
      roughData[idx + 2] = rv;
      roughData[idx + 3] = 255;
    }
  }

  const normalMap = new THREE.DataTexture(normalData, w, h, THREE.RGBAFormat);
  normalMap.generateMipmaps = true;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(repeatX, repeatY);
  }
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughData, w, h, THREE.RGBAFormat);
  roughnessMap.generateMipmaps = true;
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessMap.magFilter = THREE.LinearFilter;
  roughnessMap.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(repeatX, repeatY);
  }
  roughnessMap.needsUpdate = true;

  return { normalMap, roughnessMap };
}

/**
 * Generates high-resolution 1024x1024 PBR albedo + 512x512 normal/roughness/emissive maps
 * for each destructible wall material tier.
 */
export function createWallMaterialMaps(
  material: WallMaterialKind,
  maxAnisotropy: number
): WallMaterialMaps {
  const rand = createRng(material.charCodeAt(0) * 997 + material.length * 131);

  const albedo = document.createElement('canvas');
  albedo.width = 1024;
  albedo.height = 1024;
  const ctx = albedo.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = 512;
  heightCanvas.height = 512;
  const hCtx = heightCanvas.getContext('2d')!;
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, 512, 512);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#C8C8C8';
  rCtx.fillRect(0, 0, 512, 512);

  let emissiveCanvas: HTMLCanvasElement | null = null;
  let normalStrength = 2.6;

  if (material === 'drywall') {
    normalStrength = 1.6;
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#DFD7CC');
    grad.addColorStop(1, '#CDC4B7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    rCtx.fillStyle = '#DEDEDE';
    rCtx.fillRect(0, 0, 512, 512);

    // Fine orange-peel plaster texture
    for (let i = 0; i < 6500; i++) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      const s = 2 + rand() * 3;
      const light = rand() > 0.5;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.06)' : 'rgba(65,55,45,0.055)';
      ctx.fillRect(x, y, s, s);
      hCtx.fillStyle = light ? 'rgba(220,220,220,0.16)' : 'rgba(60,60,60,0.16)';
      hCtx.fillRect(x * 0.5, y * 0.5, 2, 2);
    }

    // Joint tape seams + drywall screws
    [336, 680].forEach((sx) => {
      ctx.fillStyle = 'rgba(138, 128, 114, 0.28)';
      ctx.fillRect(sx - 10, 0, 20, 1024);
      ctx.fillStyle = 'rgba(245, 240, 232, 0.25)';
      ctx.fillRect(sx - 2, 0, 4, 1024);
      hCtx.fillStyle = '#9C9C9C';
      hCtx.fillRect(sx * 0.5 - 5, 0, 10, 512);
      rCtx.fillStyle = '#EAEAEA';
      rCtx.fillRect(sx * 0.5 - 5, 0, 10, 512);

      for (let sy = 90; sy < 1000; sy += 210) {
        ctx.fillStyle = 'rgba(92, 85, 76, 0.55)';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
        hCtx.fillStyle = '#383838';
        hCtx.beginPath();
        hCtx.arc(sx * 0.5, sy * 0.5, 2.5, 0, Math.PI * 2);
        hCtx.fill();
      }
    });

    // Subtle gym scuff streaks
    ctx.strokeStyle = 'rgba(90, 80, 68, 0.14)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      const y = rand() * 1024;
      const x = rand() * 820;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 90 + rand() * 90, y + (rand() - 0.5) * 28);
      ctx.stroke();
    }
  } else if (material === 'wood') {
    normalStrength = 3.2;
    ctx.fillStyle = '#6A3F1C';
    ctx.fillRect(0, 0, 1024, 1024);
    rCtx.fillStyle = '#B8B8B8';
    rCtx.fillRect(0, 0, 512, 512);

    const plankCount = 7;
    const plankH = 1024 / plankCount;
    for (let p = 0; p < plankCount; p++) {
      const y0 = p * plankH;
      const tone = Math.floor(rand() * 18);
      ctx.fillStyle = `rgb(${128 + tone}, ${78 + Math.floor(tone * 0.6)}, ${38 + Math.floor(tone * 0.35)})`;
      ctx.fillRect(0, y0 + 3, 1024, plankH - 6);

      // Highlight top bevel & dark bottom bevel
      ctx.fillStyle = 'rgba(255, 224, 185, 0.14)';
      ctx.fillRect(0, y0 + 3, 1024, 5);
      ctx.fillStyle = 'rgba(28, 14, 4, 0.55)';
      ctx.fillRect(0, y0 + plankH - 5, 1024, 5);

      hCtx.fillStyle = '#9A9A9A';
      hCtx.fillRect(0, (y0 + 3) * 0.5, 512, (plankH - 6) * 0.5);
      hCtx.fillStyle = '#222222';
      hCtx.fillRect(0, y0 * 0.5, 512, 3);

      // Rich wood grain curves
      for (let g = 0; g < 26; g++) {
        const gy = y0 + 10 + rand() * (plankH - 20);
        const dark = rand() > 0.35;
        ctx.strokeStyle = dark ? 'rgba(44, 22, 8, 0.28)' : 'rgba(180, 122, 68, 0.16)';
        ctx.lineWidth = 1.5 + rand() * 2.5;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(
          340,
          gy + (rand() - 0.5) * 18,
          680,
          gy + (rand() - 0.5) * 18,
          1024,
          gy
        );
        ctx.stroke();

        hCtx.strokeStyle = dark ? 'rgba(90,90,90,0.35)' : 'rgba(195,195,195,0.3)';
        hCtx.lineWidth = 1.5;
        hCtx.beginPath();
        hCtx.moveTo(0, gy * 0.5);
        hCtx.lineTo(512, gy * 0.5);
        hCtx.stroke();
      }

      // Vertical plank joint & iron nail heads
      const jointX = ((p * 370 + 240) % 760) + 120;
      ctx.fillStyle = '#2B1708';
      ctx.fillRect(jointX, y0, 4, plankH);
      hCtx.fillStyle = '#202020';
      hCtx.fillRect(jointX * 0.5, y0 * 0.5, 2, plankH * 0.5);

      [jointX - 24, jointX + 24, 60, 964].forEach((nx) => {
        [y0 + plankH * 0.3, y0 + plankH * 0.7].forEach((ny) => {
          ctx.fillStyle = '#1E1E22';
          ctx.beginPath();
          ctx.arc(nx, ny, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.beginPath();
          ctx.arc(nx - 1.5, ny - 1.5, 2, 0, Math.PI * 2);
          ctx.fill();

          hCtx.fillStyle = '#DFDFDF';
          hCtx.beginPath();
          hCtx.arc(nx * 0.5, ny * 0.5, 3, 0, Math.PI * 2);
          hCtx.fill();
        });
      });
    }
  } else if (material === 'brick') {
    normalStrength = 4.0;
    // Sandy mortar bed
    ctx.fillStyle = '#BDB5AA';
    ctx.fillRect(0, 0, 1024, 1024);
    hCtx.fillStyle = '#383838';
    hCtx.fillRect(0, 0, 512, 512);
    rCtx.fillStyle = '#F2F2F2';
    rCtx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(40,35,30,0.08)';
      ctx.fillRect(rand() * 1024, rand() * 1024, 3, 3);
    }

    const rows = 10;
    const cols = 4;
    const rowH = 1024 / rows;
    const colW = 1024 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 0 ? 0 : colW / 2;
      for (let c = -1; c <= cols; c++) {
        const bx = c * colW + offset;
        const by = r * rowH;
        const pad = 7;
        const bw = colW - pad * 2;
        const bh = rowH - pad * 2;

        const baseR = 138 + Math.floor(rand() * 38);
        const baseG = Math.floor(baseR * (0.37 + rand() * 0.06));
        const baseB = Math.floor(baseR * (0.25 + rand() * 0.05));

        const bGrad = ctx.createLinearGradient(bx, by, bx, by + rowH);
        bGrad.addColorStop(0, `rgb(${baseR + 12}, ${baseG + 6}, ${baseB + 4})`);
        bGrad.addColorStop(1, `rgb(${baseR - 14}, ${baseG - 6}, ${baseB - 4})`);
        ctx.fillStyle = bGrad;
        ctx.fillRect(bx + pad, by + pad, bw, bh);

        // Chipped bevel highlights & mortar shadow
        ctx.fillStyle = 'rgba(255, 220, 200, 0.14)';
        ctx.fillRect(bx + pad, by + pad, bw, 5);
        ctx.fillStyle = 'rgba(30, 12, 8, 0.25)';
        ctx.fillRect(bx + pad, by + pad + bh - 5, bw, 5);

        // Kiln firing speckles on individual brick
        for (let s = 0; s < 35; s++) {
          ctx.fillStyle = rand() > 0.5 ? 'rgba(25,10,5,0.16)' : 'rgba(255,205,175,0.1)';
          ctx.fillRect(bx + pad + rand() * bw, by + pad + rand() * bh, 3 + rand() * 4, 3);
        }

        // Height & roughness per brick
        hCtx.fillStyle = '#D4D4D4';
        hCtx.fillRect((bx + pad) * 0.5, (by + pad) * 0.5, bw * 0.5, bh * 0.5);
        rCtx.fillStyle = '#A8A8A8';
        rCtx.fillRect((bx + pad) * 0.5, (by + pad) * 0.5, bw * 0.5, bh * 0.5);
      }
    }
  } else if (material === 'concrete') {
    normalStrength = 2.8;
    ctx.fillStyle = '#6D7480';
    ctx.fillRect(0, 0, 1024, 1024);
    rCtx.fillStyle = '#D2D2D2';
    rCtx.fillRect(0, 0, 512, 512);

    // Aggregate speckle & subtle troweled blotches
    for (let i = 0; i < 8500; i++) {
      const x = rand() * 1024;
      const y = rand() * 1024;
      const light = rand() > 0.5;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.065)' : 'rgba(17,24,39,0.095)';
      ctx.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 3);
      hCtx.fillStyle = light ? 'rgba(215,215,215,0.2)' : 'rgba(55,55,55,0.22)';
      hCtx.fillRect(x * 0.5, y * 0.5, 2, 2);
    }

    // 4 Cast Concrete Panels with beveled grooves & tie-rod recesses
    [0, 512].forEach((px) => {
      [0, 512].forEach((py) => {
        ctx.strokeStyle = 'rgba(24, 30, 40, 0.58)';
        ctx.lineWidth = 6;
        ctx.strokeRect(px + 3, py + 3, 506, 506);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.14)';
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 8, py + 8, 496, 496);

        hCtx.strokeStyle = '#323232';
        hCtx.lineWidth = 3;
        hCtx.strokeRect(px * 0.5 + 1.5, py * 0.5 + 1.5, 253, 253);

        [128, 384].forEach((ox) => {
          [128, 384].forEach((oy) => {
            const hx = px + ox;
            const hy = py + oy;
            ctx.fillStyle = '#333A46';
            ctx.beginPath();
            ctx.arc(hx, hy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1E242E';
            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI * 2);
            ctx.fill();

            hCtx.fillStyle = '#222222';
            hCtx.beginPath();
            hCtx.arc(hx * 0.5, hy * 0.5, 5, 0, Math.PI * 2);
            hCtx.fill();
          });
        });
      });
    });
  } else if (material === 'steel') {
    normalStrength = 3.0;
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, '#5C6B7E');
    grad.addColorStop(0.45, '#8FA1B5');
    grad.addColorStop(0.55, '#9FB0C4');
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    rCtx.fillStyle = '#565656';
    rCtx.fillRect(0, 0, 512, 512);

    // Anisotropic brushed metal lines
    for (let i = 0; i < 650; i++) {
      const y = rand() * 1024;
      const light = rand() > 0.5;
      ctx.strokeStyle = light ? 'rgba(255,255,255,0.085)' : 'rgba(15,23,42,0.07)';
      ctx.lineWidth = 1 + rand() * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();

      rCtx.strokeStyle = light ? 'rgba(70,70,70,0.3)' : 'rgba(130,130,130,0.25)';
      rCtx.beginPath();
      rCtx.moveTo(0, y * 0.5);
      rCtx.lineTo(512, y * 0.5);
      rCtx.stroke();
    }

    // Dual armor plates & beveled weld seam
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 1014, 1014);
    ctx.beginPath();
    ctx.moveTo(512, 5);
    ctx.lineTo(512, 1019);
    ctx.moveTo(5, 512);
    ctx.lineTo(1019, 512);
    ctx.stroke();

    hCtx.strokeStyle = '#202020';
    hCtx.lineWidth = 5;
    hCtx.strokeRect(2.5, 2.5, 507, 507);
    hCtx.beginPath();
    hCtx.moveTo(256, 0);
    hCtx.lineTo(256, 512);
    hCtx.moveTo(0, 256);
    hCtx.lineTo(512, 256);
    hCtx.stroke();

    // Raised dome rivets around every plate edge
    for (let pos = 52; pos < 990; pos += 82) {
      [38, 474, 550, 986].forEach((rx) => {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(rx, pos, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.arc(rx - 3, pos - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        const rGrad = hCtx.createRadialGradient(
          rx * 0.5 - 1,
          pos * 0.5 - 1,
          1,
          rx * 0.5,
          pos * 0.5,
          6
        );
        rGrad.addColorStop(0, '#FFFFFF');
        rGrad.addColorStop(1, '#808080');
        hCtx.fillStyle = rGrad;
        hCtx.beginPath();
        hCtx.arc(rx * 0.5, pos * 0.5, 6, 0, Math.PI * 2);
        hCtx.fill();
      });
    }
  } else if (material === 'obsidian') {
    normalStrength = 4.2;
    ctx.fillStyle = '#15111B';
    ctx.fillRect(0, 0, 1024, 1024);
    rCtx.fillStyle = '#4A4A4A';
    rCtx.fillRect(0, 0, 512, 512);

    emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = 1024;
    emissiveCanvas.height = 1024;
    const eCtx = emissiveCanvas.getContext('2d')!;
    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, 1024, 1024);

    // Sharp volcanic glass facets
    for (let i = 0; i < 120; i++) {
      const px = rand() * 1024;
      const py = rand() * 1024;
      const dx1 = (rand() - 0.2) * 140;
      const dy1 = (rand() - 0.5) * 140;
      const dx2 = (rand() - 0.5) * 140;
      const dy2 = (rand() - 0.2) * 140;

      const shade = Math.floor(rand() * 240);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(68, 48, 86, 0.34)' : 'rgba(8, 6, 12, 0.48)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dx1, py + dy1);
      ctx.lineTo(px + dx2, py + dy2);
      ctx.closePath();
      ctx.fill();

      hCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      hCtx.beginPath();
      hCtx.moveTo(px * 0.5, py * 0.5);
      hCtx.lineTo((px + dx1) * 0.5, (py + dy1) * 0.5);
      hCtx.lineTo((px + dx2) * 0.5, (py + dy2) * 0.5);
      hCtx.closePath();
      hCtx.fill();
    }

    // Incandescent magma fissures (rendered to both albedo and dedicated emissiveMap)
    for (let v = 0; v < 9; v++) {
      let x = rand() * 1024;
      let y = 0;
      const pts: Array<[number, number]> = [[x, y]];
      while (y < 1024) {
        x += (rand() - 0.5) * 150;
        y += 70 + rand() * 80;
        pts.push([x, y]);
      }

      const drawVein = (targetCtx: CanvasRenderingContext2D, scale: number, stroke: string, width: number) => {
        targetCtx.strokeStyle = stroke;
        targetCtx.lineWidth = width;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';
        targetCtx.beginPath();
        targetCtx.moveTo(pts[0][0] * scale, pts[0][1] * scale);
        for (let i = 1; i < pts.length; i++) {
          targetCtx.lineTo(pts[i][0] * scale, pts[i][1] * scale);
        }
        targetCtx.stroke();
      };

      drawVein(ctx, 1, 'rgba(234, 88, 12, 0.9)', 7);
      drawVein(ctx, 1, '#FDBA74', 2.5);
      drawVein(eCtx, 1, 'rgba(249, 115, 22, 0.9)', 9);
      drawVein(eCtx, 1, '#FEF08A', 3);
      drawVein(hCtx, 0.5, '#1A1A1A', 5);
      drawVein(rCtx, 0.5, '#F0F0F0', 5);
    }
  } else {
    // Diamond Vault
    normalStrength = 3.5;
    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, '#0369A1');
    grad.addColorStop(0.5, '#38BDF8');
    grad.addColorStop(1, '#0284C7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
    rCtx.fillStyle = '#222222';
    rCtx.fillRect(0, 0, 512, 512);

    emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = 1024;
    emissiveCanvas.height = 1024;
    const eCtx = emissiveCanvas.getContext('2d')!;
    eCtx.fillStyle = '#082F49';
    eCtx.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 95; i++) {
      const px = rand() * 1024;
      const py = rand() * 1024;
      const w1 = 90 + rand() * 110;
      const h1 = 90 + rand() * 110;
      const bright = rand() > 0.45;
      ctx.fillStyle = bright ? 'rgba(224, 242, 254, 0.25)' : 'rgba(7, 89, 133, 0.32)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + w1, py + 24);
      ctx.lineTo(px + 28, py + h1);
      ctx.closePath();
      ctx.fill();

      const shade = bright ? 210 : 75;
      hCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      hCtx.beginPath();
      hCtx.moveTo(px * 0.5, py * 0.5);
      hCtx.lineTo((px + w1) * 0.5, (py + 24) * 0.5);
      hCtx.lineTo((px + 28) * 0.5, (py + h1) * 0.5);
      hCtx.closePath();
      hCtx.fill();

      if (bright) {
        eCtx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
        eCtx.lineWidth = 2.5;
        eCtx.beginPath();
        eCtx.moveTo(px, py);
        eCtx.lineTo(px + w1, py + 24);
        eCtx.stroke();
      }
    }
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  let emissiveMap: THREE.CanvasTexture | null = null;
  if (emissiveCanvas) {
    emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.anisotropy = maxAnisotropy;
  }

  const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
    heightCanvas,
    roughCanvas,
    normalStrength,
    maxAnisotropy
  );

  return { map, normalMap, roughnessMap, emissiveMap };
}

/**
 * Generates tiled industrial arena floor PBR maps (albedo + normal + roughness).
 */
export function createArenaFloorMaps(maxAnisotropy: number): SurfaceMaps {
  const rand = createRng(4049);
  const albedo = document.createElement('canvas');
  albedo.width = 1024;
  albedo.height = 1024;
  const ctx = albedo.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = 512;
  heightCanvas.height = 512;
  const hCtx = heightCanvas.getContext('2d')!;
  hCtx.fillStyle = '#9E9E9E';
  hCtx.fillRect(0, 0, 512, 512);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#909090';
  rCtx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#1B1E24';
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 6500; i++) {
    const x = rand() * 1024;
    const y = rand() * 1024;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(x, y, 3, 3);
    rCtx.fillStyle = light ? 'rgba(110,110,110,0.22)' : 'rgba(175,175,175,0.22)';
    rCtx.fillRect(x * 0.5, y * 0.5, 2, 2);
  }

  // Tile seam grid with amber gym bay border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.17)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 1016, 1016);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(512, 0);
  ctx.lineTo(512, 1024);
  ctx.moveTo(0, 512);
  ctx.lineTo(1024, 512);
  ctx.stroke();

  hCtx.strokeStyle = '#282828';
  hCtx.lineWidth = 3;
  hCtx.strokeRect(2, 2, 508, 508);
  hCtx.beginPath();
  hCtx.moveTo(256, 0);
  hCtx.lineTo(256, 512);
  hCtx.moveTo(0, 256);
  hCtx.lineTo(512, 256);
  hCtx.stroke();

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 14);
  map.anisotropy = maxAnisotropy;

  const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
    heightCanvas,
    roughCanvas,
    2.4,
    maxAnisotropy,
    8,
    14
  );

  return { map, normalMap, roughnessMap };
}

/**
 * Generates crisp woven leather / tape texture + normal map for POV fists & gloves.
 */
export function createGloveMaps(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
} {
  const rand = createRng(7717);
  const albedo = document.createElement('canvas');
  albedo.width = 512;
  albedo.height = 512;
  const ctx = albedo.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = 512;
  heightCanvas.height = 512;
  const hCtx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#909090';
  rCtx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#EDEDED';
  ctx.fillRect(0, 0, 512, 512);
  hCtx.fillStyle = '#888888';
  hCtx.fillRect(0, 0, 512, 512);

  // Micro leather / woven tape grain
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y, 2, 2);
    hCtx.fillStyle = light ? 'rgba(210,210,210,0.22)' : 'rgba(65,65,65,0.22)';
    hCtx.fillRect(x, y, 2, 2);
  }

  // Subtle diagonal wrap bands & panel stitching
  for (let y = 0; y < 512; y += 64) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + 18);
    ctx.stroke();

    hCtx.strokeStyle = '#3A3A3A';
    hCtx.lineWidth = 3;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    hCtx.lineTo(512, y + 18);
    hCtx.stroke();
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
    heightCanvas,
    roughCanvas,
    1.8,
    maxAnisotropy
  );
  roughnessMap.dispose();

  return { map, normalMap };
}

/**
 * Generates subtle forearm muscle/tendon contour shading & pore micro-normal maps
 * over a neutral-bright base so any SkinTonePreset color tints accurately.
 */
export function createSkinArmMaps(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
} {
  const rand = createRng(5209);
  const albedo = document.createElement('canvas');
  albedo.width = 512;
  albedo.height = 512;
  const ctx = albedo.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = 512;
  heightCanvas.height = 512;
  const hCtx = heightCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#A8A8A8';
  rCtx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#F5EFEA';
  ctx.fillRect(0, 0, 512, 512);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, 512, 512);

  // Subtle longitudinal forearm muscle belly & tendon grooves
  for (let i = 0; i < 6; i++) {
    const cx = 64 + i * 76;
    const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0);
    grad.addColorStop(0, 'rgba(60,35,20,0.06)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(60,35,20,0.06)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 28, 0, 56, 512);

    const hGrad = hCtx.createLinearGradient(cx - 28, 0, cx + 28, 0);
    hGrad.addColorStop(0, 'rgba(70,70,70,0.28)');
    hGrad.addColorStop(0.5, 'rgba(195,195,195,0.28)');
    hGrad.addColorStop(1, 'rgba(70,70,70,0.28)');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(cx - 28, 0, 56, 512);
  }

  // Fine skin pore micro-grain
  for (let i = 0; i < 3600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(55,30,15,0.045)';
    ctx.fillRect(x, y, 2, 2);
    hCtx.fillStyle = light ? 'rgba(175,175,175,0.16)' : 'rgba(85,85,85,0.16)';
    hCtx.fillRect(x, y, 2, 2);
  }

  // Subtle faint forearm veins near lower wrist/forearm
  ctx.strokeStyle = 'rgba(75, 95, 110, 0.085)';
  ctx.lineWidth = 2.5;
  hCtx.strokeStyle = 'rgba(165, 165, 165, 0.35)';
  hCtx.lineWidth = 2.5;
  for (let v = 0; v < 4; v++) {
    let vx = 80 + v * 110;
    let vy = 10;
    ctx.beginPath();
    hCtx.beginPath();
    ctx.moveTo(vx, vy);
    hCtx.moveTo(vx, vy);
    for (let s = 0; s < 6; s++) {
      vx += (rand() - 0.5) * 26;
      vy += 82;
      ctx.lineTo(vx, vy);
      hCtx.lineTo(vx, vy);
    }
    ctx.stroke();
    hCtx.stroke();
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
    heightCanvas,
    roughCanvas,
    1.35,
    maxAnisotropy
  );
  roughnessMap.dispose();

  return { map, normalMap };
}

/**
 * Generates crisp 512x512 PBR surface maps for each Heavy Bag tier over a tint-friendly base.
 */
export function createBagMaps(style: BagStyleVariant, maxAnisotropy: number): SurfaceMaps {
  const rand = createRng(style.charCodeAt(0) * 613 + style.length * 97);
  const albedo = document.createElement('canvas');
  albedo.width = 512;
  albedo.height = 512;
  const ctx = albedo.getContext('2d')!;

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = 512;
  heightCanvas.height = 512;
  const hCtx = heightCanvas.getContext('2d')!;
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, 512, 512);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 512;
  roughCanvas.height = 512;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#969696';
  rCtx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#EAEAEA';
  ctx.fillRect(0, 0, 512, 512);

  let normalStrength = 2.0;

  if (style === 'leather') {
    normalStrength = 1.9;
    rCtx.fillStyle = '#7C7C7C';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4800; i++) {
      const x = rand() * 512;
      const y = rand() * 512;
      const light = rand() > 0.5;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, y, 2, 2);
      hCtx.fillStyle = light ? 'rgba(190,190,190,0.22)' : 'rgba(70,70,70,0.22)';
      hCtx.fillRect(x, y, 2, 2);
    }
    // Vertical panel seams & double stitching
    for (let sx = 64; sx < 512; sx += 128) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(sx - 2, 0, 4, 512);
      hCtx.fillStyle = '#303030';
      hCtx.fillRect(sx - 2, 0, 4, 512);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let sy = 8; sy < 512; sy += 14) {
        ctx.fillRect(sx - 7, sy, 2, 6);
        ctx.fillRect(sx + 5, sy, 2, 6);
      }
    }
    // Center target ring band
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, 226, 512, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 224, 512, 4);
    ctx.fillRect(0, 286, 512, 4);
  } else if (style === 'canvas') {
    normalStrength = 2.6;
    rCtx.fillStyle = '#DCDCDC';
    rCtx.fillRect(0, 0, 512, 512);
    // Cross-woven duck canvas grid
    for (let p = 0; p < 512; p += 6) {
      ctx.fillStyle = p % 12 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(40,30,15,0.08)';
      ctx.fillRect(p, 0, 3, 512);
      ctx.fillRect(0, p, 512, 3);
      hCtx.fillStyle = p % 12 === 0 ? 'rgba(195,195,195,0.26)' : 'rgba(75,75,75,0.26)';
      hCtx.fillRect(p, 0, 3, 512);
      hCtx.fillRect(0, p, 512, 3);
    }
    // Chalk fist scuffs
    for (let s = 0; s < 16; s++) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(rand() * 512, 140 + rand() * 240, 12 + rand() * 22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'kevlar') {
    normalStrength = 2.4;
    rCtx.fillStyle = '#929292';
    rCtx.fillRect(0, 0, 512, 512);
    // Ballistic diamond ripstop grid
    ctx.strokeStyle = 'rgba(0,0,0,0.24)';
    ctx.lineWidth = 2;
    hCtx.strokeStyle = '#383838';
    hCtx.lineWidth = 2;
    for (let i = -512; i < 1024; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 512, 512);
      ctx.moveTo(i + 512, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      hCtx.beginPath();
      hCtx.moveTo(i, 0);
      hCtx.lineTo(i + 512, 512);
      hCtx.moveTo(i + 512, 0);
      hCtx.lineTo(i, 512);
      hCtx.stroke();
    }
    // Reinforced tactical cross straps
    ctx.fillStyle = 'rgba(15,23,42,0.32)';
    ctx.fillRect(0, 118, 512, 26);
    ctx.fillRect(0, 368, 512, 26);
  } else if (style === 'iron') {
    normalStrength = 2.8;
    rCtx.fillStyle = '#525252';
    rCtx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 2) {
      const light = rand() > 0.5;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, y, 512, 1);
    }
    // Steel drum ribs + rivets
    [120, 256, 392].forEach((ry) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, ry - 4, 512, 8);
      hCtx.fillStyle = '#D8D8D8';
      hCtx.fillRect(0, ry - 4, 512, 8);
      for (let rx = 24; rx < 512; rx += 48) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
        ctx.fill();
        hCtx.fillStyle = '#FFFFFF';
        hCtx.beginPath();
        hCtx.arc(rx, ry, 5, 0, Math.PI * 2);
        hCtx.fill();
      }
    });
  } else if (style === 'obsidian') {
    normalStrength = 3.6;
    ctx.fillStyle = '#CFCFCF';
    ctx.fillRect(0, 0, 512, 512);
    rCtx.fillStyle = '#5C5C5C';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const px = rand() * 512;
      const py = rand() * 512;
      const shade = Math.floor(80 + rand() * 140);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.35)`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (rand() - 0.3) * 90, py + (rand() - 0.5) * 90);
      ctx.lineTo(px + (rand() - 0.5) * 90, py + (rand() - 0.2) * 90);
      ctx.closePath();
      ctx.fill();
      hCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      hCtx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 175, 85, 0.85)';
    ctx.lineWidth = 3;
    for (let v = 0; v < 7; v++) {
      let vx = rand() * 512;
      let vy = 0;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      while (vy < 512) {
        vx += (rand() - 0.5) * 70;
        vy += 45 + rand() * 45;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }
  } else if (style === 'diamond') {
    normalStrength = 3.2;
    rCtx.fillStyle = '#282828';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 85; i++) {
      const px = rand() * 512;
      const py = rand() * 512;
      const bright = rand() > 0.45;
      ctx.fillStyle = bright ? 'rgba(255,255,255,0.34)' : 'rgba(120,175,210,0.28)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 55 + rand() * 55, py + 15);
      ctx.lineTo(px + 20, py + 55 + rand() * 55);
      ctx.closePath();
      ctx.fill();
      hCtx.fillStyle = bright ? '#DCDCDC' : '#646464';
      hCtx.fill();
    }
  } else if (style === 'chrome' || style === 'titanium' || style === 'gold') {
    normalStrength = 2.4;
    rCtx.fillStyle = style === 'chrome' ? '#1E1E1E' : style === 'gold' ? '#2C2C2C' : '#3E3E3E';
    rCtx.fillRect(0, 0, 512, 512);
    // Anisotropic spun-metal lathe rings & heavy vault plate seams
    for (let y = 0; y < 512; y += 2) {
      const bright = rand() > 0.45;
      ctx.fillStyle = bright ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, 512, 1);
    }
    [128, 256, 384].forEach((sy) => {
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(0, sy - 4, 512, 8);
      hCtx.fillStyle = '#383838';
      hCtx.fillRect(0, sy - 4, 512, 8);
    });
    for (let sx = 64; sx < 512; sx += 128) {
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(sx - 2, 0, 4, 512);
      hCtx.fillStyle = '#404040';
      hCtx.fillRect(sx - 2, 0, 4, 512);
    }
  } else if (style === 'jade') {
    normalStrength = 2.8;
    rCtx.fillStyle = '#424242';
    rCtx.fillRect(0, 0, 512, 512);
    // Swirled imperial mineral marbling + temple ring bands
    for (let i = 0; i < 110; i++) {
      const y = rand() * 512;
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(5,45,30,0.22)';
      ctx.lineWidth = 2 + rand() * 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + (rand() - 0.5) * 45, 340, y + (rand() - 0.5) * 45, 512, y);
      ctx.stroke();
      hCtx.strokeStyle = rand() > 0.5 ? 'rgba(200,200,200,0.25)' : 'rgba(70,70,70,0.25)';
      hCtx.lineWidth = 3;
      hCtx.stroke();
    }
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 140, 492, 232);
  } else if (style === 'magma' || style === 'inferno') {
    normalStrength = 3.8;
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(0, 0, 512, 512);
    rCtx.fillStyle = '#686868';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,190,100,0.2)' : 'rgba(30,10,5,0.28)';
      ctx.fillRect(rand() * 512, rand() * 512, 6 + rand() * 14, 6 + rand() * 14);
    }
    // Incandescent cracks
    ctx.strokeStyle = 'rgba(255, 225, 130, 0.92)';
    ctx.lineWidth = 3.5;
    hCtx.strokeStyle = '#252525';
    hCtx.lineWidth = 4;
    for (let v = 0; v < 10; v++) {
      let vx = rand() * 512;
      let vy = 0;
      ctx.beginPath();
      hCtx.beginPath();
      ctx.moveTo(vx, vy);
      hCtx.moveTo(vx, vy);
      while (vy < 512) {
        vx += (rand() - 0.5) * 65;
        vy += 38 + rand() * 44;
        ctx.lineTo(vx, vy);
        hCtx.lineTo(vx, vy);
      }
      ctx.stroke();
      hCtx.stroke();
    }
  } else if (style === 'cyber' || style === 'neon') {
    normalStrength = 3.0;
    rCtx.fillStyle = '#383838';
    rCtx.fillRect(0, 0, 512, 512);
    // Crisp circuit hex-grid & glowing energy conduits
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 2.5;
    hCtx.strokeStyle = '#D8D8D8';
    hCtx.lineWidth = 2.5;
    for (let y = 0; y < 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      hCtx.beginPath();
      hCtx.moveTo(0, y);
      hCtx.lineTo(512, y);
      hCtx.stroke();
    }
    for (let x = 0; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
      hCtx.beginPath();
      hCtx.moveTo(x, 0);
      hCtx.lineTo(x, 512);
      hCtx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 240, 512, 32);
  } else {
    // Void & Celestial Star-Core
    normalStrength = 3.4;
    rCtx.fillStyle = '#262626';
    rCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 220; i++) {
      const px = rand() * 512;
      const py = rand() * 512;
      const r = 1.5 + rand() * 4;
      ctx.fillStyle = rand() > 0.3 ? 'rgba(255,255,255,0.68)' : 'rgba(180,150,255,0.45)';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      hCtx.fillStyle = '#DEDEDE';
      hCtx.beginPath();
      hCtx.arc(px, py, r + 1, 0, Math.PI * 2);
      hCtx.fill();
    }
    // Orbiting celestial meridian rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    for (let y = 96; y <= 416; y += 160) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const { normalMap, roughnessMap } = buildNormalAndRoughnessMaps(
    heightCanvas,
    roughCanvas,
    normalStrength,
    maxAnisotropy
  );

  return { map, normalMap, roughnessMap };
}


/**
 * 1024x1024 dynamic crack overlay that accumulates crisp chipped craters and
 * multi-tiered branching fractures on the wall face as HP drains.
 */
export class DynamicCrackCanvas {
  public readonly canvas: HTMLCanvasElement;
  public readonly ctx: CanvasRenderingContext2D;
  public readonly texture: THREE.CanvasTexture;

  constructor(maxAnisotropy: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = maxAnisotropy;
    this.clear();
  }

  public clear() {
    this.ctx.clearRect(0, 0, 1024, 1024);
    this.texture.needsUpdate = true;
  }

  public addImpactCrack(uvX: number, uvY: number, damageRatio: number, material: WallMaterialKind) {
    const cx = Math.max(70, Math.min(954, uvX * 1024));
    const cy = Math.max(70, Math.min(954, (1 - uvY) * 1024));
    const ctx = this.ctx;

    // Impact bruising & dent crater
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 24 + damageRatio * 28);
    if (material === 'obsidian') {
      grad.addColorStop(0, 'rgba(253, 186, 116, 0.85)');
      grad.addColorStop(0.5, 'rgba(234, 88, 12, 0.45)');
      grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    } else if (material === 'diamond') {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.4)');
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    } else {
      grad.addColorStop(0, 'rgba(8, 8, 10, 0.65)');
      grad.addColorStop(0.6, 'rgba(20, 20, 24, 0.25)');
      grad.addColorStop(1, 'rgba(20, 20, 24, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 24 + damageRatio * 28, 0, Math.PI * 2);
    ctx.fill();

    // Jagged primary & secondary radiating cracks with subtle pale rim bevel
    const branches = 6 + Math.floor(damageRatio * 7);
    const maxLen = 85 + damageRatio * 265;

    for (let b = 0; b < branches; b++) {
      let angle = (b / branches) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      let px = cx;
      let py = cy;
      const steps = 5 + Math.floor(damageRatio * 6);
      const stepLen = maxLen / steps;

      const pts: Array<[number, number]> = [[px, py]];
      for (let s = 0; s < steps; s++) {
        angle += (Math.random() - 0.5) * 0.85;
        px += Math.cos(angle) * stepLen;
        py += Math.sin(angle) * stepLen;
        pts.push([px, py]);
      }

      // Chipped bevel highlight offset
      ctx.strokeStyle =
        material === 'obsidian'
          ? 'rgba(254, 240, 138, 0.45)'
          : 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = Math.max(1.5, 4.4 - b * 0.2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + 1.5, pts[0][1] + 1.5);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + 1.5, pts[i][1] + 1.5);
      ctx.stroke();

      // Deep fracture core
      ctx.strokeStyle =
        material === 'obsidian'
          ? 'rgba(251, 146, 60, 0.96)'
          : material === 'diamond'
            ? 'rgba(240, 249, 255, 0.94)'
            : 'rgba(8, 8, 12, 0.92)';
      ctx.lineWidth = Math.max(1.8, 5.2 - b * 0.24);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
  }
}
