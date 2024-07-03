//import { basic } from './basic';
import { streamDM } from './stream';
import { openaiSSE } from './openai-sse';

export const customLLMHandler = {
  //basic: basic,
  //openaiAdvanced: openaiAdvanced,
  streamDM: streamDM,
  openaiSSE: openaiSSE,
};
