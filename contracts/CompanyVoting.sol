// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title CompanyVoting - Encrypted internal company voting using Zama FHEVM
/// @notice Supports creating companies, joining, and running encrypted-option polls.
contract CompanyVoting is SepoliaConfig {
    struct Company {
        string name;
        uint256 employeeLimit;
        address[] members;
        mapping(address => bool) isMember;
        uint256 nextPollId;
        mapping(uint256 => Poll) polls;
    }

    struct Poll {
        string title;
        string[] options;
        // Encrypted vote counts per option
        euint32[] counts;
        uint256 totalVoted;
        uint256 memberCountSnapshot;
        bool finalized;
        mapping(address => bool) hasVoted;
    }

    uint256 public nextCompanyId;
    mapping(uint256 => Company) private companies;

    event CompanyCreated(uint256 indexed companyId, string name, uint256 employeeLimit);
    event JoinedCompany(uint256 indexed companyId, address indexed account);
    event PollCreated(uint256 indexed companyId, uint256 indexed pollId, string title, string[] options);
    event Voted(uint256 indexed companyId, uint256 indexed pollId, address indexed voter, uint256 optionIndex);
    event Finalized(uint256 indexed companyId, uint256 indexed pollId);

    /// @notice Create a new company
    function createCompany(string calldata name, uint256 employeeLimit) external returns (uint256 companyId) {
        require(bytes(name).length > 0, "Invalid name");
        require(employeeLimit > 0, "Invalid employee limit");

        companyId = ++nextCompanyId;
        Company storage c = companies[companyId];
        c.name = name;
        c.employeeLimit = employeeLimit;
        emit CompanyCreated(companyId, name, employeeLimit);
    }

    /// @notice Join a company
    function joinCompany(uint256 companyId) external {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(!c.isMember[msg.sender], "Already member");
        require(c.members.length < c.employeeLimit, "Company is full");

        c.isMember[msg.sender] = true;
        c.members.push(msg.sender);
        emit JoinedCompany(companyId, msg.sender);
    }

    /// @notice Create a new poll in a company
    function createPoll(
        uint256 companyId,
        string calldata title,
        string[] calldata options
    ) external returns (uint256 pollId) {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(c.isMember[msg.sender], "Only member");
        require(bytes(title).length > 0, "Invalid title");
        require(options.length >= 2, "At least 2 options");

        pollId = c.nextPollId++;
        Poll storage p = c.polls[pollId];
        p.title = title;
        p.memberCountSnapshot = c.members.length;

        // Initialize options and encrypted counts
        for (uint256 i = 0; i < options.length; i++) {
            p.options.push(options[i]);
            // initialize to encrypted zero by leaving default (bytes32(0)) as uninitialized;
            // counts will be set on first addition. To make it explicit, set to euint32(0)
            euint32 zero = FHE.asEuint32(0);
            p.counts.push(zero);
            FHE.allowThis(zero);
        }

        emit PollCreated(companyId, pollId, title, options);
    }

    /// @notice Cast a vote by incrementing the encrypted count of the selected option by 1 (encrypted)
    /// @param companyId The company id
    /// @param pollId The poll id
    /// @param optionIndex The option index to vote for
    /// @param oneEncrypted external encrypted euint32 value representing 1
    /// @param inputProof Zama input proof for the encrypted 1
    function vote(
        uint256 companyId,
        uint256 pollId,
        uint256 optionIndex,
        externalEuint32 oneEncrypted,
        bytes calldata inputProof
    ) external {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(c.isMember[msg.sender], "Only member");
        require(pollId < c.nextPollId, "Poll not found");

        Poll storage p = c.polls[pollId];
        require(!p.finalized, "Poll finalized");
        require(!p.hasVoted[msg.sender], "Already voted");
        require(optionIndex < p.options.length, "Invalid option");

        euint32 one = FHE.fromExternal(oneEncrypted, inputProof);
        p.counts[optionIndex] = FHE.add(p.counts[optionIndex], one);

        // Refresh ACL for contract to return ciphertext handles
        FHE.allowThis(p.counts[optionIndex]);

        p.hasVoted[msg.sender] = true;
        p.totalVoted += 1;
        emit Voted(companyId, pollId, msg.sender, optionIndex);
    }

    /// @notice Finalize a poll once all members have voted; allows all members to decrypt counts
    function finalize(uint256 companyId, uint256 pollId) external {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(pollId < c.nextPollId, "Poll not found");

        Poll storage p = c.polls[pollId];
        require(!p.finalized, "Already finalized");
        require(p.totalVoted == p.memberCountSnapshot, "Not all voted");

        // Allow each member to decrypt the final counts
        for (uint256 i = 0; i < p.counts.length; i++) {
            for (uint256 j = 0; j < c.members.length; j++) {
                FHE.allow(p.counts[i], c.members[j]);
            }
        }

        p.finalized = true;
        emit Finalized(companyId, pollId);
    }

    // ------------------------
    // View functions (no msg.sender reliance)
    // ------------------------

    function getCompany(uint256 companyId)
        external
        view
        returns (string memory name, uint256 employeeLimit, uint256 memberCount)
    {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        return (c.name, c.employeeLimit, c.members.length);
    }

    function getCompanyMembers(uint256 companyId) external view returns (address[] memory) {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        return c.members;
    }

    function isCompanyMember(uint256 companyId, address account) external view returns (bool) {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        return c.isMember[account];
    }

    function getPoll(uint256 companyId, uint256 pollId)
        external
        view
        returns (
            string memory title,
            string[] memory options,
            uint256 totalVoted,
            uint256 memberCountSnapshot,
            bool finalized
        )
    {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(pollId < c.nextPollId, "Poll not found");
        Poll storage p = c.polls[pollId];
        return (p.title, p.options, p.totalVoted, p.memberCountSnapshot, p.finalized);
    }

    function hasUserVoted(uint256 companyId, uint256 pollId, address user) external view returns (bool) {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(pollId < c.nextPollId, "Poll not found");
        return c.polls[pollId].hasVoted[user];
    }

    /// @notice Get encrypted counts for each option. Only available once finalized.
    function getEncryptedCounts(uint256 companyId, uint256 pollId) external view returns (euint32[] memory) {
        Company storage c = companies[companyId];
        require(bytes(c.name).length != 0, "Company not found");
        require(pollId < c.nextPollId, "Poll not found");
        Poll storage p = c.polls[pollId];
        require(p.finalized, "Not finalized");

        euint32[] memory out = new euint32[](p.counts.length);
        for (uint256 i = 0; i < p.counts.length; i++) {
            out[i] = p.counts[i];
        }
        return out;
    }
}

