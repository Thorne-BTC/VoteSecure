import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { VOTE_SECURE_ADDRESS } from '../config/wagmi';
import { voteSecureAbi } from '../config/abi';

interface Company {
  id: number;
  name: string;
  creator: string;
  totalEmployees: number;
  createdAt: number;
}

export default function CompanyManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<number>(0);
  
  // Form states
  const [companyName, setCompanyName] = useState('');
  const [totalEmployees, setTotalEmployees] = useState('');
  const [joinCompanyId, setJoinCompanyId] = useState('');

  // 读取用户所属公司
  const { data: userCompany } = useReadContract({
    address: VOTE_SECURE_ADDRESS as `0x${string}`,
    abi: voteSecureAbi,
    functionName: 'userCompany',
    args: address ? [address] : undefined,
  });

  // 读取公司总数
  const { data: totalCompanies } = useReadContract({
    address: VOTE_SECURE_ADDRESS as `0x${string}`,
    abi: voteSecureAbi,
    functionName: 'getTotalCompanies',
  });

  useEffect(() => {
    if (userCompany) {
      setUserCompanyId(Number(userCompany));
    }
  }, [userCompany]);

  // 加载公司列表
  useEffect(() => {
    const loadCompanies = async () => {
      if (!totalCompanies) return;
      
      const companiesData: Company[] = [];
      for (let i = 1; i <= Number(totalCompanies); i++) {
        try {
          // 这里需要实现读取公司信息的逻辑
          // 由于useReadContract的限制，我们可能需要使用不同的方法
        } catch (error) {
          console.error(`Error loading company ${i}:`, error);
        }
      }
      setCompanies(companiesData);
    };

    loadCompanies();
  }, [totalCompanies]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !companyName || !totalEmployees) return;

    try {
      await writeContract({
        address: VOTE_SECURE_ADDRESS as `0x${string}`,
        abi: voteSecureAbi,
        functionName: 'createCompany',
        args: [companyName, BigInt(totalEmployees)],
      });
      
      setCompanyName('');
      setTotalEmployees('');
      alert('公司创建成功！');
    } catch (error) {
      console.error('Error creating company:', error);
      alert('创建公司失败，请重试');
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !joinCompanyId) return;

    try {
      await writeContract({
        address: VOTE_SECURE_ADDRESS as `0x${string}`,
        abi: voteSecureAbi,
        functionName: 'joinCompany',
        args: [BigInt(joinCompanyId)],
      });
      
      setJoinCompanyId('');
      alert('加入公司成功！');
    } catch (error) {
      console.error('Error joining company:', error);
      alert('加入公司失败，请重试');
    }
  };

  if (!isConnected) {
    return (
      <div className="not-connected">
        <h2>请连接钱包以使用公司管理功能</h2>
        <p>您需要连接以太坊钱包来创建或加入公司</p>
      </div>
    );
  }

  return (
    <div className="company-manager">
      <h2>公司管理</h2>
      
      {userCompanyId > 0 ? (
        <div className="user-company-info">
          <h3>您已加入公司</h3>
          <p>公司ID: {userCompanyId}</p>
        </div>
      ) : (
        <div className="no-company">
          <p>您尚未加入任何公司，请创建或加入一个公司</p>
        </div>
      )}

      <div className="forms-container">
        <div className="form-section">
          <h3>创建新公司</h3>
          <form onSubmit={handleCreateCompany}>
            <div className="form-group">
              <label htmlFor="companyName">公司名称：</label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="输入公司名称"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="totalEmployees">员工总数：</label>
              <input
                id="totalEmployees"
                type="number"
                value={totalEmployees}
                onChange={(e) => setTotalEmployees(e.target.value)}
                placeholder="输入员工总数"
                min="1"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={userCompanyId > 0}
              className="btn-primary"
            >
              {userCompanyId > 0 ? '已加入公司' : '创建公司'}
            </button>
          </form>
        </div>

        <div className="form-section">
          <h3>加入现有公司</h3>
          <form onSubmit={handleJoinCompany}>
            <div className="form-group">
              <label htmlFor="joinCompanyId">公司ID：</label>
              <input
                id="joinCompanyId"
                type="number"
                value={joinCompanyId}
                onChange={(e) => setJoinCompanyId(e.target.value)}
                placeholder="输入要加入的公司ID"
                min="1"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={userCompanyId > 0}
              className="btn-secondary"
            >
              {userCompanyId > 0 ? '已加入公司' : '加入公司'}
            </button>
          </form>
        </div>
      </div>

      <div className="companies-list">
        <h3>公司列表</h3>
        <p>总公司数量: {totalCompanies ? Number(totalCompanies) : 0}</p>
        {companies.length > 0 ? (
          <div className="companies-grid">
            {companies.map((company) => (
              <div key={company.id} className="company-card">
                <h4>{company.name}</h4>
                <p>ID: {company.id}</p>
                <p>员工数: {company.totalEmployees}</p>
                <p>创建者: {company.creator.slice(0, 6)}...{company.creator.slice(-4)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无公司数据</p>
        )}
      </div>
    </div>
  );
}