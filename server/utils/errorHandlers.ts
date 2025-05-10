/**
 * Error Handling Utilities
 * 
 * This module provides standardized error handling functions that can be used
 * across all routes to ensure consistent error reporting and logging.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  message: string;
  error_code?: string;
  details?: any;
}

/**
 * Handles API errors with consistent logging and response formatting
 * 
 * @param res - Express response object
 * @param error - The error that occurred
 * @param defaultMessage - Default message to show if error has no message
 * @param statusCode - HTTP status code to return
 */
export function handleApiError(
  res: Response,
  error: any,
  defaultMessage = "An unexpected error occurred",
  statusCode = 500
): Response {
  // Determine if this is a known error type
  if (error instanceof z.ZodError) {
    const validationError = fromZodError(error);
    console.error("Validation error:", validationError.message);
    return res.status(400).json({
      message: "Validation error",
      error_code: "VALIDATION_ERROR",
      details: validationError.details
    });
  }

  // Handle multer errors
  if (error?.name === 'MulterError') {
    const errorCode = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR';
    console.error(`File upload error (${errorCode}):`, error.message);
    return res.status(400).json({
      message: error.message,
      error_code: errorCode
    });
  }

  // Generic error handling
  const errorMessage = error?.message || defaultMessage;
  console.error(`Error (${statusCode}):`, errorMessage);
  
  if (statusCode === 500) {
    // Log stack trace for server errors, but don't expose it to clients
    console.error("Stack trace:", error?.stack);
  }
  
  return res.status(statusCode).json({
    message: errorMessage,
    error_code: error?.code || getErrorCodeFromMessage(errorMessage)
  });
}

/**
 * Derive an error code from an error message
 */
function getErrorCodeFromMessage(message: string): string {
  if (!message) return 'UNKNOWN_ERROR';
  
  message = message.toLowerCase();
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return 'NOT_FOUND';
  }
  if (message.includes('permission') || message.includes('access') || message.includes('unauthorized')) {
    return 'ACCESS_DENIED';
  }
  if (message.includes('invalid') || message.includes('malformed')) {
    return 'INVALID_INPUT';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (message.includes('limit') || message.includes('quota') || message.includes('exceeded')) {
    return 'LIMIT_EXCEEDED';
  }
  if (message.includes('conflict') || message.includes('already exists')) {
    return 'CONFLICT';
  }
  
  return 'INTERNAL_ERROR';
}

/**
 * Handles async route functions and catches any errors
 * 
 * @param fn - Async route handler function
 * @returns Express route handler with error handling
 */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<any>
) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      handleApiError(res, error);
    }
  };
}

/**
 * Creates a standard 404 Not Found response
 */
export function notFoundResponse(res: Response, message = "Resource not found"): Response {
  return res.status(404).json({ message, error_code: "NOT_FOUND" });
}

/**
 * Creates a standard validation error response
 */
export function validationErrorResponse(res: Response, message: string, details?: any): Response {
  return res.status(400).json({
    message,
    error_code: "VALIDATION_ERROR",
    details
  });
} 