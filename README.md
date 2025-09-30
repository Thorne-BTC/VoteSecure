# VoteSecure — Privacy‑Preserving Company Voting (Zama FHEVM)

VoteSecure is an internal company voting system where only company members can vote and individual choices remain private. Votes are cast as encrypted increments using Zama’s FHEVM, and final tallies are decryptable by company members only after everyone has voted.

Key goals:
- Private voting with encrypted options (no early leakage)
- Membership‑gated participation per company
- Live progress indicator (how many voted vs. total)
- Automatic finalization and member‑scoped decryption of results


## Why VoteSecure

- Confidentiality by default: Choices are never revealed on‑chain; only encrypted tallies exist until finalization.
- Trust‑minimized: Encryption and access control are enforced by Zama FHEVM primitives and on‑chain logic.
- Fairness: Results cannot be read before all members have voted, preventing bias and strategic voting.
- Auditability: Company creation, joins, and poll lifecycle events are on‑chain and verifiable.
- Practical UX: Read operations use `viem`, writes use `ethers`; Zama Relayer SDK handles encryption and user‑decrypt.


## How It Works

1. Create company: Anyone can create a company with a name and an employee limit.
2. Join company: Any user may join an existing company until the limit is reached.
3. Create poll: Company members can start a poll with a title and multiple options.
4. Cast vote: A member encrypts the value 1 using Zama Relayer SDK and submits it to increment the chosen option’s encrypted counter on‑chain.
5. Track progress: The UI displays number of votes cast vs. total company members.
6. Finalize and decrypt: Once all members have voted, the contract grants decryption rights to all members. Each member can then decrypt the final counts client‑side via the Relayer SDK.


## Tech Stack

- Smart contracts: Solidity + Hardhat, Zama FHEVM (`@fhevm/solidity`, `@fhevm/hardhat-plugin`)
- Zama services: Relayer SDK (`@zama-fhe/relayer-sdk`), Sepolia FHEVM config
- Frontend: React + Vite + Wagmi + RainbowKit
- On‑chain IO: `ethers` for writes, `viem` for reads
- Package manager: npm

See also: `docs/zama_llm.md`, `docs/zama_doc_relayer.md`.


## Repository Structure

```
contracts/            # CompanyVoting.sol (core business logic)
deploy/               # Hardhat deploy scripts (hardhat-deploy)
deployments/          # Network deployments (ABI + addresses)
docs/                 # Zama integration references
home/                 # Frontend (React + Vite)
scripts/              # Utilities to sync ABI/address into frontend
tasks/                # Hardhat tasks for manual interaction
test/                 # Tests (FHEVM mock)
hardhat.config.ts     # Networks and plugins
package.json          # Contract workspace scripts
```


## Smart Contracts

- `contracts/CompanyVoting.sol`
  - Company lifecycle: create, join, list
  - Poll lifecycle: create poll, cast vote (encrypted), finalize
  - Encrypted tallies: `euint32[] counts`; each vote homomorphically adds encrypted 1
  - Finalization: when `totalVoted == memberCountSnapshot`, grant each member decrypt rights for each option
  - View functions avoid `msg.sender` and accept explicit addresses where needed
  - Discovery helpers: `getAllCompanies()` returns arrays of ids/names/limits/memberCounts

Events:
- `CompanyCreated(companyId, name, employeeLimit)`
- `JoinedCompany(companyId, account)`
- `PollCreated(companyId, pollId, title, options)`
- `Voted(companyId, pollId, voter, optionIndex)`
- `Finalized(companyId, pollId)`


## Frontend

- Location: `home/`
- Network: Sepolia
- Reads: `viem` public client to call contract `view` methods
- Writes: `ethers` signer via injected wallet
- Wallet UX: RainbowKit + Wagmi
- Zama: Relayer SDK to encrypt inputs and user‑decrypt final counts
- ABI sourcing: Copy the contract ABI from `deployments/sepolia/CompanyVoting.json` into `home/src/config/contracts.ts` (no JSON imports in the frontend)

Configuration to update after deployment:
- `home/src/config/contracts.ts`
  - `CONTRACT_ADDRESS` = deployed address
  - `CONTRACT_ABI` = ABI from `deployments/sepolia/CompanyVoting.json`
- `home/src/config/wagmi.ts`
  - `projectId` = WalletConnect Cloud project id


## Prerequisites

- Node.js 20+
- An EOA with Sepolia ETH for gas
- Infura (or similar) API key for Sepolia RPC
- PRIVATE_KEY or MNEMONIC for deployment


## Setup

Install dependencies (contract workspace):

```bash
npm install
```

Set environment variables (either via `.env` or `hardhat vars`):

```bash
npx hardhat vars set PRIVATE_KEY
npx hardhat vars set INFURA_API_KEY
# Optional: used for `hardhat verify`
npx hardhat vars set ETHERSCAN_API_KEY
```


## Build and Test

Compile contracts:

```bash
npm run compile
```

Run tests (FHEVM mock environment):

```bash
npm test
```

Notes:
- The included test (`test/CompanyVoting.ts`) runs against the FHEVM mock only.
- It demonstrates company creation, joining, poll creation, encrypted voting, finalization, and user decryption.


## Deploy to Sepolia

Deploy using `hardhat-deploy`:

```bash
npm run deploy:sepolia
```

This writes deployment artifacts to `deployments/sepolia/CompanyVoting.json` (address + ABI).

Optionally verify:

```bash
npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
```


## Sync ABI and Address to Frontend

Per project rules the frontend must use the on‑chain ABI generated by the contract. After deploying to Sepolia:

1) Copy `address` and `abi` from `deployments/sepolia/CompanyVoting.json` into `home/src/config/contracts.ts`.

Or use the helper script:

```bash
node scripts/update-frontend-abi.js
```

Confirm in `home/src/config/contracts.ts`:
- `CONTRACT_ADDRESS` matches Sepolia deployment
- `CONTRACT_ABI` is the ABI from the deployment JSON


## Run the Frontend

The frontend is configured for Sepolia only (no localhost usage).

```bash
cd home
npm install
npm run dev
```

Then connect a wallet (RainbowKit). Update `home/src/config/wagmi.ts` with your WalletConnect `projectId`.


## Hardhat Tasks (optional helpers)

Examples:

```bash
# Print deployed address
npx hardhat vote:address --network sepolia

# Create a company
npx hardhat vote:create-company --name "Acme" --limit 5 --network sepolia

# Join a company (by id)
npx hardhat vote:join --company 1 --network sepolia

# Create a poll
npx hardhat vote:create-poll --company 1 --title "Lunch" --options Pizza Sushi --network sepolia
```


## Security and Privacy Model

- Encrypted state: Option counts are stored as `euint32` values; increments are performed homomorphically on‑chain.
- Input validation: Votes accept `externalEuint32` + input proof; conversion uses `FHE.fromExternal`.
- Access control: Only company members can vote; during finalization the contract grants decryption rights to all members for each option.
- Views without `msg.sender`: All `view` methods avoid implicit `msg.sender` dependency and take explicit parameters when needed.


## Problems Solved

- Private internal decision‑making without off‑chain secrecy holes
- Preventing early result leakage and strategic voting
- On‑chain audit trail of company membership and polls
- Clear separation of read/write paths for performance and compatibility


## Roadmap

- Deadlines and quorum rules for polls (timeout finalization)
- Role management (company owners, moderators; membership revoke/leave)
- Richer poll types (multiple selection, ranked choice)
- Pagination and search for companies/polls
- Multi‑chain support and additional networks
- Gas and performance optimizations for FHE operations
- CI for auto‑syncing ABI to the frontend on deploy


## Known Constraints

- Finalization currently requires all members to vote; consider timeouts/quorum in future iterations.
- Relies on Zama Relayer/Gateway availability for encryption and user decryption flows.


## License

BSD-3-Clause-Clear. See `LICENSE`.


## Acknowledgements

- Zama FHEVM, Relayer SDK, and ecosystem tooling that make confidential smart contracts practical on Ethereum testnets.
