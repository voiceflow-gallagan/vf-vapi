import { Request, Response } from 'express';
import OpenAI from 'openai';
import { envConfig } from '../../config/env.config';
import axios from 'axios';

const openai = new OpenAI({ apiKey: envConfig.openai.apiKey });

export const openaiSSE = async (req: Request, res: Response) => {
  try {
    const {
      model,
      messages,
      max_tokens,
      temperature,
      call,
      stream,
      ...restParams
    } = req.body;

    delete restParams.metadata;

    console.log(req.body);
    const lastMessage = messages?.[messages.length - 1];

    console.log(lastMessage.content);
    console.log(messages);
    console.log('stream', stream);

    let userId = call?.customer?.number || call.id

    const request = {
      method: 'POST',
      url: `${process.env.VOICEFLOW_API_URL}/state/user/${encodeURI(
        userId
      )}/interact`,
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
        //sessionID: session,
        versionID: process.env.VOICEFLOW_VERSION_ID,
      },
      data: {
        action: {
          type: "intent",
          payload: {
            intent: { name: "receive_message"},
            query: lastMessage.content
          }
        },
        state: {
          variables: {
            context: JSON.stringify(messages),
          },
        },
        config: { tts: false, stripSSML: true, stopTypes: ['DTMF'] },
      },
    }
    const response = await axios(request)
    console.log('response', response.data)

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let completeResponse = ''
    for (const trace of response.data) {
      switch (trace.type) {
        case 'text':
        case 'speak': {
          if (trace.payload?.message) {
            completeResponse += trace.payload.message + " ";
            // Send each part of the message as a separate SSE event
            const chunk = {
              id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: "gpt-4o",
              choices: [
                {
                  index: 0,
                  delta: { content: trace.payload.message + " " },
                  finish_reason: null,
                },
              ],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          break;
        }
        case 'end': {
          const finalChunk = {
            id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "gpt-3.5-turbo-0613",
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };
          res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
          res.end();
          return;
        }
        default: {
          console.log('Unknown trace type', trace)
        }
      }
    }
  // If there's no 'end' trace, send a final chunk and end the response
  const finalChunk = {
    id: `chatcmpl-${Math.floor(Date.now() / 1000)}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "gpt-3.5-turbo-0613",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  };
  res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
  res.end();

  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e });
  }
};
