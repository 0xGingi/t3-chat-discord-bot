# T3.CHAT Discord Bot

A Discord bot that integrates with T3.CHAT AI models, allowing users to interact with various AI providers through Discord slash commands.

<table>
<tr>
<td>
<img src="https://github.com/user-attachments/assets/ccea426d-216e-42ca-9253-1aaf9d4e4cb8" width="400">
</td>
<td>
<img src="https://github.com/user-attachments/assets/76f55770-bfc4-4ac3-be6a-6fc6d568ab6d" width="400"><br>
<img src="https://github.com/user-attachments/assets/f2ea2fc6-eb87-4228-b974-a251e3ab2e38" width="400">
</td>
</tr>
</table>

## Features

- Supports all Models on T3.CHAT
- Supports GPT Imagegen
- List all Models with /model list
- Set a model with /model set
- List Models by Feature Flags with /model features
- Query with /ask
- Uses puppeteer as a headless browser
- Gemini 2.5 Flash With Search Enabled is set as default model


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
   
   # Permission Management (Optional)
   ALLOWED_USER_IDS=user1,user2,user3
   ALLOWED_ROLE_IDS=role1,role2,role3
   
   # Rate Limiting
   RATE_LIMIT_INTERVAL=daily
   RATE_LIMIT_REGULAR=100
   RATE_LIMIT_PREMIUM=10
   
   # DM Settings (Optional)
   DISABLE_DM_USAGE=false
   
   # Default Model (Optional)
   DEFAULT_MODEL=Gemini 2.5 Flash
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

## Configuration Options

### Permission Management

- `ALLOWED_USER_IDS`: Comma-separated list of Discord user IDs that can use the bot (leave empty to allow everyone)
- `ALLOWED_ROLE_IDS`: Comma-separated list of Discord role IDs that can use the bot (leave empty to allow everyone)

### Rate Limiting

- `RATE_LIMIT_INTERVAL`: Time period for rate limiting (`hourly`, `daily`, `weekly`, `monthly`)
- `RATE_LIMIT_REGULAR`: Number of requests allowed for Regular models per interval
- `RATE_LIMIT_PREMIUM`: Number of requests allowed for Premium models per interval

### DM Settings

- `DISABLE_DM_USAGE`: Set to `true` to prevent the bot from responding to commands in Direct Messages (default: `false`)

### Bot Settings

- `DEFAULT_MODEL`: Set the default AI model for new users (e.g., "Gemini 2.5 Flash", "GPT-4o")

**Note**: T3.CHAT provides 1500 Regular requests and 100 Premium requests per month. Adjust your limits accordingly.

## Data Persistence

The bot saves all user data to `data/bot-data.json`, including:
- User model preferences
- Rate limit usage tracking
- Session data

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

### `/usage` - Usage Statistics

- `/usage` - Check your current rate limit usage and remaining quota

### `/info` - Bot Information

- `/info` - Show bot configuration, model statistics, and storage information