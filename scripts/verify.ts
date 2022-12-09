/* eslint-disable no-process-exit */
import hre, { ethers } from "hardhat";
import { readDeploymentFile } from "./common";
const { FEE_ADDRESS, ADMIN_ADDRESS } = process.env;
async function main(): Promise<void> {
  const deploymentData = await readDeploymentFile();
  const permissionManger: string = deploymentData.permissionManager.address;
  const [deployer] = await ethers.getSigners();
  const [deployerAddress] = await Promise.all([deployer.getAddress()]);
  // Verify Permission Item on any EVM compatible blockchain.
  await hre
    .run("verify:verify", {
      address: deploymentData.permissionItem.address,
      constructorArguments: [],
    })
    .catch(ignoreAlreadyVerifiedError);
  // Verify Permission Manager on any EVM compatible blockchain.
  await hre
    .run("verify:verify", {
      address: "0xE81a216C0AcB118f1bc3098bE2dA917dC3Cd9F82",
      constructorArguments: [],
    })
    .catch(ignoreAlreadyVerifiedError);

  // Verify Rocket on any EVM compatible blockchain.
  await hre
    .run("verify:verify", {
      address: "0xcC50ae88e374bb620eA9AB3308dbE0fda0dcD6Ae",
      constructorArguments: [],
    })
    .catch(ignoreAlreadyVerifiedError);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    // spinner.fail();
    console.error(error);
    process.exit(1);
  });

function ignoreAlreadyVerifiedError(err: Error) {
  if (err.message.includes("Contract source code already verified")) {
    console.log("contract already verfied, skipping");
  } else {
    throw err;
  }
}
