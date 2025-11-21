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

  // Threshold for "content". 
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
        // Check if it's NOT white (background)
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
 * Processes a list of raw grid cells:
 * 1. Finds the specific character bounds inside each cell (removes inner whitespace).
 * 2. Determines the max character size across all frames.
 * 3. Creates new frames where the character is centered and maximized.
 */
const alignAndMaximizeFrames = (frames: HTMLCanvasElement[]): string[] => {
  // 1. Get bounds for all frames (Crop to character)
  const bounds = frames.map(frame => {
    const ctx = frame.getContext('2d');
    if (!ctx) return null;
    return getContentBounds(ctx, frame.width, frame.height);
  });

  // 2. Find max dimensions to ensure uniform frame size
  let maxContentW = 0;
  let maxContentH = 0;
  
  bounds.forEach(b => {
    if (b) {
      maxContentW = Math.max(maxContentW, b.w);
      maxContentH = Math.max(maxContentH, b.h);
    }
  });

  if (maxContentW === 0 || maxContentH === 0) return [];

  // Add very minimal padding (2px) just to avoid edge clipping
  const padding = 2;
  const finalW = maxContentW + padding * 2;
  const finalH = maxContentH + padding * 2;

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
 * Strict Fixed Grid Slicing.
 * 1. Finds the global content box of the entire sprite sheet (trims outer margins).
 * 2. Divides that box into strictly equal rows and columns.
 * 3. Extracts cells.
 * 4. Sends to alignAndMaximizeFrames for final polish.
 */
const performFixedGridSlicing = (canvas: HTMLCanvasElement, rows: number, cols: number, removeBg: boolean): string[] => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // 1. Trim the sprite sheet first to remove outer whitespace
  const globalBounds = getContentBounds(ctx, canvas.width, canvas.height);
  
  let sourceX = 0, sourceY = 0;
  let sourceW = canvas.width, sourceH = canvas.height;

  // If we found content, strictly use that area as the "Grid Area"
  if (globalBounds) {
      sourceX = globalBounds.x;
      sourceY = globalBounds.y;
      sourceW = globalBounds.w;
      sourceH = globalBounds.h;
  }

  // Calculate cell size based on the content area
  const frameWidth = sourceW / cols;
  const frameHeight = sourceH / rows;
  
  const rawCanvases: HTMLCanvasElement[] = [];

  // Safety Shave: How many pixels to clear from edges to avoid neighbor artifacts
  // We keep this small shave to prevent single-pixel bleeding, but rely on Prompt for main separation.
  const safetyShave = 4; 

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellCanvas = document.createElement('canvas');
      // Use ceil to avoid sub-pixel clipping issues
      cellCanvas.width = Math.ceil(frameWidth);
      cellCanvas.height = Math.ceil(frameHeight);
      const cellCtx = cellCanvas.getContext('2d');

      if (cellCtx) {
          cellCtx.drawImage(
            canvas,
            sourceX + c * frameWidth, // Precision float coordinate
            sourceY + r * frameHeight,
            frameWidth,
            frameHeight,
            0,
            0,
            cellCanvas.width,
            cellCanvas.height
          );

          // --- SAFETY CLEANING STEP ---
          // Shave edges to prevent "feet/head" overlap from neighbors if the AI draws slightly too big
          cellCtx.clearRect(0, 0, cellCanvas.width, safetyShave); // Top edge
          cellCtx.clearRect(0, cellCanvas.height - safetyShave, cellCanvas.width, safetyShave); // Bottom edge
          cellCtx.clearRect(0, 0, safetyShave, cellCanvas.height); // Left edge
          cellCtx.clearRect(cellCanvas.width - safetyShave, 0, safetyShave, cellCanvas.height); // Right edge

          // NOTE: We removed the specific corner clearing (50x40) for numbers as requested.
          // We now rely on the AI Prompt to strictly forbid numbers.

          if (removeBg) {
             const imageData = cellCtx.getImageData(0, 0, cellCanvas.width, cellCanvas.height);
             const data = imageData.data;
             const threshold = 230; 
             for (let i = 0; i < data.length; i += 4) {
                // Simple white removal
                if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
                   data[i + 3] = 0;
                }
             }
             cellCtx.putImageData(imageData, 0, 0);
          }
          rawCanvases.push(cellCanvas);
      }
    }
  }
  
  // Send raw grid cells to be cropped and centered
  return alignAndMaximizeFrames(rawCanvases);
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
    img.crossOrigin = "anonymous"; // Good practice
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) { resolve([]); return; }
      
      ctx.drawImage(img, 0, 0);

      // Force Fixed Grid Slicing. 
      // Smart slicing causes "two pics in one frame" errors when rows are close.
      // We trust the AI followed the grid prompt.
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
     const frameImg = await loadImage(frame);
     
     // Ensure all frames are the same size (they should be from alignAndMaximizeFrames)
     // But if not, handle it gracefully by creating a new canvas of max dimensions
     if (width === 0) {
         width = frameImg.width;
         height = frameImg.height;
     }

     const canvas = document.createElement('canvas');
     canvas.width = width;
     canvas.height = height;
     const ctx = canvas.getContext('2d');
     if (!ctx) continue;

     ctx.drawImage(frameImg, 0, 0, width, height);
     const buffer = ctx.getImageData(0, 0, width, height).data.buffer;
     buffers.push(buffer);
   }

   const delay = Math.round(1000 / fps);
   const delays = new Array(buffers.length).fill(delay);

   const apngBuffer = UPNG.encode(buffers, width, height, 0, delays);
   const blob = new Blob([apngBuffer], { type: 'image/png' });
   saveAs(blob, `${filename}.png`);
};