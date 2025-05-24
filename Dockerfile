FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .
RUN bun run build
RUN bun run deploy

USER bun
EXPOSE 3000
CMD ["bun", "run", "start"] 