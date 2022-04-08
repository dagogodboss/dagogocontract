/* eslint-disable no-process-exit */
import hre, { ethers } from "hardhat";
import { readDeploymentFile } from "./common";

async function main(): Promise<void> {
  const deploymentData = await readDeploymentFile();
  const permissionManger: string = deploymentData.permissionManager.address;
  const [deployer] = await ethers.getSigners();
  const [deployerAddress] = await Promise.all([deployer.getAddress()]);
  await hre
    .run("verify:verify", {
      address: "0x6c4E442af781EB146896A31Fd52B245788ADC117",
      constructorArguments: [
        deploymentData.permissionItem.address,
        deployerAddress,
      ],
    })
    .catch(ignoreAlreadyVerifiedError);
  await hre
    .run("verify:verify", {
      address: deploymentData.permissionItem.address,
      constructorArguments: [],
    })
    .catch(ignoreAlreadyVerifiedError);

  await hre
    .run("verify:verify", {
      address: deploymentData.rocket.address,
      constructorArguments: [permissionManger],
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
