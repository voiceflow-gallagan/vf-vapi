// import { Request, Response } from 'express';
import { default as axios } from 'axios'

const conversationStates = new Map()

const getVoiceflowDomain = () => {
  const customDomain = process.env.VOICEFLOW_DOMAIN
  return customDomain
    ? `${customDomain}.general-runtime.voiceflow.com`
    : 'general-runtime.voiceflow.com'
}

const getTranscriptsDomain = () => {
  const customDomain = process.env.VOICEFLOW_DOMAIN
  return customDomain
    ? `api.${customDomain}.voiceflow.com`
    : 'api.voiceflow.com'
}

async function deleteUserState(user) {
  const request = {
    method: 'DELETE',
    url: `https://${getVoiceflowDomain()}/state/user/${encodeURI(user)}`,
    headers: {
      Authorization: process.env.VOICEFLOW_API_KEY,
      versionID: process.env.VOICEFLOW_VERSION_ID,
    },
  }
  const response = await axios(request)
  return response
}

async function saveTranscript(user) {
  axios({
    method: 'put',
    url: `https://${getTranscriptsDomain()}/v2/transcripts`,
    data: {
      browser: 'VAPI',
      device: 'Phone',
      os: 'VAPI',
      sessionID: user,
      unread: true,
      versionID: process.env.VOICEFLOW_VERSION_ID,
      projectID: process.env.VOICEFLOW_PROJECT_ID,
      user: {
        name: user,
        image:
          'https://s3.amazonaws.com/com.voiceflow.studio/share/3818df985d5f502f5dc4a6816903ce174528467f/3818df985d5f502f5dc4a6816903ce174528467f.png',
      },
    },
    headers: {
      Authorization: process.env.VOICEFLOW_API_KEY,
    },
  }).catch((err) => console.log(err))
}

export const api = async (req, res) => {
  try {
    const {
      // model,
      messages,
      //max_tokens,
      //temperature,
      call,
      tools,
      //stream,
      //...restParams
    } = req.body

    const lastMessage = messages?.[messages.length - 1]

    let userId = call?.customer?.number || call.id
    const isNewConversation = !conversationStates.has(call.id)
    conversationStates.set(call.id, true)

    const baseRequest = {
      method: 'POST',
      url: `https://${getVoiceflowDomain()}/state/user/${encodeURI(
        userId
      )}/interact`,
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
        sessionID: userId,
        versionID: process.env.VOICEFLOW_VERSION_ID,
      },
      data: {
        config: { tts: false, stripSSML: true, stopTypes: ['DTMF'] },
      },
    }

    let response
    let shouldEndCall = false

    if (isNewConversation) {
      await deleteUserState(userId)
      response = await axios({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          action: { type: 'launch' },
        },
      })
    } else {
      response = await axios({
        ...baseRequest,
        data: {
          ...baseRequest.data,
          action: {
            type: 'text',
            payload: lastMessage.content,
          },
        },
      })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let lastReply = null
    const chatId = `chatcmpl-${Math.floor(Date.now() / 1000)}`
    for (const trace of response.data) {
      switch (trace.type) {
        case 'text':
        case 'speak': {
          if (trace.payload?.message) {
            lastReply = trace.payload.message
            const chunk = {
              id: chatId,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'dmapi',
              choices: [
                {
                  index: 0,
                  delta: { content: trace.payload.message },
                  finish_reason: null,
                },
              ],
            }
            res.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }
          break
        }
        case 'end': {
          shouldEndCall = true
          break
        }
        default: {
          // console.log('Unknown trace type', trace)
        }
      }
    }
    // If there's no 'end' trace, send a final chunk and end the response
    if (shouldEndCall) {
      const endCallChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'dmapi',
        choices: [
          {
            index: 0,
            delta: {
              content: null,
              function_call: null,
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'call_RzSY2TxsyOKxuG27tyTshgq2',
                  function: {
                    arguments: '',
                    name: 'endCall',
                  },
                  type: 'function',
                },
              ],
            },
            finish_reason: null,
            logprobs: null,
          },
        ],
        service_tier: null,
        system_fingerprint: 'fp_661538dc1f',
        usage: null,
      }
      res.write(`data: ${JSON.stringify(endCallChunk)}\n\n`)

      const emptyChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'dmapi',
        choices: [
          {
            index: 0,
            delta: {
              content: null,
              function_call: null,
              role: null,
              tool_calls: [
                {
                  index: 0,
                  id: null,
                  function: {
                    arguments: '{}',
                    name: null,
                  },
                  type: null,
                },
              ],
            },
            finish_reason: null,
            logprobs: null,
          },
        ],
        service_tier: null,
        system_fingerprint: 'fp_661538dc1f',
        usage: null,
      }
      res.write(`data: ${JSON.stringify(emptyChunk)}\n\n`)

      const closingChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'dmapi',
        choices: [
          {
            index: 0,
            delta: {
              content: null,
              function_call: null,
              role: null,
              tool_calls: null,
            },
            finish_reason: 'tool_calls',
            logprobs: null,
          },
        ],
        service_tier: null,
        system_fingerprint: 'fp_661538dc1f',
        usage: null,
      }
      res.write(`data: ${JSON.stringify(closingChunk)}\n\n`)
      res.write(`data: [DONE]\n\n`)
    } else {
      // If there's no 'end' trace, send a final chunk and end the response
      const finalChunk = {
        id: chatId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'dmapi',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      }
      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`)
    }
    res.end()
    saveTranscript(userId)
  } catch (e) {
    console.log(e)
    res.status(500).json({ error: e })
  }
}
