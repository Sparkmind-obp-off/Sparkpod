import { describe, expect, it } from 'vitest'
import { normalizeDaytonaError } from '../src/providers/daytona'

describe('Daytona error normalization', () => {
  it.each([
    [400, 'validation', false], [422, 'validation', false], [401, 'authentication', false], [403, 'authorization', false],
    [404, 'not_found', false], [429, 'rate_limit', true], [500, 'provider', true], [503, 'provider', true],
  ] as const)('classifies HTTP %i as %s', (statusCode, category, retryable) => {
    const result = normalizeDaytonaError({ statusCode, code: `HTTP_${statusCode}`, message: 'provider detail secret-value' }, 'created', 'corr')
    expect(result).toMatchObject({ category, retryable, providerStatus: statusCode, providerCode: `HTTP_${statusCode}`, correlationId: 'corr' })
    expect(result.safeMessage).not.toContain('secret-value')
  })

  it('distinguishes timeout from network errors', () => {
    expect(normalizeDaytonaError(new Error('request timeout'), 'executing', 'c').category).toBe('timeout')
    expect(normalizeDaytonaError(new Error('network connection reset'), 'created', 'c').category).toBe('network')
  })

  it('classifies malformed/unknown provider failures safely', () => {
    const result = normalizeDaytonaError('not-json', 'created', 'c')
    expect(result.category).toBe('provider')
    expect(result.safeMessage).not.toContain('not-json')
  })
})
