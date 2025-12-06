import { describe, it, expect } from 'vitest';
import { toUserFriendlyError, ErrorType, AppError } from '../errorHandling';

describe('toUserFriendlyError', () => {
  it('converts network fetch errors to user-friendly format', () => {
    const fetchError = new TypeError('Failed to fetch');
    
    const result = toUserFriendlyError(fetchError);
    
    expect(result.type).toBe(ErrorType.NETWORK);
    expect(result.title).toBe('Connection Lost');
    expect(result.message).toBe('Please check your internet connection and try again');
    expect(result.duration).toBe(0);
  });

  it('converts AppError to user-friendly format with correct type', () => {
    const appError = new AppError(
      ErrorType.VALIDATION,
      'Email format is invalid'
    );
    
    const result = toUserFriendlyError(appError);
    
    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.title).toBe('Invalid Input');
    expect(result.message).toBe('Email format is invalid');
  });

  it('converts HTTP 429 rate limit errors with 30 second duration', () => {
    const rateLimitError = { status: 429, message: 'Too many requests' };
    
    const result = toUserFriendlyError(rateLimitError);
    
    expect(result.type).toBe(ErrorType.RATE_LIMIT);
    expect(result.title).toBe('Too Many Requests');
    expect(result.message).toBe('Please wait 30 seconds before trying again');
    expect(result.duration).toBe(30000);
  });

  it('converts HTTP 401 authentication errors', () => {
    const authError = { status: 401, message: 'Unauthorized' };
    
    const result = toUserFriendlyError(authError);
    
    expect(result.type).toBe(ErrorType.AUTH);
    expect(result.title).toBe('Authentication Error');
    expect(result.message).toBe('Please sign in again to continue');
  });

  it('converts HTTP 500 server errors with retry action', () => {
    const serverError = { status: 500, message: 'Internal server error' };
    const retryFn = () => console.log('retry');
    
    const result = toUserFriendlyError(serverError, undefined, retryFn);
    
    expect(result.type).toBe(ErrorType.DATABASE);
    expect(result.title).toBe('Server Error');
    expect(result.message).toBe('Our servers are experiencing issues. Please try again in a moment');
    expect(result.action).toBeDefined();
    expect(result.action?.label).toBe('Retry');
  });

  it('handles generic errors with fallback message', () => {
    const genericError = new Error('Something unexpected happened');
    
    const result = toUserFriendlyError(genericError, 'Data Loading');
    
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.title).toBe('Data Loading Failed');
    expect(result.message).toBe('Something unexpected happened');
  });

  it('handles unknown error types with string conversion', () => {
    const unknownError = 'String error message';
    
    const result = toUserFriendlyError(unknownError);
    
    expect(result.type).toBe(ErrorType.UNKNOWN);
    expect(result.message).toBe('String error message');
  });
});
