import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../server/modules/errors';

describe('errors module', () => {
  it('should create ErrorCode instance with message and prototype set', () => {
    const error = new ErrorCode('Something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ErrorCode);
    expect(error.message).toBe('Something went wrong');
  });
});

