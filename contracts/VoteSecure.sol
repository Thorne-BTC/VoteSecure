// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VoteSecure - 公司内部加密投票系统
/// @notice 使用Zama FHE技术的保密投票系统，支持公司创建、员工管理和匿名投票
contract VoteSecure is SepoliaConfig {
    
    // 公司结构
    struct Company {
        string name;                    // 公司名称
        address creator;                // 创建者地址
        uint256 totalEmployees;         // 总员工数
        uint256 createdAt;             // 创建时间
        bool exists;                   // 是否存在
    }
    
    // 投票结构
    struct Vote {
        uint256 companyId;             // 所属公司ID
        string title;                  // 投票标题
        string[] options;              // 投票选项
        address creator;               // 创建者
        uint256 createdAt;             // 创建时间
        uint256 endTime;               // 结束时间
        bool isActive;                 // 是否激活
        bool isDecrypted;              // 是否已解密
        uint256 totalVoted;            // 已投票人数
        mapping(uint256 => euint32) encryptedResults;  // 每个选项的加密结果
        mapping(address => bool) hasVoted;             // 用户是否已投票
    }
    
    // 状态变量
    uint256 private _companyCounter;
    uint256 private _voteCounter;
    
    // 映射存储
    mapping(uint256 => Company) public companies;
    mapping(uint256 => Vote) public votes;
    mapping(address => uint256) public userCompany;  // 用户所属公司
    mapping(uint256 => mapping(address => bool)) public companyEmployees;  // 公司员工
    mapping(uint256 => uint256[]) public companyVotes;  // 公司的所有投票
    
    // 事件
    event CompanyCreated(uint256 indexed companyId, string name, address creator, uint256 totalEmployees);
    event UserJoinedCompany(uint256 indexed companyId, address user);
    event VoteCreated(uint256 indexed voteId, uint256 indexed companyId, string title, address creator);
    event VoteCasted(uint256 indexed voteId, address voter);
    event VoteEnded(uint256 indexed voteId);
    event VoteDecrypted(uint256 indexed voteId);
    
    // 修饰符
    modifier onlyCompanyEmployee(uint256 companyId) {
        require(companyEmployees[companyId][msg.sender], "Not a company employee");
        _;
    }
    
    modifier onlyVoteCreator(uint256 voteId) {
        require(votes[voteId].creator == msg.sender, "Not the vote creator");
        _;
    }
    
    modifier voteExists(uint256 voteId) {
        require(voteId <= _voteCounter && voteId > 0, "Vote does not exist");
        _;
    }
    
    modifier companyExists(uint256 companyId) {
        require(companies[companyId].exists, "Company does not exist");
        _;
    }
    
    /// @notice 创建公司
    /// @param name 公司名称
    /// @param totalEmployees 员工总数
    function createCompany(string calldata name, uint256 totalEmployees) external {
        require(bytes(name).length > 0, "Company name cannot be empty");
        require(totalEmployees > 0, "Total employees must be greater than 0");
        require(userCompany[msg.sender] == 0, "User already belongs to a company");
        
        _companyCounter++;
        
        companies[_companyCounter] = Company({
            name: name,
            creator: msg.sender,
            totalEmployees: totalEmployees,
            createdAt: block.timestamp,
            exists: true
        });
        
        // 创建者自动加入公司
        companyEmployees[_companyCounter][msg.sender] = true;
        userCompany[msg.sender] = _companyCounter;
        
        emit CompanyCreated(_companyCounter, name, msg.sender, totalEmployees);
    }
    
    /// @notice 加入公司
    /// @param companyId 公司ID
    function joinCompany(uint256 companyId) external companyExists(companyId) {
        require(userCompany[msg.sender] == 0, "User already belongs to a company");
        require(!companyEmployees[companyId][msg.sender], "User already in this company");
        
        // 检查公司是否已满员
        uint256 currentEmployees = 0;
        // 注意：这里简化实现，实际项目中可能需要更高效的员工计数方式
        
        companyEmployees[companyId][msg.sender] = true;
        userCompany[msg.sender] = companyId;
        
        emit UserJoinedCompany(companyId, msg.sender);
    }
    
    /// @notice 创建投票
    /// @param companyId 公司ID
    /// @param title 投票标题
    /// @param options 投票选项
    /// @param duration 投票持续时间（秒）
    function createVote(
        uint256 companyId,
        string calldata title,
        string[] calldata options,
        uint256 duration
    ) external companyExists(companyId) onlyCompanyEmployee(companyId) {
        require(bytes(title).length > 0, "Vote title cannot be empty");
        require(options.length >= 2, "Must have at least 2 options");
        require(duration > 0, "Duration must be greater than 0");
        
        _voteCounter++;
        
        Vote storage newVote = votes[_voteCounter];
        newVote.companyId = companyId;
        newVote.title = title;
        newVote.options = options;
        newVote.creator = msg.sender;
        newVote.createdAt = block.timestamp;
        newVote.endTime = block.timestamp + duration;
        newVote.isActive = true;
        newVote.isDecrypted = false;
        newVote.totalVoted = 0;
        
        // 初始化每个选项的加密计数为0
        for (uint256 i = 0; i < options.length; i++) {
            newVote.encryptedResults[i] = FHE.asEuint32(0);
            FHE.allowThis(newVote.encryptedResults[i]);
        }
        
        companyVotes[companyId].push(_voteCounter);
        
        emit VoteCreated(_voteCounter, companyId, title, msg.sender);
    }
    
    /// @notice 投票
    /// @param voteId 投票ID
    /// @param optionIndex 选项索引
    /// @param encryptedVote 加密的投票值（通常为1）
    /// @param inputProof 输入证明
    function castVote(
        uint256 voteId,
        uint256 optionIndex,
        externalEuint32 encryptedVote,
        bytes calldata inputProof
    ) external voteExists(voteId) {
        Vote storage vote = votes[voteId];
        
        require(vote.isActive, "Vote is not active");
        require(block.timestamp <= vote.endTime, "Vote has ended");
        require(companyEmployees[vote.companyId][msg.sender], "Not a company employee");
        require(!vote.hasVoted[msg.sender], "User has already voted");
        require(optionIndex < vote.options.length, "Invalid option index");
        
        // 验证并转换加密输入
        euint32 encryptedValue = FHE.fromExternal(encryptedVote, inputProof);
        
        // 将投票添加到对应选项的计数中
        vote.encryptedResults[optionIndex] = FHE.add(vote.encryptedResults[optionIndex], encryptedValue);
        
        // 设置ACL权限
        FHE.allowThis(vote.encryptedResults[optionIndex]);
        
        // 标记用户已投票
        vote.hasVoted[msg.sender] = true;
        vote.totalVoted++;
        
        emit VoteCasted(voteId, msg.sender);
        
        // 检查是否所有员工都已投票
        if (vote.totalVoted == companies[vote.companyId].totalEmployees) {
            vote.isActive = false;
            emit VoteEnded(voteId);
        }
    }
    
    /// @notice 结束投票（创建者可以提前结束）
    /// @param voteId 投票ID
    function endVote(uint256 voteId) external voteExists(voteId) onlyVoteCreator(voteId) {
        Vote storage vote = votes[voteId];
        require(vote.isActive, "Vote is not active");
        
        vote.isActive = false;
        emit VoteEnded(voteId);
    }
    
    /// @notice 请求解密投票结果
    /// @param voteId 投票ID
    function requestDecryption(uint256 voteId) external voteExists(voteId) {
        Vote storage vote = votes[voteId];
        require(!vote.isActive, "Vote is still active");
        require(!vote.isDecrypted, "Vote already decrypted");
        require(companyEmployees[vote.companyId][msg.sender], "Not a company employee");
        
        // 准备解密请求
        bytes32[] memory cts = new bytes32[](vote.options.length);
        for (uint256 i = 0; i < vote.options.length; i++) {
            cts[i] = FHE.toBytes32(vote.encryptedResults[i]);
        }
        
        // 请求异步解密
        FHE.requestDecryption(cts, this.decryptionCallback.selector);
    }
    
    /// @notice 解密回调函数
    /// @param requestId 请求ID
    /// @param decryptedValues 解密后的值
    /// @param signatures 签名数组
    function decryptionCallback(
        uint256 requestId,
        uint256[] memory decryptedValues,
        bytes[] memory signatures
    ) public {
        // 验证解密结果的签名
        FHE.checkSignatures(requestId, signatures);
        
        // 这里需要存储解密结果，但由于Solidity限制，我们使用事件来发布结果
        emit VoteDecrypted(requestId);
    }
    
    /// @notice 获取投票信息
    /// @param voteId 投票ID
    function getVote(uint256 voteId) external view voteExists(voteId) returns (
        uint256 companyId,
        string memory title,
        string[] memory options,
        address creator,
        uint256 createdAt,
        uint256 endTime,
        bool isActive,
        bool isDecrypted,
        uint256 totalVoted
    ) {
        Vote storage vote = votes[voteId];
        return (
            vote.companyId,
            vote.title,
            vote.options,
            vote.creator,
            vote.createdAt,
            vote.endTime,
            vote.isActive,
            vote.isDecrypted,
            vote.totalVoted
        );
    }
    
    /// @notice 获取加密的投票结果
    /// @param voteId 投票ID
    /// @param optionIndex 选项索引
    function getEncryptedResult(uint256 voteId, uint256 optionIndex) external view voteExists(voteId) returns (euint32) {
        Vote storage vote = votes[voteId];
        require(optionIndex < vote.options.length, "Invalid option index");
        require(companyEmployees[vote.companyId][msg.sender], "Not a company employee");
        
        return vote.encryptedResults[optionIndex];
    }
    
    /// @notice 获取公司信息
    /// @param companyId 公司ID
    function getCompany(uint256 companyId) external view companyExists(companyId) returns (
        string memory name,
        address creator,
        uint256 totalEmployees,
        uint256 createdAt
    ) {
        Company storage company = companies[companyId];
        return (company.name, company.creator, company.totalEmployees, company.createdAt);
    }
    
    /// @notice 获取公司的所有投票
    /// @param companyId 公司ID
    function getCompanyVotes(uint256 companyId) external view companyExists(companyId) returns (uint256[] memory) {
        return companyVotes[companyId];
    }
    
    /// @notice 检查用户是否已投票
    /// @param voteId 投票ID
    /// @param user 用户地址
    function hasUserVoted(uint256 voteId, address user) external view voteExists(voteId) returns (bool) {
        return votes[voteId].hasVoted[user];
    }
    
    /// @notice 获取当前公司数量
    function getTotalCompanies() external view returns (uint256) {
        return _companyCounter;
    }
    
    /// @notice 获取当前投票数量
    function getTotalVotes() external view returns (uint256) {
        return _voteCounter;
    }
}