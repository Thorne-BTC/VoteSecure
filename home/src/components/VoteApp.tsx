import { useEffect, useMemo, useState } from 'react';
import { Header } from './Header';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { Contract, ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ABI_EXTRAS, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';

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
  const getRelayerInstance = useZamaInstance();

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
      setCompanies([]);
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
    const instance = getRelayerInstance();
    await instance.init();
    const enc = await instance.createEncryptedInput(CONTRACT_ADDRESS, await signer.getAddress())
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

      const instance = getRelayerInstance();
      await instance.init();
      const signer = await getSigner();

      // Generate keypair and EIP712 request to allow user decryption
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const eip712 = instance.createEIP712(
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
      const res = await instance.userDecrypt(
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
    <div>
      <Header />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
        <section style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h2>使用说明</h2>
          <ol>
            <li>创建公司：填写公司名称与员工数量上限。</li>
            <li>加入公司：从公司列表中选择并加入。</li>
            <li>发起投票：选择公司，填写投票标题与选项（每行一个）。</li>
            <li>公司成员投票：每次投票将对所选选项的计数进行加密加一。</li>
            <li>投票进度：页面显示已投票人数/公司成员数。</li>
            <li>全部投票后：可点击完成并解密查看每个选项的票数。</li>
          </ol>
        </section>

        <section style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h2>Create Company</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor='companyName'>Company Name</label>
            <input id='companyName' value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} />
            <label htmlFor='companyLimit'>Employee Limit</label>
            <input id='companyLimit' type='number' value={newCompanyLimit}
                   onChange={(e) => setNewCompanyLimit(Number(e.target.value))} />
            <button onClick={createCompany}>Create</button>
          </div>
        </section>

        <section style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h2>Join Company</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor='companySelect'>Select Company</label>
            <select id='companySelect' value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))}>
              {companies.map(c => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.id)} - {c.name} (Members: {String(c.members)}/{String(c.limit)})
                </option>
              ))}
            </select>
            <button onClick={refreshCompanies}>Refresh</button>
            <button onClick={joinCompany} disabled={!companies.length}>Join</button>
          </div>
          {companies.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>All Companies</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {companies.map(c => (
                  <div key={String(c.id)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>#{String(c.id)}</span>
                    <span>{c.name}</span>
                    <span>Members {String(c.members)}/{String(c.limit)}</span>
                    <button onClick={() => setCompanyId(Number(c.id))} disabled={companyId === Number(c.id)}>Select</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h2>Create Poll</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Selected Company: {companyId || '-'}</div>
            <label htmlFor='pollTitle'>Poll Title</label>
            <input id='pollTitle' value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} />
            <label htmlFor='pollOptions'>Poll Options (one per line)</label>
            <textarea id='pollOptions' value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} />
            <button onClick={createPoll} disabled={!companyId}>Create Poll</button>
          </div>
        </section>

        <section style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8 }}>
          <h2>Poll</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Selected Company: {companyId || '-'}</div>
            <label htmlFor='pollId'>Poll ID</label>
            <input id='pollId' type='number' value={pollId}
                   onChange={(e) => setPollId(Number(e.target.value))} />
          </div>
          {pollInfo && (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Title: {pollInfo.title}</div>
              <div style={{ marginBottom: 8 }}>Progress: {String(pollInfo.totalVoted)} / {String(pollInfo.memberCount)}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pollInfo.options.map((opt, i) => (
                  <button key={i} onClick={() => vote(i)} disabled={!address || pollInfo.finalized}>
                    Vote: {opt}
                  </button>
                ))}
              </div>
              {!pollInfo.finalized && pollInfo.totalVoted === pollInfo.memberCount && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={finalize}>Finalize</button>
                </div>
              )}
              {pollInfo.finalized && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={decryptResults} disabled={decrypting}>Decrypt Results</button>
                </div>
              )}
              {results && (
                <div style={{ marginTop: 12 }}>
                  <h3>Results</h3>
                  <ul>
                    {results.map((v, i) => (
                      <li key={i}>{pollInfo.options[i]}: {v}</li>
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
