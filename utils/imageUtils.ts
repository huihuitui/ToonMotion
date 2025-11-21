import JSZip from 'jszip';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import UPNG from 'upng-js';

/**
 * Native implementation to save a blob as a file
 */
const saveAs = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

/**
 * Converts a File object to a Base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Helper to load an image from base64
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

/**
 * Finds the bounding box of visible content in a canvas context
 */
const getContentBounds = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  // Threshold for "content". Assuming white background might remain or transparency.
  // We treat anything not fully transparent AND not near-white as content.
  const whiteThreshold = 240;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if pixel is visible
      if (alpha > 20) {
        // Check if it's NOT white (if we haven't fully removed bg yet, this helps)
        if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
  }

  if (!found) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

/**
 * Processes a list of canvas frames:
 * 1. Finds the content bounding box for each frame.
 * 2. Determines the maximum width and height of content across all frames.
 * 3. Creates new uniform canvases and centers the content in them.
 * This fixes "jitter" in animation.
 */
const alignAndCenterFrames = (frames: HTMLCanvasElement[]): string[] => {
  // 1. Get bounds for all frames
  const bounds = frames.map(frame => {
    const ctx = frame.getContext('2d');
    if (!ctx) return null;
    return getContentBounds(ctx, frame.width, frame.height);
  });

  // 2. Find max dimensions
  let maxContentW = 0;
  let maxContentH = 0;
  
  bounds.forEach(b => {
    if (b) {
      maxContentW = Math.max(maxContentW, b.w);
      maxContentH = Math.max(maxContentH, b.h);
    }
  });

  // Add some padding
  const padding = Math.max(20, Math.floor(maxContentW * 0.1));
  const finalW = maxContentW + padding * 2;
  const finalH = maxContentH + padding * 2;

  // 3. Center content
  const resultBase64: string[] = [];

  frames.forEach((frame, i) => {
    const bound = bounds[i];
    const canvas = document.createElement('canvas');
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext('2d');
    
    if (ctx && bound) {
      // Draw content from source frame (using bound coordinates) to center of new canvas
      const targetX = (finalW - bound.w) / 2;
      const targetY = (finalH - bound.h) / 2;
      
      ctx.drawImage(
        frame, 
        bound.x, bound.y, bound.w, bound.h, // Source crop
        targetX, targetY, bound.w, bound.h  // Destination location
      );
      resultBase64.push(canvas.toDataURL('image/png'));
    } else if (ctx) {
      // Empty frame? Keep it transparent
      resultBase64.push(canvas.toDataURL('image/png'));
    }
  });

  return resultBase64;
};

/**
 * Smart Slicing with Projection Profile + Auto-centering
 */
const performSmartSlicing = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, removeBg: boolean): string[] => {
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = 240;

    // 1. Scan Y (Rows)
    const rowSegments: {start: number, end: number}[] = [];
    let inRow = false;
    let startY = 0;

    const isRowEmpty = (y: number) => {
        for(let x=0; x<width; x++) {
            const i = (y*width + x)*4;
            if (data[i+3] > 20 && (data[i] < threshold || data[i+1] < threshold || data[i+2] < threshold)) return false;
        }
        return true;
    };

    for(let y=0; y<height; y++) {
        const empty = isRowEmpty(y);
        if (!inRow && !empty) {
            inRow = true;
            startY = y;
        } else if (inRow && (empty || y === height - 1)) {
            inRow = false;
            if (y - startY > 10) rowSegments.push({start: startY, end: y});
        }
    }

    // 2. Scan X (Cols)
    const colSegments: {start: number, end: number}[] = [];
    let inCol = false;
    let startX = 0;

    const isColEmpty = (x: number) => {
        for(let y=0; y<height; y++) {
            const i = (y*width + x)*4;
            if (data[i+3] > 20 && (data[i] < threshold || data[i+1] < threshold || data[i+2] < threshold)) return false;
        }
        return true;
    };

    for(let x=0; x<width; x++) {
        const empty = isColEmpty(x);
        if (!inCol && !empty) {
            inCol = true;
            startX = x;
        } else if (inCol && (empty || x === width - 1)) {
            inCol = false;
            if (x - startX > 10) colSegments.push({start: startX, end: x});
        }
    }

    if (rowSegments.length === 0 || colSegments.length === 0) return [];

    // 3. Extract Raw Cells
    const rawCanvases: HTMLCanvasElement[] = [];

    for(const r of rowSegments) {
        for(const c of colSegments) {
            const w = c.end - c.start;
            const h = r.end - r.start;
            
            const cellCanvas = document.createElement('canvas');
            cellCanvas.width = w;
            cellCanvas.height = h;
            const cellCtx = cellCanvas.getContext('2d');
            
            if (cellCtx) {
                cellCtx.drawImage(canvas, c.start, r.start, w, h, 0, 0, w, h);
                
                if (removeBg) {
                    const id = cellCtx.getImageData(0, 0, w, h);
                    const d = id.data;
                    for(let i=0; i<d.length; i+=4) {
                         if(d[i]>230 && d[i+1]>230 && d[i+2]>230) d[i+3] = 0;
                    }
                    cellCtx.putImageData(id, 0, 0);
                }
                rawCanvases.push(cellCanvas);
            }
        }
    }

    // 4. Align and Center
    return alignAndCenterFrames(rawCanvases);
};

/**
 * Fallback slicing: Divides by fixed rows/cols but performs auto-centering.
 */
const performFixedGridSlicing = (canvas: HTMLCanvasElement, rows: number, cols: number, removeBg: boolean): string[] => {
  // Use the whole canvas, don't trim outer whitespace aggressively first as it might shift the grid.
  // Actually, for fixed grid, we often need to trim outer margins if the AI put a border.
  // Let's stick to simple division then center content.
  
  const frameWidth = Math.floor(canvas.width / cols);
  const frameHeight = Math.floor(canvas.height / rows);
  const rawCanvases: HTMLCanvasElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = frameWidth;
      cellCanvas.height = frameHeight;
      const ctx = cellCanvas.getContext('2d');

      if (ctx) {
          ctx.drawImage(
            canvas,
            c * frameWidth,
            r * frameHeight,
            frameWidth,
            frameHeight,
            0,
            0,
            frameWidth,
            frameHeight
          );

          if (removeBg) {
             const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
             const data = imageData.data;
             const threshold = 230; 
             for (let i = 0; i < data.length; i += 4) {
                if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
                   data[i + 3] = 0;
                }
             }
             ctx.putImageData(imageData, 0, 0);
          }
          rawCanvases.push(cellCanvas);
      }
    }
  }
  
  return alignAndCenterFrames(rawCanvases);
};

/**
 * Main Slicing Function
 */
export const sliceSpriteSheet = (
  spriteSheetBase64: string,
  rows: number,
  cols: number,
  removeBg: boolean = false
): Promise<string[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) { resolve([]); return; }
      
      ctx.drawImage(img, 0, 0);

      // Try smart slicing first
      const smartFrames = performSmartSlicing(canvas, ctx, removeBg);
      
      // If smart slicing found roughly the expected number of frames (or at least enough to be valid)
      // We use it.
      if (smartFrames.length >= Math.floor((rows * cols) * 0.5)) {
          resolve(smartFrames);
          return;
      }

      // Fallback
      const fixedFrames = performFixedGridSlicing(canvas, rows, cols, removeBg);
      resolve(fixedFrames);
    };
    img.onerror = () => resolve([]);
    img.src = spriteSheetBase64;
  });
};

/**
 * Download frames as a ZIP file
 */
export const downloadZip = async (frames: string[], filename: string = 'animation') => {
  const zip = new JSZip();
  const folder = zip.folder("frames");
  
  frames.forEach((frame, index) => {
    const base64Data = frame.split(',')[1];
    folder?.file(`frame_${index + 1}.png`, base64Data, { base64: true });
  });

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `${filename}.zip`);
};

/**
 * Generate and download GIF
 */
export const downloadGif = async (frames: string[], fps: number, filename: string = 'animation') => {
  if (frames.length === 0) return;

  const firstImg = await loadImage(frames[0]);
  const width = firstImg.width;
  const height = firstImg.height;
  
  const gif = GIFEncoder();
  
  for (const frame of frames) {
    const img = await loadImage(frame);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, width, height).data;
    
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    
    const delay = 1000 / fps;
    
    gif.writeFrame(index, width, height, { 
      palette, 
      delay: delay,
      transparent: true, 
      dispose: -1 
    });
  }
  
  gif.finish();
  const blob = new Blob([gif.bytes()], { type: 'image/gif' });
  saveAs(blob, `${filename}.gif`);
};

/**
 * Generate and download APNG (Best Quality)
 */
export const downloadApng = async (frames: string[], fps: number, filename: string = 'animation') => {
   if (frames.length === 0) return;

   const buffers: ArrayBuffer[] = [];
   let width = 0;
   let height = 0;

   for (const frame of frames) {
     const img = await loadImage(frame);
     width = img.width;
     height = img.height;

     const canvas = document.createElement('canvas');
     canvas.width = width;
     canvas.height = height;
     const ctx = canvas.getContext('2d');
     if (!ctx) continue;

     ctx.drawImage(img, 0, 0);
     const buffer = ctx.getImageData(0, 0, width, height).data.buffer;
     buffers.push(buffer);
   }

   const delay = Math.round(1000 / fps);
   const delays = new Array(buffers.length).fill(delay);

   const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);
   const blob = new Blob([apngBuffer], { type: 'image/png' });
   saveAs(blob, `${filename}.png`);
};
