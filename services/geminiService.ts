import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

/**
 * Helper to extract MIME type and base64 data from a data URL.
 */
const extractBase64Data = (base64String: string): { mimeType: string; data: string } => {
  // Regex to capture mime type and data
  const matches = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      data: matches[2]
    };
  }
  
  // Fallback for strings that might just be the base64 data or simple split
  const split = base64String.split(',');
  return {
    mimeType: 'image/png', // Default fallback
    data: split.length > 1 ? split[1] : split[0]
  };
};

/**
 * Determines the best aspect ratio for the requested grid layout.
 * 
 * 2x2 -> 1:1 (Square)
 * 2x3 -> 16:9 (Wide) - 4:3 is okay too, but 16:9 gives more width for separation
 * 2x4 -> 16:9 (Wide)
 * 3x3 -> 1:1 (Square)
 */
const getBestAspectRatio = (rows: number, cols: number): string => {
    const ratio = cols / rows;

    if (ratio >= 1.8) return "16:9"; // e.g. 2x4 = 2.0
    if (ratio >= 1.3) return "4:3";  // e.g. 2x3 = 1.5 (16:9 is also fine here, but 4:3 works)
    if (ratio <= 0.7) return "3:4";
    if (ratio <= 0.5) return "9:16";
    
    return "1:1"; // Default for 2x2, 3x3
};

/**
 * Generate a sprite sheet using the original image and the action prompt.
 */
export const generateSpriteSheet = async (
  originalBase64: string, 
  action: string,
  rows: number = 2,
  cols: number = 3
): Promise<string> => {
  if (!apiKey) throw new Error("API Key not found");

  const { mimeType, data } = extractBase64Data(originalBase64);
  const totalFrames = rows * cols;
  const aspectRatio = getBestAspectRatio(rows, cols);

  // Updated Prompt: focused on Spacing and Aspect Ratio awareness
  const prompt = `
    Generate a clean 2D Sprite Sheet.
    
    INPUT ACTION: ${action}
    
    LAYOUT CONFIGURATION:
    - GRID: ${rows} rows by ${cols} columns.
    - TOTAL SPRITES: ${totalFrames}
    - STYLE: Flat illustration, white background.
    
    CRITICAL RULES:
    1. **STRICT GRID**: You MUST draw exactly ${rows} rows and ${cols} columns.
    2. **NO NUMBERS**: Do NOT include any numbers, text, arrows, or guide lines.
    3. **ISOLATION**: Draw each character SMALLER than the grid cell. Leave clear white space around every character.
    4. **NO OVERLAP**: Characters must NOT touch the imaginary grid lines.
    5. **CONSISTENCY**: Keep the character size and proportions identical in every frame.
    
    Output ONLY the image on a solid white background.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
             inlineData: {
                 mimeType: mimeType,
                 data: data
             }
          },
          {
            text: prompt,
          }
        ],
      },
      config: {
        temperature: 0.2, 
        imageConfig: {
          aspectRatio: aspectRatio 
        }
      }
    });

    // Extract the image from the response
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart && textPart.text) {
        console.warn("Model returned text instead of image:", textPart.text);
        throw new Error("生成失败：模型拒绝了请求 (可能是安全策略)");
    }
    
    throw new Error("生成失败：未返回图像数据");
  } catch (error: any) {
    console.error("Generation failed", error);
    throw new Error(error.message || "生成失败，请重试");
  }
};