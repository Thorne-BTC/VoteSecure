import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { VoteSecure } from "../types";
import type { Signers } from "./types";
import { FhevmType } from "@fhevm/hardhat-plugin";

describe("VoteSecure", function () {
  before(async function () {
    this.signers = {} as Signers;

    const signers = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.signers.alice = signers[1];
    this.signers.bob = signers[2];
    this.signers.carol = signers[3];
  });

  beforeEach(async function () {
    const VoteSecureFactory = await ethers.getContractFactory("VoteSecure");
    this.voteSecure = await VoteSecureFactory.connect(this.signers.admin).deploy();
    await this.voteSecure.waitForDeployment();

    this.contractAddress = await this.voteSecure.getAddress();
  });

  describe("Company Management", function () {
    it("should create a company", async function () {
      const companyName = "Test Company";
      const totalEmployees = 5;

      const tx = await this.voteSecure
        .connect(this.signers.alice)
        .createCompany(companyName, totalEmployees);
      
      await expect(tx)
        .to.emit(this.voteSecure, "CompanyCreated")
        .withArgs(1, companyName, this.signers.alice.address, totalEmployees);

      // 验证公司信息
      const company = await this.voteSecure.getCompany(1);
      expect(company[0]).to.equal(companyName);
      expect(company[1]).to.equal(this.signers.alice.address);
      expect(company[2]).to.equal(totalEmployees);

      // 验证创建者自动加入公司
      expect(await this.voteSecure.userCompany(this.signers.alice.address)).to.equal(1);
    });

    it("should allow users to join a company", async function () {
      // 先创建公司
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Test Company", 5);

      // Bob加入公司
      const tx = await this.voteSecure.connect(this.signers.bob).joinCompany(1);
      
      await expect(tx)
        .to.emit(this.voteSecure, "UserJoinedCompany")
        .withArgs(1, this.signers.bob.address);

      expect(await this.voteSecure.userCompany(this.signers.bob.address)).to.equal(1);
    });

    it("should prevent users from joining multiple companies", async function () {
      // 创建两个公司
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Company A", 5);
      
      await this.voteSecure
        .connect(this.signers.bob)
        .createCompany("Company B", 3);

      // Alice尝试加入Bob的公司（应该失败）
      await expect(
        this.voteSecure.connect(this.signers.alice).joinCompany(2)
      ).to.be.revertedWith("User already belongs to a company");
    });
  });

  describe("Voting System", function () {
    beforeEach(async function () {
      // 创建公司并让用户加入
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Test Company", 3);
      
      await this.voteSecure.connect(this.signers.bob).joinCompany(1);
      await this.voteSecure.connect(this.signers.carol).joinCompany(1);
    });

    it("should create a vote", async function () {
      const title = "Choose new office location";
      const options = ["New York", "San Francisco", "Remote"];
      const duration = 3600; // 1 hour

      const tx = await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, title, options, duration);

      await expect(tx)
        .to.emit(this.voteSecure, "VoteCreated")
        .withArgs(1, 1, title, this.signers.alice.address);

      // 验证投票信息
      const vote = await this.voteSecure.getVote(1);
      expect(vote[0]).to.equal(1); // companyId
      expect(vote[1]).to.equal(title);
      expect(vote[2]).to.deep.equal(options);
      expect(vote[6]).to.be.true; // isActive
    });

    it("should allow company employees to cast votes", async function () {
      // 创建投票
      const title = "Choose new office location";
      const options = ["New York", "San Francisco"];
      const duration = 3600;

      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, title, options, duration);

      // Alice投票
      const input = fhevm.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input.add32(1);
      const encryptedInput = await input.encrypt();

      const tx = await this.voteSecure
        .connect(this.signers.alice)
        .castVote(1, 0, encryptedInput.handles[0], encryptedInput.inputProof);

      await expect(tx)
        .to.emit(this.voteSecure, "VoteCasted")
        .withArgs(1, this.signers.alice.address);

      // 验证投票状态
      expect(await this.voteSecure.hasUserVoted(1, this.signers.alice.address)).to.be.true;
      
      const vote = await this.voteSecure.getVote(1);
      expect(vote[8]).to.equal(1); // totalVoted
    });

    it("should prevent double voting", async function () {
      // 创建投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Test Vote", ["Option A", "Option B"], 3600);

      // Alice第一次投票
      const input1 = fhevm.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input1.add32(1);
      const encryptedInput1 = await input1.encrypt();

      await this.voteSecure
        .connect(this.signers.alice)
        .castVote(1, 0, encryptedInput1.handles[0], encryptedInput1.inputProof);

      // Alice尝试第二次投票（应该失败）
      const input2 = fhevm.createEncryptedInput(this.contractAddress, this.signers.alice.address);
      input2.add32(1);
      const encryptedInput2 = await input2.encrypt();

      await expect(
        this.voteSecure
          .connect(this.signers.alice)
          .castVote(1, 1, encryptedInput2.handles[0], encryptedInput2.inputProof)
      ).to.be.revertedWith("User has already voted");
    });

    it("should prevent non-employees from voting", async function () {
      // 创建投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Test Vote", ["Option A", "Option B"], 3600);

      // 创建新用户（不属于公司）
      const [, , , , outsider] = await ethers.getSigners();
      
      const input = fhevm.createEncryptedInput(this.contractAddress, outsider.address);
      input.add32(1);
      const encryptedInput = await input.encrypt();

      // 外部用户尝试投票（应该失败）
      await expect(
        this.voteSecure
          .connect(outsider)
          .castVote(1, 0, encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.be.revertedWith("Not a company employee");
    });

    it("should end vote when all employees have voted", async function () {
      // 创建投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Test Vote", ["Option A", "Option B"], 3600);

      // 所有三个员工投票
      const users = [this.signers.alice, this.signers.bob, this.signers.carol];
      
      for (let i = 0; i < users.length; i++) {
        const input = fhevm.createEncryptedInput(this.contractAddress, users[i].address);
        input.add32(1);
        const encryptedInput = await input.encrypt();

        const tx = await this.voteSecure
          .connect(users[i])
          .castVote(1, i % 2, encryptedInput.handles[0], encryptedInput.inputProof);
        
        if (i === users.length - 1) {
          // 最后一票应该触发投票结束
          await expect(tx).to.emit(this.voteSecure, "VoteEnded").withArgs(1);
        }
      }

      // 验证投票已结束
      const vote = await this.voteSecure.getVote(1);
      expect(vote[6]).to.be.false; // isActive should be false
      expect(vote[8]).to.equal(3); // totalVoted should be 3
    });

    it("should allow vote creator to end vote early", async function () {
      // 创建投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Test Vote", ["Option A", "Option B"], 3600);

      // 创建者结束投票
      const tx = await this.voteSecure.connect(this.signers.alice).endVote(1);
      
      await expect(tx).to.emit(this.voteSecure, "VoteEnded").withArgs(1);

      // 验证投票已结束
      const vote = await this.voteSecure.getVote(1);
      expect(vote[6]).to.be.false; // isActive
    });
  });

  describe("Access Control", function () {
    it("should only allow company employees to create votes", async function () {
      // 创建公司
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Test Company", 3);

      // 非员工尝试创建投票
      const [, , , , outsider] = await ethers.getSigners();
      
      await expect(
        this.voteSecure
          .connect(outsider)
          .createVote(1, "Test Vote", ["Option A", "Option B"], 3600)
      ).to.be.revertedWith("Not a company employee");
    });

    it("should only allow vote creator to end vote", async function () {
      // 创建公司和投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Test Company", 3);
      
      await this.voteSecure.connect(this.signers.bob).joinCompany(1);
      
      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Test Vote", ["Option A", "Option B"], 3600);

      // 非创建者尝试结束投票
      await expect(
        this.voteSecure.connect(this.signers.bob).endVote(1)
      ).to.be.revertedWith("Not the vote creator");
    });
  });

  describe("Utility Functions", function () {
    it("should return correct total counts", async function () {
      expect(await this.voteSecure.getTotalCompanies()).to.equal(0);
      expect(await this.voteSecure.getTotalVotes()).to.equal(0);

      // 创建公司和投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Test Company", 3);
      
      expect(await this.voteSecure.getTotalCompanies()).to.equal(1);

      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Test Vote", ["Option A", "Option B"], 3600);
      
      expect(await this.voteSecure.getTotalVotes()).to.equal(1);
    });

    it("should return company votes correctly", async function () {
      // 创建公司和多个投票
      await this.voteSecure
        .connect(this.signers.alice)
        .createCompany("Test Company", 3);

      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Vote 1", ["A", "B"], 3600);
      
      await this.voteSecure
        .connect(this.signers.alice)
        .createVote(1, "Vote 2", ["C", "D"], 3600);

      const companyVotes = await this.voteSecure.getCompanyVotes(1);
      expect(companyVotes.length).to.equal(2);
      expect(companyVotes[0]).to.equal(1);
      expect(companyVotes[1]).to.equal(2);
    });
  });
});