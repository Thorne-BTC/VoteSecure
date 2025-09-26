import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'VoteSecure',
  projectId: 'your-walletconnect-project-id', // Get this from WalletConnect Cloud
  chains: [sepolia],
  ssr: false, // If your dApp uses server side rendering (SSR)
});

// Contract address (will be filled after deployment)
export const VOTE_SECURE_ADDRESS = '0x'; // Replace with actual deployed address