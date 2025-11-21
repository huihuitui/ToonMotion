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
 * Step 1: Analyze the uploaded character to get a robust text description.
 * We explicitly ask for English output to feed into the image generation model.
 */
export const analyzeCharacterImage = async (base64Image: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key not found");

  const { mimeType, data } = extractBase64Data(base64Image);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: mimeType, 
                    data: data
                }
            },
            {
                text: "Analyze this character image. Describe the visual style (e.g., pixel art, flat vector, anime), the colors (be specific), clothing, facial features, and body proportions. Ignore the background. Output a concise description in English."
            }
        ]
      }
    });
    
    return response.text || "A cute character.";
  } catch (error) {
    console.error("Analysis failed", error);
    throw new Error("Failed to analyze character.");
  }
};

/**
 * Step 2: Generate a sprite sheet using the original image and the action prompt.
 */
export const generateSpriteSheet = async (
  originalBase64: string, 
  description: string, 
  action: string,
  rows: number = 2,
  cols: number = 2,
  zoomLevel: number = 80
): Promise<string> => {
  if (!apiKey) throw new Error("API Key not found");

  const { mimeType, data } = extractBase64Data(originalBase64);
  const totalFrames = rows * cols;
  
  // The prompt is engineered for the 'banana' model (gemini-2.5-flash-image)
  // asking for a clean grid suitable for slicing.
  const prompt = `
    Generate an image of a sprite sheet containing exactly ${totalFrames} frames arranged in a grid with ${rows} rows (vertical stacking) and ${cols} columns (horizontal alignment).
    
    Subject Description:
    ${description}
    
    Action Sequence: ${action}
    
    STRICT CONFIGURATION RULES:
    1. Grid Layout: ${rows} rows x ${cols} columns. 
    2. ONE CHARACTER ONLY: Draw exactly ONE character in each grid cell. Do not split the character across cells.
    3. SEPARATION: Ensure distinct white space between each character frame. Characters must NOT touch each other.
    4. NO GRID LINES: Do NOT draw lines between frames.
    5. Background: Pure white (#FFFFFF) background.
    6. Style: Maintain the exact art style of the reference image.
    7. Scale: The character should occupy approximately ${zoomLevel}% of the grid cell height. Center the character in each cell.
    
    Input Reference: Use the provided image as the character reference.
  `;

  try {
    // Using Image as the FIRST part of the content often improves adherence to the visual style
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
    });

    // Extract the image from the response
    // The model might return text if it refuses, so we check specifically for inlineData
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    // Check if the model returned text refusal (e.g. "I cannot generate...")
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart && textPart.text) {
        console.warn("Model returned text instead of image:", textPart.text);
        throw new Error("Model refused to generate image (Safety/Policy).");
    }
    
    throw new Error("No image generated in response.");
  } catch (error) {
    console.error("Generation failed", error);
    throw new Error("Failed to generate animation frames.");
  }
};
