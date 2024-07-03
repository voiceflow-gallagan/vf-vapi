//import { basic } from './basic';
import { streamDM } from './stream';
import { nostreamDM } from './nostream';
import { openaiSSE } from './openai-sse';

export const customLLMHandler = {
  streamDM: streamDM,
  nostreamDM: nostreamDM,
  openaiSSE: openaiSSE,
};
