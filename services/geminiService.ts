
import { GoogleGenAI, Chat } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

class GeminiService {
  private ai: GoogleGenAI;
  private chat: Chat | null = null;

  constructor() {
    // Initializing the SDK with the mandatory environment variable
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public initChat(customInstruction?: string) {
    this.chat = this.ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: customInstruction || SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
  }

  public async sendMessage(message: string): Promise<string> {
    if (!this.chat) {
      this.initChat();
    }
    
    try {
      const result = await this.chat!.sendMessage({ message });
      // The generated text is accessed via the .text property
      return result.text || "I'm holding space for you, but I couldn't find the words just now. Could you please try sharing that again?";
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "I apologize, my connection to the wisdom field was briefly interrupted. Let's take a deep breath and try that again.";
    }
  }
}

export const geminiService = new GeminiService();
