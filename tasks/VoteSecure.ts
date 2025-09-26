import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { fhevm } from "hardhat";

task("createCompany", "Create a new company")
  .addParam("name", "Company name")
  .addParam("employees", "Total number of employees")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    console.log(`Creating company: ${taskArgs.name} with ${taskArgs.employees} employees`);
    
    const tx = await voteSecure.connect(signer).createCompany(taskArgs.name, parseInt(taskArgs.employees));
    const receipt = await tx.wait();
    
    console.log(`Company created! Transaction hash: ${tx.hash}`);
    
    // 从事件中获取公司ID
    const event = receipt?.logs.find((log: any) => log.eventName === 'CompanyCreated');
    if (event) {
      console.log(`Company ID: ${event.args[0]}`);
    }
  });

task("joinCompany", "Join an existing company")
  .addParam("companyId", "Company ID to join")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    console.log(`Joining company with ID: ${taskArgs.companyId}`);
    
    const tx = await voteSecure.connect(signer).joinCompany(parseInt(taskArgs.companyId));
    await tx.wait();
    
    console.log(`Successfully joined company! Transaction hash: ${tx.hash}`);
  });

task("createVote", "Create a new vote")
  .addParam("companyId", "Company ID")
  .addParam("title", "Vote title")
  .addParam("options", "Vote options (comma-separated)")
  .addParam("duration", "Vote duration in seconds")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    const options = taskArgs.options.split(',').map((opt: string) => opt.trim());
    
    console.log(`Creating vote: ${taskArgs.title}`);
    console.log(`Options: ${options.join(', ')}`);
    
    const tx = await voteSecure.connect(signer).createVote(
      parseInt(taskArgs.companyId),
      taskArgs.title,
      options,
      parseInt(taskArgs.duration)
    );
    const receipt = await tx.wait();
    
    console.log(`Vote created! Transaction hash: ${tx.hash}`);
    
    // 从事件中获取投票ID
    const event = receipt?.logs.find((log: any) => log.eventName === 'VoteCreated');
    if (event) {
      console.log(`Vote ID: ${event.args[0]}`);
    }
  });

task("castVote", "Cast a vote")
  .addParam("voteId", "Vote ID")
  .addParam("optionIndex", "Option index to vote for")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    console.log(`Casting vote for option ${taskArgs.optionIndex} in vote ${taskArgs.voteId}`);
    
    // 创建加密输入
    const input = fhevm.createEncryptedInput(contractAddress, signer.address);
    input.add32(1); // 投票值为1
    const encryptedInput = await input.encrypt();
    
    const tx = await voteSecure.connect(signer).castVote(
      parseInt(taskArgs.voteId),
      parseInt(taskArgs.optionIndex),
      encryptedInput.handles[0],
      encryptedInput.inputProof
    );
    await tx.wait();
    
    console.log(`Vote cast successfully! Transaction hash: ${tx.hash}`);
  });

task("getCompany", "Get company information")
  .addParam("companyId", "Company ID")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    const company = await voteSecure.getCompany(parseInt(taskArgs.companyId));
    
    console.log(`Company Information:`);
    console.log(`Name: ${company[0]}`);
    console.log(`Creator: ${company[1]}`);
    console.log(`Total Employees: ${company[2]}`);
    console.log(`Created At: ${new Date(Number(company[3]) * 1000).toLocaleString()}`);
  });

task("getVote", "Get vote information")
  .addParam("voteId", "Vote ID")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    const vote = await voteSecure.getVote(parseInt(taskArgs.voteId));
    
    console.log(`Vote Information:`);
    console.log(`Company ID: ${vote[0]}`);
    console.log(`Title: ${vote[1]}`);
    console.log(`Options: ${vote[2].join(', ')}`);
    console.log(`Creator: ${vote[3]}`);
    console.log(`Created At: ${new Date(Number(vote[4]) * 1000).toLocaleString()}`);
    console.log(`End Time: ${new Date(Number(vote[5]) * 1000).toLocaleString()}`);
    console.log(`Is Active: ${vote[6]}`);
    console.log(`Is Decrypted: ${vote[7]}`);
    console.log(`Total Voted: ${vote[8]}`);
  });

task("endVote", "End a vote")
  .addParam("voteId", "Vote ID")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    console.log(`Ending vote ${taskArgs.voteId}`);
    
    const tx = await voteSecure.connect(signer).endVote(parseInt(taskArgs.voteId));
    await tx.wait();
    
    console.log(`Vote ended successfully! Transaction hash: ${tx.hash}`);
  });

task("requestDecryption", "Request decryption of vote results")
  .addParam("voteId", "Vote ID")
  .addOptionalParam("contract", "Contract address")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, deployments } = hre;
    const [signer] = await ethers.getSigners();

    const contractAddress = taskArgs.contract || (await deployments.get("VoteSecure")).address;
    const voteSecure = await ethers.getContractAt("VoteSecure", contractAddress);

    console.log(`Requesting decryption for vote ${taskArgs.voteId}`);
    
    const tx = await voteSecure.connect(signer).requestDecryption(parseInt(taskArgs.voteId));
    await tx.wait();
    
    console.log(`Decryption requested! Transaction hash: ${tx.hash}`);
  });