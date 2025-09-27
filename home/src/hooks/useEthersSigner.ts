import { useCallback } from 'react';
import { BrowserProvider, ethers } from 'ethers';

// Returns a function that resolves to the current ethers Signer
export function useEthersSigner() {
  return useCallback(async (): Promise<ethers.Signer> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('Wallet not found');
    }
    const provider = new BrowserProvider((window as any).ethereum);
    return provider.getSigner();
  }, []);
}

