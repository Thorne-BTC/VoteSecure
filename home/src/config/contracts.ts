// CompanyVoting contract address (fill with deployments/sepolia address after deploy)
export const CONTRACT_ADDRESS = '0x9A6d3838eF8f55e5B0C192d512E554012e73507b';

// ABI copied from deployments/sepolia/CompanyVoting.json (do not import JSON in frontend)
export const CONTRACT_ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "companyId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "employeeLimit", "type": "uint256" }
    ], "name": "CompanyCreated", "type": "event" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "companyId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "account", "type": "address" }
    ], "name": "JoinedCompany", "type": "event" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "companyId", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "pollId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "title", "type": "string" },
      { "indexed": false, "internalType": "string[]", "name": "options", "type": "string[]" }
    ], "name": "PollCreated", "type": "event" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "companyId", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "pollId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "voter", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "optionIndex", "type": "uint256" }
    ], "name": "Voted", "type": "event" },
  { "anonymous": false, "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "companyId", "type": "uint256" },
      { "indexed": true, "internalType": "uint256", "name": "pollId", "type": "uint256" }
    ], "name": "Finalized", "type": "event" },
  { "inputs": [ { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint256", "name": "employeeLimit", "type": "uint256" } ], "name": "createCompany", "outputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" } ], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" } ], "name": "joinCompany", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "string", "name": "title", "type": "string" }, { "internalType": "string[]", "name": "options", "type": "string[]" } ], "name": "createPoll", "outputs": [ { "internalType": "uint256", "name": "pollId", "type": "uint256" } ], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "uint256", "name": "pollId", "type": "uint256" }, { "internalType": "uint256", "name": "optionIndex", "type": "uint256" }, { "internalType": "externalEuint32", "name": "oneEncrypted", "type": "bytes32" }, { "internalType": "bytes", "name": "inputProof", "type": "bytes" } ], "name": "vote", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "uint256", "name": "pollId", "type": "uint256" } ], "name": "finalize", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" } ], "name": "getCompany", "outputs": [ { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint256", "name": "employeeLimit", "type": "uint256" }, { "internalType": "uint256", "name": "memberCount", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" } ], "name": "getCompanyMembers", "outputs": [ { "internalType": "address[]", "name": "", "type": "address[]" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "uint256", "name": "pollId", "type": "uint256" } ], "name": "getPoll", "outputs": [ { "internalType": "string", "name": "title", "type": "string" }, { "internalType": "string[]", "name": "options", "type": "string[]" }, { "internalType": "uint256", "name": "totalVoted", "type": "uint256" }, { "internalType": "uint256", "name": "memberCountSnapshot", "type": "uint256" }, { "internalType": "bool", "name": "finalized", "type": "bool" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "uint256", "name": "pollId", "type": "uint256" }, { "internalType": "address", "name": "user", "type": "address" } ], "name": "hasUserVoted", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "address", "name": "account", "type": "address" } ], "name": "isCompanyMember", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [ { "internalType": "uint256", "name": "companyId", "type": "uint256" }, { "internalType": "uint256", "name": "pollId", "type": "uint256" } ], "name": "getEncryptedCounts", "outputs": [ { "internalType": "euint32[]", "name": "", "type": "bytes32[]" } ], "stateMutability": "view", "type": "function" }
] as const;
// Additional view for listing companies (copy from deployments ABI after deploy)
export const CONTRACT_ABI_EXTRAS = [
  { "inputs": [], "name": "nextCompanyId", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "getAllCompanies", "outputs": [ { "internalType": "uint256[]", "name": "ids", "type": "uint256[]" }, { "internalType": "string[]", "name": "names", "type": "string[]" }, { "internalType": "uint256[]", "name": "limits", "type": "uint256[]" }, { "internalType": "uint256[]", "name": "memberCounts", "type": "uint256[]" } ], "stateMutability": "view", "type": "function" }
] as const;
