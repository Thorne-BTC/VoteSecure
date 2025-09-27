const fs = require('fs');
const path = require('path');

function main() {
  const depPath = path.join(__dirname, '..', 'deployments', 'sepolia', 'CompanyVoting.json');
  if (!fs.existsSync(depPath)) {
    console.error('Deployment file not found:', depPath);
    process.exit(1);
  }
  const dep = JSON.parse(fs.readFileSync(depPath, 'utf8'));
  const address = dep.address;
  const abi = dep.abi;

  const outPath = path.join(__dirname, '..', 'home', 'src', 'config', 'contracts.ts');
  const ts = `// CompanyVoting contract address (copied from deployments/sepolia)
export const CONTRACT_ADDRESS = '${address}';

// ABI copied from deployments/sepolia/CompanyVoting.json
export const CONTRACT_ABI = ${JSON.stringify(abi, null, 2)} as const;
`;
  fs.writeFileSync(outPath, ts, 'utf8');
  console.log('Updated frontend contracts.ts with Sepolia address and ABI');
}

main();

