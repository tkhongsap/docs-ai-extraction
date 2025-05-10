/**
 * Route Helper Utilities
 * 
 * This module provides common functions used across route handlers
 * to reduce code duplication and standardize API behavior.
 */

import { Request, Response } from "express";

/**
 * Generates pagination metadata for lists
 * 
 * @param totalItems - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination metadata object
 */
export function getPaginationMetadata(totalItems: number, page: number, limit: number) {
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Formats a response with pagination metadata
 * 
 * @param data - Array of items to return
 * @param totalItems - Total number of items (before pagination)
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Formatted paginated response
 */
export function paginatedResponse<T>(data: T[], totalItems: number, page: number, limit: number) {
  return {
    data,
    pagination: getPaginationMetadata(totalItems, page, limit),
  };
}

/**
 * Extracts pagination parameters from request query
 * 
 * @param req - Express request object
 * @returns Object with page and limit values
 */
export function getPaginationParams(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.max(1, Math.min(
    100, // Maximum allowed limit
    parseInt(req.query.limit as string || '10', 10)
  ));
  
  return { page, limit };
}

/**
 * Sets common export headers for document downloads
 * 
 * @param res - Express response object
 * @param filename - Name of the file being downloaded
 * @param contentType - MIME type of the content
 */
export function setExportHeaders(res: Response, filename: string, contentType: string) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

/**
 * Calculates offset for pagination in database queries
 * 
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Offset value
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Creates a response for a successful data creation/update
 * 
 * @param data - The created or updated data
 * @param statusCode - HTTP status code (default 201 for creation)
 * @returns Formatted response object
 */
export function successResponse<T>(data: T, statusCode = 201) {
  return {
    success: true,
    statusCode,
    data
  };
}

/**
 * Formats a list of errors for validation failures
 * 
 * @param errors - List of error messages or objects
 * @returns Formatted error response
 */
export function validationErrorsList(errors: Array<string | { field: string, message: string }>) {
  return {
    success: false,
    statusCode: 400,
    errors: Array.isArray(errors) ? errors : [errors]
  };
}

/**
 * Common route to handle empty route (405 Method Not Allowed)
 * 
 * @param req - Express request object
 * @param res - Express response object
 */
export function methodNotAllowed(_req: Request, res: Response) {
  res.status(405).json({
    message: 'Method not allowed',
    error_code: 'METHOD_NOT_ALLOWED',
    allowed_methods: res.get('Allow')
  });
} 