//import { basic } from './basic';
import { streamDM } from './stream';
import { nostreamDM } from './nostream';

export const customLLMHandler = {
  streamDM: streamDM,
  nostreamDM: nostreamDM
};
