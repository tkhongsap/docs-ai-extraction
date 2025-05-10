/**
 * Validation Utilities
 * 
 * This module provides functions for validating data across the application.
 */

import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
  }
}

/**
 * Validate data with a Zod schema and return a standardized result
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with parsed data or error information
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  try {
    const validData = schema.parse(data);
    return { 
      success: true, 
      data: validData 
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return {
        success: false,
        error: {
          message: validationError.message,
          details: validationError.details
        }
      };
    }
    
    // For non-Zod errors (shouldn't happen in normal usage)
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown validation error'
      }
    };
  }
}

/**
 * Validates that a string represents a positive integer
 * 
 * @param value - The string value to check
 * @param paramName - Parameter name for error messages
 * @returns The parsed number or throws an error
 */
export function validatePositiveInteger(value: string, paramName = "Parameter"): number {
  const num = parseInt(value, 10);
  
  if (isNaN(num)) {
    throw new Error(`${paramName} must be a valid number`);
  }
  
  if (num <= 0) {
    throw new Error(`${paramName} must be a positive number`);
  }
  
  return num;
}

/**
 * Validates that a value is one of the allowed options
 * 
 * @param value - The value to check
 * @param allowedValues - Array of allowed values
 * @param paramName - Parameter name for error messages
 * @returns The value if valid or throws an error
 */
export function validateEnum<T extends string>(
  value: string, 
  allowedValues: readonly T[], 
  paramName = "Parameter"
): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `${paramName} must be one of: ${allowedValues.join(', ')}`
    );
  }
  
  return value as T;
}

/**
 * Common file type validation
 * 
 * @param mimetype - MIME type to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns Boolean indicating if the file type is allowed
 */
export function isAllowedFileType(
  mimetype: string, 
  allowedTypes = [
    "application/pdf", 
    "image/jpeg", 
    "image/png", 
    "image/tiff", 
    "image/gif",
    "image/webp"
  ]
): boolean {
  return allowedTypes.includes(mimetype);
}

/**
 * Common schemas used throughout the application
 */
export const commonSchemas = {
  /**
   * Schema for document ID parameters
   */
  documentId: z.object({
    id: z.string().refine(
      (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      { message: "Document ID must be a positive integer" }
    )
  }),
  
  /**
   * Schema for pagination parameters
   */
  pagination: z.object({
    page: z.string().optional().refine(
      (val) => !val || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0),
      { message: "Page must be a positive integer" }
    ).transform(val => val ? parseInt(val, 10) : 1),
    
    limit: z.string().optional().refine(
      (val) => !val || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0),
      { message: "Limit must be a positive integer" }
    ).transform(val => val ? parseInt(val, 10) : 10)
  })
}; 