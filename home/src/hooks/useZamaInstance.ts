import { useCallback } from 'react';

// Provides a factory for the Zama Relayer SDK instance loaded via UMD script
export function useZamaInstance() {
  return useCallback(() => {
    const w: any = window as any;
    const Ctor = w?.FhevmInstance || w?.RelayerSDK?.FhevmInstance || w?.relayerSdk?.FhevmInstance;
    if (!Ctor) throw new Error('Relayer SDK not loaded');
    return new Ctor();
  }, []);
}

