import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk';
import { VOTE_SECURE_ADDRESS } from '../config/wagmi';
import { voteSecureAbi } from '../config/abi';

interface Vote {
  id: number;
  companyId: number;
  title: string;
  options: string[];
  creator: string;
  createdAt: number;
  endTime: number;
  isActive: boolean;
  isDecrypted: boolean;
  totalVoted: number;
}

export default function VoteManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<number>(0);
  const [fhevmInstance, setFhevmInstance] = useState<any>(null);
  
  // Form states
  const [voteTitle, setVoteTitle] = useState('');
  const [voteOptions, setVoteOptions] = useState(['', '']);
  const [voteDuration, setVoteDuration] = useState('3600'); // 1 hour default

  // 读取用户所属公司
  const { data: userCompany } = useReadContract({
    address: VOTE_SECURE_ADDRESS as `0x${string}`,
    abi: voteSecureAbi,
    functionName: 'userCompany',
    args: address ? [address] : undefined,
  });

  // 读取投票总数
  const { data: totalVotes } = useReadContract({
    address: VOTE_SECURE_ADDRESS as `0x${string}`,
    abi: voteSecureAbi,
    functionName: 'getTotalVotes',
  });

  // 初始化FHEVM实例
  useEffect(() => {
    const initFHEVM = async () => {
      try {
        const instance = await createInstance(SepoliaConfig);
        setFhevmInstance(instance);
      } catch (error) {
        console.error('Error initializing FHEVM:', error);
      }
    };

    initFHEVM();
  }, []);

  useEffect(() => {
    if (userCompany) {
      setUserCompanyId(Number(userCompany));
    }
  }, [userCompany]);

  // 加载投票列表
  useEffect(() => {
    const loadVotes = async () => {
      if (!totalVotes || userCompanyId === 0) return;
      
      // 这里需要实现加载公司投票的逻辑
      // 由于合约限制，我们可能需要监听事件或使用不同的方法
    };

    loadVotes();
  }, [totalVotes, userCompanyId]);

  const handleAddOption = () => {
    setVoteOptions([...voteOptions, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (voteOptions.length > 2) {
      setVoteOptions(voteOptions.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...voteOptions];
    newOptions[index] = value;
    setVoteOptions(newOptions);
  };

  const handleCreateVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !voteTitle || userCompanyId === 0) return;

    const validOptions = voteOptions.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      alert('至少需要两个投票选项');
      return;
    }

    try {
      await writeContract({
        address: VOTE_SECURE_ADDRESS as `0x${string}`,
        abi: voteSecureAbi,
        functionName: 'createVote',
        args: [
          BigInt(userCompanyId),
          voteTitle,
          validOptions,
          BigInt(voteDuration)
        ],
      });
      
      setVoteTitle('');
      setVoteOptions(['', '']);
      setVoteDuration('3600');
      alert('投票创建成功！');
    } catch (error) {
      console.error('Error creating vote:', error);
      alert('创建投票失败，请重试');
    }
  };

  const handleCastVote = async (voteId: number, optionIndex: number) => {
    if (!isConnected || !fhevmInstance || !address) return;

    try {
      // 创建加密输入
      const input = fhevmInstance.createEncryptedInput(
        VOTE_SECURE_ADDRESS,
        address
      );
      input.add32(1); // 投票值为1
      const encryptedInput = await input.encrypt();

      await writeContract({
        address: VOTE_SECURE_ADDRESS as `0x${string}`,
        abi: voteSecureAbi,
        functionName: 'castVote',
        args: [
          BigInt(voteId),
          BigInt(optionIndex),
          encryptedInput.handles[0],
          encryptedInput.inputProof
        ],
      });
      
      alert('投票成功！');
    } catch (error) {
      console.error('Error casting vote:', error);
      alert('投票失败，请重试');
    }
  };

  const handleEndVote = async (voteId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: VOTE_SECURE_ADDRESS as `0x${string}`,
        abi: voteSecureAbi,
        functionName: 'endVote',
        args: [BigInt(voteId)],
      });
      
      alert('投票已结束！');
    } catch (error) {
      console.error('Error ending vote:', error);
      alert('结束投票失败，请重试');
    }
  };

  const handleRequestDecryption = async (voteId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: VOTE_SECURE_ADDRESS as `0x${string}`,
        abi: voteSecureAbi,
        functionName: 'requestDecryption',
        args: [BigInt(voteId)],
      });
      
      alert('解密请求已发送！');
    } catch (error) {
      console.error('Error requesting decryption:', error);
      alert('请求解密失败，请重试');
    }
  };

  if (!isConnected) {
    return (
      <div className="not-connected">
        <h2>请连接钱包以使用投票功能</h2>
        <p>您需要连接以太坊钱包来创建和参与投票</p>
      </div>
    );
  }

  if (userCompanyId === 0) {
    return (
      <div className="no-company">
        <h2>请先加入公司</h2>
        <p>您需要先加入一个公司才能参与投票活动</p>
      </div>
    );
  }

  return (
    <div className="vote-manager">
      <h2>投票管理</h2>
      <p>您的公司ID: {userCompanyId}</p>

      <div className="form-section">
        <h3>创建新投票</h3>
        <form onSubmit={handleCreateVote}>
          <div className="form-group">
            <label htmlFor="voteTitle">投票标题：</label>
            <input
              id="voteTitle"
              type="text"
              value={voteTitle}
              onChange={(e) => setVoteTitle(e.target.value)}
              placeholder="输入投票标题"
              required
            />
          </div>
          
          <div className="form-group">
            <label>投票选项：</label>
            {voteOptions.map((option, index) => (
              <div key={index} className="option-input">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`选项 ${index + 1}`}
                  required
                />
                {voteOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="btn-remove"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOption}
              className="btn-add"
            >
              添加选项
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="voteDuration">投票持续时间（秒）：</label>
            <select
              id="voteDuration"
              value={voteDuration}
              onChange={(e) => setVoteDuration(e.target.value)}
            >
              <option value="3600">1小时</option>
              <option value="7200">2小时</option>
              <option value="86400">1天</option>
              <option value="604800">1周</option>
            </select>
          </div>

          <button type="submit" className="btn-primary">
            创建投票
          </button>
        </form>
      </div>

      <div className="votes-list">
        <h3>投票列表</h3>
        <p>总投票数量: {totalVotes ? Number(totalVotes) : 0}</p>
        
        {votes.length > 0 ? (
          <div className="votes-grid">
            {votes.map((vote) => (
              <div key={vote.id} className="vote-card">
                <h4>{vote.title}</h4>
                <p>投票ID: {vote.id}</p>
                <p>状态: {vote.isActive ? '进行中' : '已结束'}</p>
                <p>已投票: {vote.totalVoted} 人</p>
                <p>结束时间: {new Date(vote.endTime * 1000).toLocaleString()}</p>
                
                <div className="vote-options">
                  {vote.options.map((option, index) => (
                    <div key={index} className="vote-option">
                      <span>{option}</span>
                      {vote.isActive && (
                        <button
                          onClick={() => handleCastVote(vote.id, index)}
                          className="btn-vote"
                        >
                          投票
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="vote-actions">
                  {vote.isActive && vote.creator === address && (
                    <button
                      onClick={() => handleEndVote(vote.id)}
                      className="btn-end"
                    >
                      结束投票
                    </button>
                  )}
                  
                  {!vote.isActive && !vote.isDecrypted && (
                    <button
                      onClick={() => handleRequestDecryption(vote.id)}
                      className="btn-decrypt"
                    >
                      请求解密
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无投票数据</p>
        )}
      </div>
    </div>
  );
}