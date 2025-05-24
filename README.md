# T3.CHAT Discord Bot

A Discord bot that integrates with T3.CHAT AI models, allowing users to interact with various AI providers through Discord slash commands.

<img src="https://github.com/user-attachments/assets/ccea426d-216e-42ca-9253-1aaf9d4e4cb8" width="400">
<img src="https://github.com/user-attachments/assets/76f55770-bfc4-4ac3-be6a-6fc6d568ab6d" width="400">


## Features

- Supports all Models on T3.CHAT
- Supports GPT Imagegen
- List all Models with /model list
- Set a model with /model set
- List Models by Feature Flags with /model features
- Query with /ask
- Uses puppeteer as a headless browser
- Gemini 2.5 Flash With Search Enabled is set as default model 

## TO-DO

- Continue Thread/Make New Thread Option

## Setup Instructions

### Prerequisites

1. **Discord Application**: Create a Discord application and bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. **T3.CHAT Access Token**: Get your access_token from T3.CHAT browser localStorage
3. **Bun** or **Docker**

### Getting T3.CHAT Access Token

1. Log in to [T3.CHAT](https://beta.t3.chat) or [T3.CHAT](https://t3.chat) with your Google account
2. Open browser developer tools (F12)
3. Go to Application/Storage tab → Local Storage
4. Find and copy the `access_token` value

### Installation (Bun)

1. **Clone and setup**:
   ```bash
   git clone https://github.com/0xgingi/t3-chat-discord-bot
   cd t3-chat-discord-bot
   bun install
   ```

2. **Environment Configuration**:
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your values:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   DISCORD_CLIENT_ID=your_discord_client_id_here
   T3_ACCESS_TOKEN=your_t3_chat_access_token_here
   USE_BETA_DOMAIN=true
   ```

3. **Deploy Discord Commands**:
   ```bash
   bun run deploy
   ```

4. **Run the Bot**:
   ```bash
   bun run build
   bun run start
   ```

### Docker Deployment

 **Build and run with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```
## Bot Commands

### `/model` - Model Management

- `/model set <name>` - Set a specific AI model
- `/model list [provider]` - List all models or filter by provider
- `/model current` - Show your current model
- `/model features <feature>` - List models with specific features

### `/ask` - Ask AI Questions

- `/ask <question>` - Ask a question to your current AI model (auto-enables search for compatible models)
- `/ask <question> search:true` - Explicitly enable web search
- `/ask <question> search:false` - Explicitly disable web search
- `/ask <question> ephemeral:true` - Make response visible only to you
