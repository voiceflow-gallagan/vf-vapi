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
        action :{
          type: 'text',
          payload: lastMessage.content,
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

    let completeResponse = ''
    for (const trace of response.data) {
      switch (trace.type) {
        case 'text':
        case 'speak': {
          if (trace.payload?.src) {
            if (trace.payload.src.startsWith('data:')) {
              const base64Data = trace.payload.src.split(',')[1]
              const audioBuffer = Buffer.from(base64Data, 'base64')
              //this.emit('audio', audioBuffer)
            } else {
              //this.emit('audio', trace.payload.src)
            }
          } else {
            completeResponse += trace.payload.message + " "
            //partialResponse += trace.payload.message
            // agent.say(trace.payload.message)
          }
          break
        }
        case 'end': {
          /* saveTranscript(caller, true)
          twiml.hangup() */
          break
        }
        default: {
          console.log('Unknown trace type', trace)
        }
      }
    }

      /* const completion = await openai.chat.completions.create({
        model: model || 'gpt-4o',
        //...restParams,
        messages, //[{ role: 'user', content: lastMessage.content }],
        max_tokens: max_tokens || 150,
        temperature: temperature || 0.7,
        stream: false,
      }); */
      console.log(completeResponse);
      const completion = {
        id: "chatcmpl-8mcLf78g0quztp4BMtwd3hEj58Uof",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "tico",
        system_fingerprint: null,
        choices: [
          {
            index: 0,
            //delta: { content: messages?.[messages.length - 1]?.content ?? "" },
            //delta: { content: completeResponse },
            message: {
              content: completeResponse,
              role: "assistant"
            },
            logprobs: null,
            finish_reason: "stop",
          },
        ],
      };
      console.log('completion',completion);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      return res.status(200).json(completion);

  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e });
  }
};
