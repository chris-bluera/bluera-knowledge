import { describe, it, expect, vi, beforeEach } from 'vitest';
import { destroyServices, type ServiceContainer } from './index.js';
import type { PythonBridge } from '../crawl/bridge.js';

describe('destroyServices', () => {
  let mockPythonBridge: { stop: ReturnType<typeof vi.fn> };
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockPythonBridge = {
      stop: vi.fn().mockResolvedValue(undefined),
    };

    mockServices = {
      pythonBridge: mockPythonBridge as unknown as PythonBridge,
    } as unknown as ServiceContainer;
  });

  it('stops the python bridge', async () => {
    await destroyServices(mockServices);

    expect(mockPythonBridge.stop).toHaveBeenCalledTimes(1);
  });

  it('handles stop errors gracefully', async () => {
    mockPythonBridge.stop.mockRejectedValue(new Error('stop failed'));

    // destroyServices should propagate errors
    await expect(destroyServices(mockServices)).rejects.toThrow('stop failed');
  });

  it('is idempotent - multiple calls work correctly', async () => {
    await destroyServices(mockServices);
    await destroyServices(mockServices);

    expect(mockPythonBridge.stop).toHaveBeenCalledTimes(2);
  });
});
