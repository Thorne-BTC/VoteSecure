import { useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import { Button, FormInput, FormTextarea, StatusMessage, LoadingSpinner } from './ui';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { Contract, ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ABI_EXTRAS, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/VoteApp.css';

type PollInfo = {
  title: string;
  options: string[];
  totalVoted: bigint;
  memberCount: bigint;
  finalized: boolean;
};

export function VoteApp() {
  const { address } = useAccount();
  const [companyId, setCompanyId] = useState<number>(1);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyLimit, setNewCompanyLimit] = useState<number>(0);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState<string>('');
  const [pollId, setPollId] = useState<number>(0);
  const [pollInfo, setPollInfo] = useState<PollInfo | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [results, setResults] = useState<number[] | null>(null);

  const client = useMemo(() => createPublicClient({ chain: sepolia, transport: http() }), []);
  const ABI = useMemo(() => (
    (CONTRACT_ABI as unknown as any[]).concat(CONTRACT_ABI_EXTRAS as unknown as any[])
  ), []);
  const [companies, setCompanies] = useState<Array<{id: bigint; name: string; limit: bigint; members: bigint}>>([]);
  const getSigner = useEthersSigner();
  const { instance: zama, isLoading: zamaLoading } = useZamaInstance();

  useEffect(() => {
    // Load selected poll info when company/poll changes
    setResults(null);
    (async () => {
      try {
        const [title, options, totalVoted, memberCountSnapshot, finalized] = (await client.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: ABI as any,
          functionName: 'getPoll',
          args: [BigInt(companyId), BigInt(pollId)],
        })) as unknown as [string, string[], bigint, bigint, boolean];
        setPollInfo({ title, options, totalVoted, memberCount: memberCountSnapshot, finalized });
      } catch (e) {
        setPollInfo(null);
      }
    })();
  }, [client, ABI, companyId, pollId]);

  async function refreshCompanies() {
    try {
      // Preferred: call view getAllCompanies
      const [ids, names, limits, memberCounts] = (await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI as any,
        functionName: 'getAllCompanies',
        args: [],
      })) as unknown as [bigint[], string[], bigint[], bigint[]];
      const list = ids.map((id, i) => ({ id, name: names[i], limit: limits[i], members: memberCounts[i] }));
      setCompanies(list);
      if (list.length && !companies.find(c => c.id === BigInt(companyId))) {
        setCompanyId(Number(list[0].id));
      }
    } catch (e) {
      // Fallback: enumerate by nextCompanyId and getCompany for each
      try {
        const total = (await client.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: ABI as any,
          functionName: 'nextCompanyId',
          args: [],
        })) as unknown as bigint;
        const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
        const list = await Promise.all(ids.map(async (id) => {
          const [name, limit, memberCount] = (await client.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: ABI as any,
            functionName: 'getCompany',
            args: [id],
          })) as unknown as [string, bigint, bigint];
          return { id, name, limit, members: memberCount };
        }));
        setCompanies(list);
        if (list.length && !companies.find(c => c.id === BigInt(companyId))) {
          setCompanyId(Number(list[0].id));
        }
      } catch (e2) {
        console.error('Failed to load companies', e, e2);
        setCompanies([]);
      }
    }
  }

  useEffect(() => {
    refreshCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function withSigner(): Promise<{ signer: ethers.Signer; contract: Contract }> {
    const signer = await getSigner();
    const contract = new Contract(CONTRACT_ADDRESS, ABI as any, signer);
    return { signer, contract };
  }

  async function createCompany() {
    const { contract } = await withSigner();
    const tx = await contract.createCompany(newCompanyName, newCompanyLimit);
    await tx.wait();
  }

  async function joinCompany() {
    const { contract } = await withSigner();
    const tx = await contract.joinCompany(companyId);
    await tx.wait();
  }

  async function createPoll() {
    const { contract } = await withSigner();
    const opts = pollOptions.split('\n').map((s) => s.trim()).filter(Boolean);
    if (opts.length < 2) throw new Error('At least 2 options');
    const tx = await contract.createPoll(companyId, pollTitle, opts);
    await tx.wait();
  }

  async function vote(optionIndex: number) {
    const { signer, contract } = await withSigner();
    if (!zama) throw new Error('Encryption service not ready');
    const enc = await zama.createEncryptedInput(CONTRACT_ADDRESS, await signer.getAddress())
      .add32(1)
      .encrypt();
    const tx = await contract.vote(companyId, pollId, optionIndex, enc.handles[0], enc.inputProof);
    await tx.wait();
  }

  async function finalize() {
    const { contract } = await withSigner();
    const tx = await contract.finalize(companyId, pollId);
    await tx.wait();
  }

  async function decryptResults() {
    if (!pollInfo?.finalized) return;
    setDecrypting(true);
    try {
      // Read encrypted counts
      const encCounts = (await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: ABI as any,
        functionName: 'getEncryptedCounts',
        args: [BigInt(companyId), BigInt(pollId)],
      })) as unknown as string[];

      if (!zama) throw new Error('Encryption service not ready');
      const signer = await getSigner();

      // Generate keypair and EIP712 request to allow user decryption
      const keypair = zama.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const eip712 = zama.createEIP712(
        keypair.publicKey,
        [CONTRACT_ADDRESS],
        startTimeStamp,
        durationDays,
      );
      const signature = await (signer as any).signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const pairs = (encCounts as string[]).map((handle: string) => ({ handle, contractAddress: CONTRACT_ADDRESS }));
      const res = await zama.userDecrypt(
        pairs,
        keypair.publicKey,
        keypair.secretKey,
        signature,
      );

      const values = res.map((r: any) => Number(BigInt(r.value)));
      setResults(values);
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <div className="vote-app">
      <Header />
      <main className="vote-main">
        <section className="vote-section instructions">
          <h2>How to Use</h2>
          <ol>
            <li>Create Company: Enter company name and employee limit.</li>
            <li>Join Company: Select and join a company from the list.</li>
            <li>Create Poll: Select a company, enter poll title and options (one per line).</li>
            <li>Vote: Company members vote, each vote encrypts and increments the selected option count.</li>
            <li>Progress: The page shows votes cast / total company members.</li>
            <li>Finalize: After all votes are cast, click finalize and decrypt to view results for each option.</li>
          </ol>
        </section>

        <section className="vote-section">
          <h2>Create Company</h2>
          <div className="form-grid">
            <FormInput
              id='companyName'
              label='Company Name'
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Enter company name"
              required
            />
            <FormInput
              id='companyLimit'
              label='Employee Limit'
              type='number'
              value={newCompanyLimit}
              onChange={(e) => setNewCompanyLimit(Number(e.target.value))}
              placeholder="Enter maximum number of employees"
              min={1}
              required
            />
            <Button onClick={createCompany}>
              Create Company
            </Button>
          </div>
        </section>

        <section className="vote-section">
          <h2>Join Company</h2>
          <div className="company-selector">
            <div className="form-group">
              <label htmlFor='companySelect' className="form-label">Select Company</label>
              <select
                id='companySelect'
                className="form-select"
                value={companyId}
                onChange={(e) => setCompanyId(Number(e.target.value))}
              >
                {companies.map(c => (
                  <option key={String(c.id)} value={String(c.id)}>
                    #{String(c.id)} - {c.name} ({String(c.members)}/{String(c.limit)} members)
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" onClick={refreshCompanies}>
              Refresh
            </Button>
            <Button
              variant="success"
              onClick={joinCompany}
              disabled={!companies.length}
            >
              Join Company
            </Button>
          </div>
          {companies.length > 0 && (
            <div className="company-list">
              <h3 style={{ margin: '0 0 1rem 0', color: '#374151', fontSize: '1rem', fontWeight: 600 }}>
                All Companies
              </h3>
              <div>
                {companies.map(c => (
                  <div key={String(c.id)} className="company-item">
                    <div className="company-info">
                      <span className="company-id">#{String(c.id)}</span>
                      <span className="company-name">{c.name}</span>
                      <span className="company-members">
                        {String(c.members)}/{String(c.limit)} members
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setCompanyId(Number(c.id))}
                      disabled={companyId === Number(c.id)}
                    >
                      {companyId === Number(c.id) ? 'Selected' : 'Select'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="vote-section">
          <h2>Create Poll</h2>
          <div className="form-grid">
            <StatusMessage>
              Selected Company: #{companyId || '-'}
            </StatusMessage>
            <FormInput
              id='pollTitle'
              label='Poll Title'
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
              placeholder="Enter your poll question"
              required
            />
            <FormTextarea
              id='pollOptions'
              label='Poll Options (one per line)'
              value={pollOptions}
              onChange={(e) => setPollOptions(e.target.value)}
              placeholder="Option 1&#10;Option 2&#10;Option 3"
              required
            />
            <Button
              onClick={createPoll}
              disabled={!companyId}
            >
              Create Poll
            </Button>
          </div>
        </section>

        <section className="vote-section">
          <h2>Poll</h2>
          <StatusMessage>
            🔒 Your poll selection is encrypted and private.
          </StatusMessage>
          <div className="form-grid">
            <StatusMessage>
              Selected Company: #{companyId || '-'}
            </StatusMessage>
            <FormInput
              id='pollId'
              label='Poll ID'
              type='number'
              value={pollId}
              onChange={(e) => setPollId(Number(e.target.value))}
              placeholder="Enter poll ID to view"
              min={0}
            />
          </div>
          {pollInfo && (
            <div className="poll-info">
              <div className="poll-title">{pollInfo.title}</div>
              <div className="poll-progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>
                    Progress: {String(pollInfo.totalVoted)} / {String(pollInfo.memberCount)}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {pollInfo.memberCount > 0 ? Math.round((Number(pollInfo.totalVoted) / Number(pollInfo.memberCount)) * 100) : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: pollInfo.memberCount > 0
                        ? `${(Number(pollInfo.totalVoted) / Number(pollInfo.memberCount)) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>
              <div className="poll-options">
                {pollInfo.options.map((opt, i) => (
                  <Button
                    key={i}
                    variant="vote"
                    onClick={() => vote(i)}
                    disabled={!address || pollInfo.finalized || zamaLoading || !zama}
                  >
                    {zamaLoading ? (
                      <LoadingSpinner text="Loading..." />
                    ) : (
                      `Vote: ${opt}`
                    )}
                  </Button>
                ))}
              </div>
              {!pollInfo.finalized && pollInfo.totalVoted === pollInfo.memberCount && (
                <div style={{ marginTop: '1rem' }}>
                  <Button variant="success" onClick={finalize}>
                    Finalize Poll
                  </Button>
                </div>
              )}
              {pollInfo.finalized && (
                <div style={{ marginTop: '1rem' }}>
                  <Button
                    variant="secondary"
                    onClick={decryptResults}
                    disabled={decrypting}
                  >
                    {decrypting ? (
                      <LoadingSpinner text="Decrypting..." />
                    ) : (
                      'Decrypt Results'
                    )}
                  </Button>
                </div>
              )}
              {results && (
                <div className="results">
                  <h3>Results</h3>
                  <ul>
                    {results.map((v, i) => (
                      <li key={i}>
                        <span className="result-option">{pollInfo.options[i]}</span>
                        <span className="result-count">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
