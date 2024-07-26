import readline from 'readline'
import { startServer } from './index.js'
import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function promptUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim())
    })
  })
}

async function createAssistant() {
  const name = await promptUser('Enter assistant name: ')
  const endpoint = await promptUser('Enter endpoint: ')
  const apiKey = await promptUser('Enter VAPI API key: ')

  try {
    // Read the assistant.json file
    const assistantConfigPath = path.join(__dirname, '..', 'assistant.json')
    const assistantConfig = JSON.parse(
      await fs.readFile(assistantConfigPath, 'utf8')
    )

    // Merge the user input with the assistant config
    const payload = {
      ...assistantConfig,
      name,
      model: {
        ...assistantConfig.model,
        provider: 'custom-llm',
        url: `${endpoint}/api`,
      },
    }

    const response = await axios.post(
      'https://api.vapi.ai/assistant',
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log(`Assistant ${response.data.name} created successfully`)

    // Ask if the user wants to start the server
    const startServerChoice = await promptUser(
      'Do you want to start the server now? (y/n): '
    )
    if (
      startServerChoice.toLowerCase() === 'y' ||
      startServerChoice.toLowerCase() === 'yes'
    ) {
      startServer()
    } else {
      rl.close()
    }
  } catch (error) {
    console.error(
      'Error creating assistant:',
      error.response?.data || error.message
    )
  }
}

async function main() {
  console.log('Welcome to the VF | VAPI Custom LLM Endpoint')
  console.log('1. Launch server')
  console.log('2. Create an assistant')

  const choice = await promptUser('Enter your choice (1 or 2): ')

  switch (choice) {
    case '1':
      startServer()
      break
    case '2':
      await createAssistant()
      rl.close()
      break
    default:
      console.log('Invalid choice. Exiting.')
      rl.close()
  }
}

main()
