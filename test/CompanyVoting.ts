import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("CompanyVoting", function () {
  let signers: Signers;
  let votingAddress: string;
  let voting: any;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only in FHEVM mock environment");
      this.skip();
    }

    const factory = await ethers.getContractFactory("CompanyVoting");
    voting = await factory.deploy();
    votingAddress = await voting.getAddress();
  });

  it("create company, join, poll, vote, finalize and decrypt", async function () {
    // Create company with limit 2
    const createTx = await voting.connect(signers.deployer).createCompany("Acme", 2);
    await createTx.wait();
    const companyId = 1;

    // Join as Alice and Bob
    await (await voting.connect(signers.alice).joinCompany(companyId)).wait();
    await (await voting.connect(signers.bob).joinCompany(companyId)).wait();

    // Create poll with 2 options
    await (
      await voting.connect(signers.alice).createPoll(companyId, "Lunch", ["Pizza", "Sushi"])
    ).wait();
    const pollId = 0;

    // Prepare encrypted 1 for Alice and Bob
    const encOneAlice = await fhevm.createEncryptedInput(votingAddress, signers.alice.address).add32(1).encrypt();
    const encOneBob = await fhevm.createEncryptedInput(votingAddress, signers.bob.address).add32(1).encrypt();

    // Alice votes option 0, Bob votes option 1
    await (
      await voting
        .connect(signers.alice)
        .vote(companyId, pollId, 0, encOneAlice.handles[0], encOneAlice.inputProof)
    ).wait();

    await (
      await voting.connect(signers.bob).vote(companyId, pollId, 1, encOneBob.handles[0], encOneBob.inputProof)
    ).wait();

    // Check progress
    const pollInfo = await voting.getPoll(companyId, pollId);
    expect(pollInfo[2]).to.eq(2); // totalVoted
    expect(pollInfo[3]).to.eq(2); // memberCountSnapshot

    // Finalize
    await (await voting.connect(signers.alice).finalize(companyId, pollId)).wait();

    // Get encrypted counts and decrypt with Alice for both options
    const encCounts = await voting.getEncryptedCounts(companyId, pollId);
    expect(encCounts.length).to.eq(2);

    const c0 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encCounts[0],
      votingAddress,
      signers.alice
    );
    const c1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encCounts[1],
      votingAddress,
      signers.alice
    );

    expect(c0).to.eq(1);
    expect(c1).to.eq(1);
  });
});

