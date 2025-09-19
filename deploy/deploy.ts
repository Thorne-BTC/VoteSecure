import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // 部署VoteSecure主合约
  const deployedVoteSecure = await deploy("VoteSecure", {
    from: deployer,
    log: true,
  });

  console.log(`VoteSecure contract deployed at: `, deployedVoteSecure.address);
  
  // 也保留FHECounter合约部署（用于测试）
  const deployedFHECounter = await deploy("FHECounter", {
    from: deployer,
    log: true,
  });

  console.log(`FHECounter contract deployed at: `, deployedFHECounter.address);
};
export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["VoteSecure", "FHECounter"];
