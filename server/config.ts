/**
 * Application Configuration
 * 
 * Provides centralized access to environment variables and configuration settings
 */

// Environment variables with defaults
export const config = {
  // API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  LLAMAPARSE_API_KEY: process.env.LLAMAPARSE_API_KEY || '',
  
  // Server configuration
  PORT: parseInt(process.env.PORT || '5001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Storage configuration
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '15728640', 10), // 15MB default
  
  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/document_extraction',
  
  // Feature flags
  ENABLE_AUTH: process.env.ENABLE_AUTH === 'true',
  ENABLE_WEBHOOKS: process.env.ENABLE_WEBHOOKS === 'true',
  ENABLE_BACKGROUND_PROCESSING: process.env.ENABLE_BACKGROUND_PROCESSING === 'true',
  
  // API limits and timeouts
  API_TIMEOUT_MS: parseInt(process.env.API_TIMEOUT_MS || '30000', 10), // 30 seconds default
  MAX_CONCURRENT_REQUESTS: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '20', 10),
}; 