import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy CompanyVoting contract for the core app
  const deployedCompanyVoting = await deploy("CompanyVoting", {
    from: deployer,
    log: true,
  });

  console.log(`CompanyVoting contract deployed at: `, deployedCompanyVoting.address);
};
export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["CompanyVoting"];
