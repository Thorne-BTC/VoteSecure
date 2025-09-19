import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Deploying VoteSecure contract with account:", deployer);

  const voteSecure = await deploy("VoteSecure", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log("VoteSecure deployed at:", voteSecure.address);
  
  // 验证合约（如果在测试网或主网）
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 60000)); // 等待1分钟
    
    try {
      await hre.run("verify:verify", {
        address: voteSecure.address,
        constructorArguments: [],
      });
      console.log("Contract verified on Etherscan");
    } catch (error) {
      console.log("Error verifying contract:", error);
    }
  }
};

func.tags = ["VoteSecure"];
export default func;