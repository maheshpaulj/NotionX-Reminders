# ---- Base Stage ----
# Use a specific Node.js version for consistency
FROM node:18-alpine AS base
WORKDIR /app
# Install dependencies first to leverage Docker cache
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production


# ---- Build Stage ----
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
# Install all dependencies including dev for building
RUN npm ci
COPY . .
# Compile TypeScript to JavaScript
RUN npm run build


# ---- Production Stage ----
FROM base AS production
WORKDIR /app
# Copy built code from the build stage
COPY --from=build /app/dist ./dist
# The CMD will run the compiled JavaScript
CMD ["node", "dist/index.js"]