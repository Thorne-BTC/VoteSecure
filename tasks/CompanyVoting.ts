import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("vote:address", "Prints the CompanyVoting address").setAction(async (_args: TaskArguments, hre) => {
  const d = await hre.deployments.get("CompanyVoting");
  console.log(`CompanyVoting: ${d.address}`);
});

task("vote:create-company", "Create a company")
  .addParam("name", "Company name")
  .addParam("limit", "Employee limit")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers } = hre;
    const [signer] = await ethers.getSigners();
    const d = await hre.deployments.get("CompanyVoting");
    const c = await ethers.getContractAt("CompanyVoting", d.address);
    const tx = await c.connect(signer).createCompany(args.name, parseInt(args.limit));
    const rc = await tx.wait();
    console.log(`createCompany tx: ${tx.hash} status=${rc?.status}`);
  });

task("vote:join", "Join a company")
  .addParam("company", "Company id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers } = hre;
    const [signer] = await ethers.getSigners();
    const d = await hre.deployments.get("CompanyVoting");
    const c = await ethers.getContractAt("CompanyVoting", d.address);
    const tx = await c.connect(signer).joinCompany(parseInt(args.company));
    const rc = await tx.wait();
    console.log(`joinCompany tx: ${tx.hash} status=${rc?.status}`);
  });

task("vote:create-poll", "Create a poll in a company")
  .addParam("company", "Company id")
  .addParam("title", "Poll title")
  .addVariadicPositionalParam("options", "Poll options")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers } = hre;
    const [signer] = await ethers.getSigners();
    const d = await hre.deployments.get("CompanyVoting");
    const c = await ethers.getContractAt("CompanyVoting", d.address);
    const tx = await c.connect(signer).createPoll(parseInt(args.company), args.title, args.options);
    const rc = await tx.wait();
    console.log(`createPoll tx: ${tx.hash} status=${rc?.status}`);
  });

